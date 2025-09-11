import express from 'express';
import { protect, checkSuperAdmin, ensureCenterIsolation } from '../middleware/authMiddleware.js';
import {
  createSession,
  getAllActiveSessions,
  getSessionsByCenter,
  getUserActiveSessions,
  updateSessionActivity,
  logoutSession,
  forceLogoutUserSessions,
  getSessionStats
} from '../controllers/sessionController.js';

const router = express.Router();

// Create new session (called during login)
router.post('/', createSession);

// Update session activity (called on each API request)
router.put('/:sessionId/activity', updateSessionActivity);

// Logout specific session
router.put('/:sessionId/logout', logoutSession);

// Get active sessions for current user
router.get('/my-sessions', protect, getUserActiveSessions);

// Get sessions by center (Center Admin can view their center's sessions)
router.get('/center/:centerId', protect, ensureCenterIsolation, getSessionsByCenter);

// Superadmin only routes
router.get('/all', protect, checkSuperAdmin, getAllActiveSessions);
router.get('/stats', protect, checkSuperAdmin, getSessionStats);
router.put('/user/:userId/force-logout', protect, checkSuperAdmin, forceLogoutUserSessions);

export default router;
