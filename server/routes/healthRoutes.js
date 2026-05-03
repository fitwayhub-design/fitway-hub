import { Router } from 'express';
import { getDailySteps, syncSteps } from '../controllers/healthController.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
// Get steps (from Google Fit API or local DB)
router.get('/steps/today', authenticateToken, getDailySteps);
// Sync steps (from client/mobile app)
router.post('/steps/sync', authenticateToken, syncSteps);
export default router;
//# sourceMappingURL=healthRoutes.js.map