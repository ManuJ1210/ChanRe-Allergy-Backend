import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getSuperAdminStats,
  getCenterAdminStats,
  getDoctorStats,
  getReceptionistStats,
  getLabStats
} from '../controllers/dashboardController.js';

const router = express.Router();

// Dashboard statistics routes
router.get('/superadmin/stats', protect, getSuperAdminStats);
router.get('/centeradmin/stats', protect, getCenterAdminStats);
router.get('/doctor/stats', protect, getDoctorStats);
router.get('/receptionist/stats', protect, getReceptionistStats);
router.get('/lab/stats', protect, getLabStats);

export default router; 