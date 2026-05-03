import { Router } from 'express';
import { analyzeSteps } from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();

// SECURITY / COST-DOS: AI calls hit a paid Gemini quota. Limit per authenticated
// user (preferred) AND fall back to IP for the rare unauthenticated edge.
// Without a per-user key, a single token from many IPs can rack up the bill.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 requests / 15 min per user (or per IP)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const uid = req.user?.id;
    return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip || '')}`;
  },
  message: { message: 'Too many AI requests, please try again later.' },
});

router.post('/analyze-steps', authenticateToken, aiLimiter, analyzeSteps);

export default router;
