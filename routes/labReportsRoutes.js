import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getAllLabReports,
  getLabReportsByCenter,
  getLabReportById,
  getLabReportsStats
} from '../controllers/labReportsController.js';

const router = express.Router();

// All routes are protected and require authentication
router.use(protect);

// Get all lab reports (for superadmin)
router.get('/', getAllLabReports);

// Get lab reports by center
router.get('/center/:centerId', getLabReportsByCenter);

// Get single lab report by ID
router.get('/:id', getLabReportById);

// Get lab reports statistics
router.get('/stats/overview', getLabReportsStats);

export default router; 