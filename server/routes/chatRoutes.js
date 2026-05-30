/**
 * Chat routes — group/challenge only (May 2026).
 *
 * 1:1 chat was removed across the product. The athlete↔coach channel is
 * Tickets (see ticketsRoutes). Challenge/group chats stay because the
 * Community page surfaces them and the admin Chat page reads + posts in
 * them. Direct-message endpoints below return 410 Gone so any stale
 * client still calling them gets a clear error instead of opening a
 * silently-broken thread.
 */
import express from 'express';
import { getChallengeMessages, sendMessage, pingPresence, getPresence } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadAudio, optimizeImage, verifyUploadBytes } from '../middleware/upload.js';
const router = express.Router();
// ── 1:1 chat — REMOVED ────────────────────────────────────────────────────
const gone = (_req, res) => res.status(410).json({ message: '1:1 chat was removed. File a Ticket instead.' });
router.get('/users', authenticateToken, gone);
router.get('/contacts', authenticateToken, gone);
router.get('/messages/:userId', authenticateToken, gone);
router.get('/history/:userId', authenticateToken, gone);
router.get('/support-contact', authenticateToken, gone);
// ── Group / challenge chat — still active ────────────────────────────────
router.get('/challenge/:challengeId/messages', authenticateToken, getChallengeMessages);
router.get('/challenge/:challengeId', authenticateToken, getChallengeMessages);
// Send endpoint accepts BOTH 1:1 and group payloads at the controller level,
// but we now reject anything that targets a single recipient — only
// challengeId messages get through.
router.post('/send', authenticateToken, (req, res) => {
    if (req.body?.receiverId && !req.body?.challengeId)
        return gone(req, res);
    return sendMessage(req, res);
});
router.post('/send-media', authenticateToken, upload.single('file'), optimizeImage(), (req, res) => {
    if (req.body?.receiverId && !req.body?.challengeId)
        return gone(req, res);
    return sendMessage(req, res);
});
router.post('/send-voice', authenticateToken, uploadAudio.single('file'), verifyUploadBytes('audio'), (req, res) => {
    if (req.body?.receiverId && !req.body?.challengeId)
        return gone(req, res);
    return sendMessage(req, res);
});
// Presence ping still useful for showing online dots in groups.
router.post('/presence/ping', authenticateToken, pingPresence);
router.get('/presence', authenticateToken, getPresence);
export default router;
//# sourceMappingURL=chatRoutes.js.map