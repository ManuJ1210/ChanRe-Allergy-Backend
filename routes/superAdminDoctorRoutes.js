import express from 'express';
import {
  getAllSuperAdminDoctors,
  addSuperAdminDoctor,
  deleteSuperAdminDoctor,
  getSuperAdminDoctorById,
  updateSuperAdminDoctor,
  toggleSuperAdminDoctorStatus,
  getSuperAdminDoctorStats,
  // Working functions
  getSuperAdminDoctorPatients,
  getSuperAdminDoctorAssignedPatients,
  getSuperAdminDoctorPatientById,
  getSuperAdminDoctorPatientHistory,
  getSuperAdminDoctorPatientFollowups,
  getSuperAdminDoctorPatientMedications,
  getSuperAdminDoctorPatientLabReports,
  createSuperAdminDoctorTestRequest,
  getSuperAdminDoctorTestRequests,
  getSuperAdminDoctorCompletedReports,
  getSuperAdminDoctorWorkingStats,
  // Lab Reports functionality
  getSuperAdminDoctorLabReports,
  sendFeedbackToCenterDoctor,
  // ✅ NEW: Test request review functionality
  getTestRequestsForReview,
  reviewTestRequest,
  getTestRequestStats,
  // Test endpoint
  testFollowupAPI
} from '../controllers/superAdminDoctorController.js';
import { protect, checkSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Working routes (for superadmin consultants to perform their duties) - Only protect, no checkSuperAdmin
router.get('/working/patients', protect, getSuperAdminDoctorPatients);
router.get('/working/assigned-patients', protect, getSuperAdminDoctorAssignedPatients);
router.get('/working/patient/:patientId', protect, getSuperAdminDoctorPatientById);
router.get('/working/patient/:patientId/history', protect, getSuperAdminDoctorPatientHistory);
router.get('/working/patient/:patientId/followups', protect, getSuperAdminDoctorPatientFollowups);
router.get('/working/patient/:patientId/medications', protect, getSuperAdminDoctorPatientMedications);
router.get('/working/patient/:patientId/lab-reports', protect, getSuperAdminDoctorPatientLabReports);
router.post('/working/test-request', protect, createSuperAdminDoctorTestRequest);
router.get('/working/test-requests', protect, getSuperAdminDoctorTestRequests);
router.get('/working/completed-reports', protect, getSuperAdminDoctorCompletedReports);
router.get('/working/stats', protect, getSuperAdminDoctorWorkingStats);
router.get('/working/lab-reports', protect, getSuperAdminDoctorLabReports);
router.post('/working/send-feedback', protect, sendFeedbackToCenterDoctor);

// Test endpoint for debugging
router.get('/working/test', protect, testFollowupAPI);

// ✅ NEW: Test request review routes for superadmin consultants
router.get('/working/test-requests-for-review', protect, getTestRequestsForReview);
router.post('/working/test-request/:testRequestId/review', protect, reviewTestRequest);
router.get('/working/test-request-stats', protect, getTestRequestStats);

// Management routes (for superadmin to manage superadmin consultants)
router.use(protect);
router.use(checkSuperAdmin);

router.get('/', getAllSuperAdminDoctors);
router.post('/', addSuperAdminDoctor);
router.get('/stats', getSuperAdminDoctorStats);
router.get('/:id', getSuperAdminDoctorById);
router.put('/:id', updateSuperAdminDoctor);
router.delete('/:id', deleteSuperAdminDoctor);
router.patch('/:id/toggle-status', toggleSuperAdminDoctorStatus);

export default router; 