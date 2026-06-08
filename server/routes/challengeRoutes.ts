import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { upload, optimizeImage, multerToJson } from '../middleware/upload.js';
import {
  listChallenges, listMyInvitations, getChallenge, createChallenge, updateChallenge, deleteChallenge,
  getInvitableAthletes, inviteParticipants, respondInvitation,
  joinChallenge, leaveChallenge, removeParticipant,
  submitEvidence, listSubmissions, approveSubmission, rejectSubmission,
  getLeaderboard, getProgress, finalizeChallenge, reportChallenge,
  adminListChallenges, adminReviewChallenge, getRewardSettings, saveRewardSettings,
  adminListReports, adminResolveReport, getUserRewards,
} from '../controllers/challengesController.js';

const router = express.Router();

// Accept any file field (cover / evidence) and optimise images before R2 upload.
const media = [multerToJson(upload.any()), optimizeImage()];

function adminOnly(req: Request, res: Response, next: NextFunction) {
  const r = (req as any).user?.role;
  if (r !== 'admin' && r !== 'moderator') return res.status(403).json({ message: 'Admin only' });
  next();
}

// Everything requires auth.
router.use(authenticateToken);

// ── Discovery / details ──
router.get('/', listChallenges);
router.get('/invitations', listMyInvitations);
router.get('/rewards/me', getUserRewards);
router.get('/rewards/:userId', getUserRewards);

// ── Admin (must precede /:id to avoid route capture) ──
router.get('/admin/list', adminOnly, adminListChallenges);
router.get('/admin/reports', adminOnly, adminListReports);
router.post('/admin/reports/:id/resolve', adminOnly, adminResolveReport);
router.get('/admin/reward-settings', adminOnly, getRewardSettings);
router.put('/admin/reward-settings', adminOnly, saveRewardSettings);
router.post('/admin/:id/:decision(approve|reject)', adminOnly, adminReviewChallenge);

// ── Create ──
router.post('/', ...media, createChallenge);

// ── Per-challenge ──
router.get('/:id', getChallenge);
router.patch('/:id', ...media, updateChallenge);
router.delete('/:id', deleteChallenge);

router.get('/:id/invitable', getInvitableAthletes);
router.post('/:id/invites', inviteParticipants);
router.post('/:id/invites/respond', respondInvitation);

router.post('/:id/join', joinChallenge);
router.post('/:id/leave', leaveChallenge);
router.delete('/:id/participants/:pid', removeParticipant);

router.post('/:id/submissions', ...media, submitEvidence);
router.get('/:id/submissions', listSubmissions);
router.post('/:id/submissions/:sid/approve', approveSubmission);
router.post('/:id/submissions/:sid/reject', rejectSubmission);

router.get('/:id/leaderboard', getLeaderboard);
router.get('/:id/progress', getProgress);
router.post('/:id/finalize', finalizeChallenge);
router.post('/:id/report', reportChallenge);

export default router;
