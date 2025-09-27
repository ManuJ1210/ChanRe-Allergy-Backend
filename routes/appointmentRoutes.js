import express from 'express';
import { 
  markViewed, 
  markMissed, 
  getStats, 
  checkMissed 
} from '../controllers/appointmentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Mark appointment as viewed by doctor
router.post('/mark-viewed/:patientId', protect, markViewed);

// Mark appointment as missed
router.post('/mark-missed/:patientId', protect, markMissed);

// Get appointment statistics
router.get('/stats', protect, getStats);

// Check for missed appointments (admin only)
router.post('/check-missed', protect, checkMissed);

export default router;
