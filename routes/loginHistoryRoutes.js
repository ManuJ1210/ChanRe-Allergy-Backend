import express from 'express';
import { protect, checkSuperAdmin, ensureCenterIsolation } from '../middleware/authMiddleware.js';
import {
  getUserLoginHistory,
  getCenterLoginHistory,
  getRecentLogins,
  getLoginStats,
  updateLogoutTime
} from '../controllers/loginHistoryController.js';

const router = express.Router();

// Get login history for current user
router.get('/my-history', protect, getUserLoginHistory);

// Get login history for a specific user
router.get('/user/:userId', protect, getUserLoginHistory);

// Get login history for a specific center (Center Admin can view their center's history)
router.get('/center/:centerId', protect, ensureCenterIsolation, getCenterLoginHistory);

// Superadmin only routes
router.get('/recent', protect, checkSuperAdmin, getRecentLogins);
router.get('/stats', protect, checkSuperAdmin, getLoginStats);

// Update logout time (called during logout)
router.put('/logout/:userId', protect, updateLogoutTime);

export default router;
