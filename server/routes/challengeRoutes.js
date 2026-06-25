import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireModeratorArea, requireAdmin, auditModeratorAction } from '../middleware/moderator.js';
import { upload, uploadVideo, optimizeImage, multerToJson } from '../middleware/upload.js';
import { stampMediaCapture } from '../utils/mediaCapture.js';
import { listChallenges, listMyInvitations, getChallenge, createChallenge, updateChallenge, deleteChallenge, getInvitableAthletes, inviteParticipants, respondInvitation, joinChallenge, leaveChallenge, removeParticipant, submitEvidence, listSubmissions, approveSubmission, rejectSubmission, getLeaderboard, getProgress, finalizeChallenge, reportChallenge, adminListChallenges, adminReviewChallenge, getRewardSettings, saveRewardSettings, adminListReports, adminResolveReport, getUserRewards, getGoalOptions, } from '../controllers/challengesController.js';
const router = express.Router();
// Cover images (create/update): images only, optimised before R2 upload.
const media = [multerToJson(upload.any()), optimizeImage()];
// Evidence (submissions): photo OR video allowed; images are still optimised,
// videos pass through untouched. Mirrors how workout-video uploads are handled.
const mediaEvidence = [multerToJson(uploadVideo.any()), stampMediaCapture, optimizeImage()];
// Everything requires auth.
router.use(authenticateToken);
// ── Discovery / details ──
router.get('/', listChallenges);
router.get('/invitations', listMyInvitations);
router.get('/meta/goal-options', getGoalOptions);
router.get('/rewards/me', getUserRewards);
router.get('/rewards/:userId', getUserRewards);
// ── Admin / moderator (must precede /:id to avoid route capture) ──
// Single gate (§17): viewing needs `challenges_view`; acting needs
// `challenges_moderate`; reward economics stay admin-only. Replaces the old
// local `adminOnly` that silently granted every moderator (ignoring the
// Settings → Moderators toggles).
router.get('/admin/list', requireModeratorArea('challenges_view'), adminListChallenges);
router.get('/admin/reports', requireModeratorArea('challenges_view'), adminListReports);
router.post('/admin/reports/:id/resolve', requireModeratorArea('challenges_moderate'), auditModeratorAction('challenges_moderate', 'challenge_report_resolve', 'challenge_report'), adminResolveReport);
router.get('/admin/reward-settings', requireAdmin, getRewardSettings);
router.put('/admin/reward-settings', requireAdmin, saveRewardSettings);
router.post('/admin/:id/:decision(approve|reject)', requireModeratorArea('challenges_moderate'), auditModeratorAction('challenges_moderate', 'challenge_review', 'challenge', req => req.params?.id), adminReviewChallenge);
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
router.post('/:id/submissions', ...mediaEvidence, submitEvidence);
router.get('/:id/submissions', listSubmissions);
router.post('/:id/submissions/:sid/approve', approveSubmission);
router.post('/:id/submissions/:sid/reject', rejectSubmission);
router.get('/:id/leaderboard', getLeaderboard);
router.get('/:id/progress', getProgress);
router.post('/:id/finalize', finalizeChallenge);
router.post('/:id/report', reportChallenge);
export default router;
//# sourceMappingURL=challengeRoutes.js.map