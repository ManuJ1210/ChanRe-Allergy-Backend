import express from 'express';
import {
  addDoctor,
  getAllDoctors,
  deleteDoctor,
  getDoctorById,
  updateDoctor,
  getAssignedPatients,
  getPatientDetails,
  addTestRequest,
  getTestRequests,
  getDoctorStats
} from '../controllers/doctorController.js';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply center isolation middleware to all routes
router.use(protect);
router.use(ensureCenterIsolation);

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log('🔍 Doctor route accessed:', {
    method: req.method,
    path: req.path,
    userId: req.user?._id,
    userRole: req.user?.role,
    userType: req.user?.userType,
    centerId: req.user?.centerId
  });
  next();
});

// Doctor-specific routes (for doctors to manage their patients) - PUT THESE FIRST
router.get('/assigned-patients', getAssignedPatients);
router.get('/test-requests', getTestRequests);
router.get('/patient/:patientId', getPatientDetails);
router.post('/patient/:patientId/test-request', addTestRequest);

// Admin routes (for center admin to manage doctors) - PUT THESE AFTER
router.get('/stats', getDoctorStats);
router.post('/', addDoctor);
router.get('/', getAllDoctors);
router.get('/:id', getDoctorById);
router.delete('/:id', deleteDoctor);
router.put('/:id', updateDoctor);

export default router;
