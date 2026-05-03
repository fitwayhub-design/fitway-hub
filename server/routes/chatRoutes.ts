import express from 'express';
import { getChatHistory, sendMessage, getContacts, getChallengeMessages, sendMediaMessage, pingPresence, getPresence } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadAudio, optimizeImage, verifyUploadBytes } from '../middleware/upload.js';

const router = express.Router();

// Frontend calls these endpoints:
router.get('/users', authenticateToken, getContacts);                              // GET /api/chat/users
router.get('/contacts', authenticateToken, getContacts);                           // GET /api/chat/contacts (alias)
router.get('/messages/:userId', authenticateToken, getChatHistory);                // GET /api/chat/messages/:id
router.get('/history/:userId', authenticateToken, getChatHistory);                 // GET /api/chat/history/:userId (alias)
router.get('/challenge/:challengeId/messages', authenticateToken, getChallengeMessages); // GET /api/chat/challenge/:id/messages
router.get('/challenge/:challengeId', authenticateToken, getChallengeMessages);    // alias
router.post('/send', authenticateToken, sendMessage);                              // POST /api/chat/send
router.post('/send-media', authenticateToken, upload.single('file'), optimizeImage(), sendMessage); // POST /api/chat/send-media
router.post('/send-voice', authenticateToken, uploadAudio.single('file'), verifyUploadBytes('audio'), sendMessage); // POST /api/chat/send-voice
router.post('/presence/ping', authenticateToken, pingPresence);                    // POST /api/chat/presence/ping
router.get('/presence', authenticateToken, getPresence);                           // GET /api/chat/presence
router.get('/support-contact', authenticateToken, async (req: any, res) => {
  try {
    const { get } = await import('../config/database.js');
    const admin = await get<any>("SELECT id, name, avatar, role, is_premium FROM users WHERE role = 'admin' LIMIT 1");
    if (!admin) return res.status(404).json({ message: 'No support agent found' });
    res.json({ contact: admin });
  } catch { res.status(500).json({ message: 'Failed' }); }
});

export default router;
