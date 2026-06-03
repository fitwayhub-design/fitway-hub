import express from 'express';
import { saveSession } from '../controllers/trackController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/sessions', authenticateToken, saveSession);

export default router;
