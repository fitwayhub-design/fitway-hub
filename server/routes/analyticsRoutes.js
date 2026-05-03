import { Router } from 'express';
import { getMyAnalytics } from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.get('/me', authenticateToken, getMyAnalytics);
export default router;
//# sourceMappingURL=analyticsRoutes.js.map