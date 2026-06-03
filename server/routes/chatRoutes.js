/**
 * Chat routes — group chats + ADMIN SUPPORT ONLY (May 2026 revision).
 *
 * What's gone:
 *   • Athlete ↔ Coach 1:1 chat (handled by Tickets now)
 *   • Athlete ↔ Athlete 1:1 chat
 *
 * What stays:
 *   • Challenge / group chats (used by the new Challenges page and the
 *     admin Chat "Groups" tab).
 *   • Athlete ↔ Admin direct messages, so the Support tab in admin Chat
 *     still works. Every 1:1 endpoint here verifies that one side of
 *     the conversation is the platform admin; anything else is 410.
 */
import express from 'express';
import { getChatHistory, sendMessage, getContacts, getChallengeMessages, pingPresence, getPresence } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadAudio, optimizeImage, verifyUploadBytes } from '../middleware/upload.js';
import { get } from '../config/database.js';
const router = express.Router();
const goneMsg = '1:1 chat was removed — file a Ticket instead. Support contact is allowed.';
// Allow the request to proceed only when the OTHER party in the DM is an
// admin. Used to scope the surviving 1:1 endpoints to support contact.
async function isOtherSideAdmin(myId, otherId) {
    if (!myId || !otherId)
        return false;
    const me = await get('SELECT role FROM users WHERE id = ?', [myId]).catch(() => null);
    const other = await get('SELECT role FROM users WHERE id = ?', [otherId]).catch(() => null);
    if (!me || !other)
        return false;
    return me.role === 'admin' || other.role === 'admin';
}
// ── 1:1 chat — admin-support only ─────────────────────────────────────────
// /users + /contacts return only the support-relevant list: for athletes/
// coaches that's the admin; for admins it's everyone who has messaged them.
// getContacts already filters when supportOnly=1.
router.get('/users', authenticateToken, (req, res) => {
    req.query.supportOnly = '1';
    return getContacts(req, res);
});
router.get('/contacts', authenticateToken, (req, res) => {
    req.query.supportOnly = '1';
    return getContacts(req, res);
});
router.get('/messages/:userId', authenticateToken, async (req, res) => {
    const other = Number(req.params.userId);
    if (!(await isOtherSideAdmin(req.user?.id, other)))
        return res.status(410).json({ message: goneMsg });
    return getChatHistory(req, res);
});
router.get('/history/:userId', authenticateToken, async (req, res) => {
    const other = Number(req.params.userId);
    if (!(await isOtherSideAdmin(req.user?.id, other)))
        return res.status(410).json({ message: goneMsg });
    return getChatHistory(req, res);
});
router.get('/support-contact', authenticateToken, async (_req, res) => {
    try {
        const admin = await get("SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' LIMIT 1");
        if (!admin)
            return res.status(404).json({ message: 'No support agent found' });
        res.json({ contact: admin });
    }
    catch {
        res.status(500).json({ message: 'Failed' });
    }
});
// ── Group / challenge chat ────────────────────────────────────────────────
router.get('/challenge/:challengeId/messages', authenticateToken, getChallengeMessages);
router.get('/challenge/:challengeId', authenticateToken, getChallengeMessages);
// ── Send — group sends always allowed; 1:1 sends only when other party is admin
async function sendGuard(req, res) {
    const body = req.body || {};
    if (body.challengeId)
        return sendMessage(req, res);
    const other = Number(body.receiverId);
    if (!other)
        return res.status(400).json({ message: 'receiverId or challengeId required' });
    if (!(await isOtherSideAdmin(req.user?.id, other)))
        return res.status(410).json({ message: goneMsg });
    return sendMessage(req, res);
}
router.post('/send', authenticateToken, sendGuard);
router.post('/send-media', authenticateToken, upload.single('file'), optimizeImage(), sendGuard);
router.post('/send-voice', authenticateToken, uploadAudio.single('file'), verifyUploadBytes('audio'), sendGuard);
router.post('/presence/ping', authenticateToken, pingPresence);
router.get('/presence', authenticateToken, getPresence);
export default router;
//# sourceMappingURL=chatRoutes.js.map