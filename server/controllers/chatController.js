import { query, get, run } from '../config/database.js';
import { uploadToR2 } from '../middleware/upload.js';
import { sendPushFromTemplate } from '../notificationService.js';
const PRESENCE_TTL_MS = 20_000;
const presenceMap = new Map();
function markOnline(userId) {
    if (!userId)
        return;
    presenceMap.set(userId, Date.now());
}
function getOnlineUserSet() {
    const now = Date.now();
    for (const [id, ts] of presenceMap.entries()) {
        if (now - ts > PRESENCE_TTL_MS)
            presenceMap.delete(id);
    }
    return new Set(presenceMap.keys());
}
async function canDirectChat(senderId, senderRole, receiverId) {
    const receiver = await get('SELECT id, role FROM users WHERE id = ?', [receiverId]);
    if (!receiver)
        return { ok: false, status: 404, message: 'Recipient not found' };
    // Support chats with admins are allowed.
    if (receiver.role === 'admin' && senderRole !== 'admin') {
        return { ok: true, receiverRole: receiver.role };
    }
    // Admin can still chat with non-admin users when needed.
    if (senderRole === 'admin') {
        return { ok: true, receiverRole: receiver.role };
    }
    if (senderRole === 'user' && receiver.role === 'coach') {
        const activeSub = await get(`SELECT id FROM coach_subscriptions
       WHERE user_id = ? AND coach_id = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`, [senderId, receiverId]);
        if (!activeSub) {
            return { ok: false, status: 403, message: 'You must subscribe to this coach before chatting. Go to Coaching to subscribe.' };
        }
        return { ok: true, receiverRole: receiver.role };
    }
    if (senderRole === 'coach' && receiver.role === 'user') {
        const activeSub = await get(`SELECT id FROM coach_subscriptions
       WHERE user_id = ? AND coach_id = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`, [receiverId, senderId]);
        if (!activeSub) {
            return { ok: false, status: 403, message: 'This user does not have an active subscription with you.' };
        }
        return { ok: true, receiverRole: receiver.role };
    }
    if (senderRole === 'user' && receiver.role === 'user') {
        return { ok: false, status: 403, message: 'Direct messaging between users is not available. You can chat only with your subscribed coach.' };
    }
    if (senderRole === 'coach' && receiver.role === 'coach') {
        return { ok: false, status: 403, message: 'Direct messaging between coaches is not available.' };
    }
    return { ok: false, status: 403, message: 'Direct chat is not allowed for this pair.' };
}
export const getChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        markOnline(userId);
        const senderRole = req.user.role;
        const otherUserId = Number(req.params.userId);
        if (!otherUserId)
            return res.status(400).json({ message: 'Invalid user id' });
        const allowed = await canDirectChat(userId, senderRole, otherUserId);
        if (!allowed.ok)
            return res.status(allowed.status).json({ message: allowed.message });
        const messages = await query(`
      SELECT m.*, s.name as sender_name, s.avatar as sender_avatar
      FROM messages m JOIN users s ON m.sender_id = s.id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.challenge_id IS NULL AND m.group_id IS NULL
      ORDER BY m.created_at ASC
    `, [userId, otherUserId, otherUserId, userId]);
        res.json({ messages });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch chat history' });
    }
};
export const getChallengeMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        markOnline(userId);
        const challengeId = req.params.challengeId;
        // SECURITY: previously this handler silently auto-INSERTed the caller into
        // challenge_participants on every read, which both leaked private message
        // history to anyone who guessed a challenge ID and grew the participant
        // list invisibly. Now we require an existing participant record (or admin
        // role) before returning messages. Joining must go through the explicit
        // POST /api/community/challenges/:id/join endpoint.
        const participantCheck = await get('SELECT id FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [challengeId, userId]);
        if (!participantCheck && userRole !== 'admin') {
            return res.status(403).json({ message: 'Join the challenge to view its messages' });
        }
        const messages = await query(`
      SELECT m.*, s.name as sender_name, s.avatar as sender_avatar
      FROM messages m JOIN users s ON m.sender_id = s.id
      WHERE m.challenge_id = ? ORDER BY m.created_at ASC
    `, [challengeId]);
        res.json({ messages });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch challenge messages' });
    }
};
export const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        markOnline(senderId);
        const senderRole = req.user.role;
        const { receiverId, challengeId, content } = req.body;
        const mediaUrl = req.file ? await uploadToR2(req.file, 'chat') : null;
        if ((!receiverId && !challengeId) || (!content && !mediaUrl))
            return res.status(400).json({ message: 'Receiver ID or Challenge ID and content/media are required' });
        // Enforce direct-chat rules
        if (receiverId) {
            const allowed = await canDirectChat(senderId, senderRole, Number(receiverId));
            if (!allowed.ok)
                return res.status(allowed.status).json({ message: allowed.message });
        }
        let insertId;
        if (challengeId) {
            try {
                await run('INSERT IGNORE INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)', [challengeId, senderId]);
            }
            catch { }
            ({ insertId } = await run('INSERT INTO messages (sender_id, challenge_id, content, media_url) VALUES (?, ?, ?, ?)', [senderId, challengeId, content, mediaUrl]));
        }
        else {
            ({ insertId } = await run('INSERT INTO messages (sender_id, receiver_id, content, media_url) VALUES (?, ?, ?, ?)', [senderId, receiverId, content, mediaUrl]));
        }
        const newMessage = await get(`
      SELECT m.*, s.name as sender_name, s.avatar as sender_avatar
      FROM messages m JOIN users s ON m.sender_id = s.id WHERE m.id = ?
    `, [insertId]);
        // Push notification to message receiver (fire-and-forget)
        if (receiverId) {
            sendPushFromTemplate(Number(receiverId), 'new_message', { name: newMessage?.sender_name || 'Someone' }).catch(() => { });
        }
        res.status(201).json(newMessage);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to send message' });
    }
};
export const getContacts = async (req, res) => {
    try {
        const userId = req.user.id;
        markOnline(userId);
        const userRole = req.user.role;
        const supportOnly = String(req.query?.supportOnly || '') === '1';
        let contacts = [];
        if (userRole === 'admin') {
            if (supportOnly) {
                // Support view: show all users and coaches who have messaged ANY admin.
                // The admin is the support — they should see all incoming support conversations.
                contacts = await query(`SELECT DISTINCT u.id, u.name, u.avatar, u.role, u.is_premium
           FROM users u
           INNER JOIN messages m ON m.sender_id = u.id
           INNER JOIN users admin_u ON admin_u.id = m.receiver_id AND admin_u.role = 'admin'
           WHERE u.role IN ('user', 'coach')
           ORDER BY u.name ASC`, []);
            }
            else {
                // Admin sees non-admin accounts only (hide admin users from chat list)
                contacts = await query("SELECT id, name, avatar, role, is_premium FROM users WHERE id != ? AND role != 'admin' ORDER BY name ASC", [userId]);
            }
        }
        else if (userRole === 'coach') {
            // Coaches see subscribed athletes + admins (support)
            const athletes = await query(`
        SELECT DISTINCT u.id, u.name, u.avatar, u.role, u.is_premium
        FROM users u
        INNER JOIN coach_subscriptions cs ON cs.user_id = u.id
        WHERE cs.coach_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW()) AND u.id != ?
        ORDER BY u.name ASC
      `, [userId, userId]);
            const admins = await query(`SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' ORDER BY name ASC`, []);
            contacts = [...athletes, ...admins];
        }
        else {
            // Users see subscribed coaches + admins (support)
            const subscribedCoaches = await query(`
        SELECT DISTINCT u.id, u.name, u.avatar, u.role, u.is_premium
        FROM users u
        INNER JOIN coach_subscriptions cs ON cs.coach_id = u.id
        WHERE cs.user_id = ? AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
        ORDER BY u.name ASC
      `, [userId]);
            const admins = await query(`SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' ORDER BY name ASC`, []);
            contacts = [...subscribedCoaches, ...admins];
        }
        // Final safety net: only return contacts that pass direct-chat policy.
        // This prevents accidental leaks if future query logic changes.
        const filtered = [];
        for (const c of contacts || []) {
            const allowed = await canDirectChat(userId, userRole, Number(c.id));
            if (allowed.ok)
                filtered.push(c);
        }
        // De-duplicate by id (in case arrays were merged from multiple sources).
        const uniqueById = Array.from(new Map(filtered.map((u) => [u.id, u])).values());
        const onlineSet = getOnlineUserSet();
        res.json({ users: uniqueById.map((u) => ({ ...u, online: onlineSet.has(Number(u.id)) })) });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch contacts' });
    }
};
export const pingPresence = async (req, res) => {
    try {
        const userId = Number(req.user?.id || 0);
        markOnline(userId);
        // Persist last_active to DB for accuracy across restarts
        await run('UPDATE users SET last_active = NOW() WHERE id = ?', [userId]);
        res.json({ ok: true, ts: Date.now() });
    }
    catch {
        res.status(500).json({ message: 'Failed to update presence' });
    }
};
export const getPresence = async (req, res) => {
    try {
        const userId = Number(req.user?.id || 0);
        markOnline(userId);
        // Combine in-memory presence with DB last_active (within 25s)
        const memoryOnline = Array.from(getOnlineUserSet());
        const dbOnline = await query('SELECT id FROM users WHERE last_active >= DATE_SUB(NOW(), INTERVAL 25 SECOND)', []);
        const combined = new Set(memoryOnline);
        for (const row of dbOnline)
            combined.add(Number(row.id));
        res.json({ onlineUserIds: Array.from(combined) });
    }
    catch {
        res.status(500).json({ message: 'Failed to fetch presence' });
    }
};
export const sendMediaMessage = sendMessage;
//# sourceMappingURL=chatController.js.map