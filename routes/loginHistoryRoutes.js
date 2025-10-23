import express from 'express';
import { protect, checkSuperAdmin, ensureCenterIsolation } from '../middleware/authMiddleware.js';
import {
  getUserLoginHistory,
  getCenterLoginHistory,
  getRecentLogins,
  getLoginStats,
  updateLogoutTime,
  deleteLoginHistory,
  bulkDeleteLoginHistory,
  deleteAllLoginHistory,
  updateLoginHistoryLocations
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

// Delete routes (Superadmin only)
router.delete('/:id', protect, checkSuperAdmin, deleteLoginHistory);
router.delete('/bulk', protect, checkSuperAdmin, bulkDeleteLoginHistory);
router.post('/bulk-delete', protect, checkSuperAdmin, bulkDeleteLoginHistory); // Alternative POST route
router.delete('/all', protect, checkSuperAdmin, deleteAllLoginHistory);

// Update location info (Superadmin only)
router.put('/update-locations', protect, checkSuperAdmin, updateLoginHistoryLocations);

// Update logout time (called during logout)
router.put('/logout/:userId', protect, updateLogoutTime);

export default router;
