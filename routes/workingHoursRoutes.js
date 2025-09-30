import express from 'express';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';
import { 
  checkWorkingHoursViolations, 
  getWorkingHoursInfo, 
  reassignWithCustomDate 
} from '../controllers/workingHoursController.js';

const router = express.Router();

// All routes require authentication and center isolation
router.use(protect);
router.use(ensureCenterIsolation);

// Check for working hours violations
router.post('/check-violations', checkWorkingHoursViolations);

// Get working hours status and violation count
router.get('/status', getWorkingHoursInfo);

// Reassign patient with custom consultation date (no billing)
router.post('/reassign-custom-date', reassignWithCustomDate);

export default router;
