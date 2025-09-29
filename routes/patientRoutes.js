import express from 'express';
import {
  addPatient,
  getPatients,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  addTestToPatient,
  getPatientAndTests,
  getPatientsByReceptionist,
  getPatientsByDoctor,
  getPatientHistory,
  getPatientMedications,
  getPatientFollowUps,
  addSampleData,
  testEndpoint,
  markPatientAsViewed,
  reassignDoctor,
  autoReassignUnviewedPatients,
  recordPatientRevisit
} from '../controllers/patientController.js';
import { protect, ensureCenterIsolation, ensureDoctor, ensureDoctorOrReceptionist, ensureCenterStaffOrDoctor } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
// Apply center isolation middleware to ensure data security
router.use(ensureCenterIsolation);

// Patient Routes - Center admin, center receptionist, and center doctor can create patients
router.post('/', ensureCenterStaffOrDoctor, addPatient);
router.get('/all', getAllPatients); // Special route for superadmin to get all patients
router.get('/', getPatients);
router.get('/receptionist/mine', getPatientsByReceptionist);
router.get('/doctor/:doctorId', getPatientsByDoctor);
router.get('/:id', getPatientById);
// Center admin, center receptionist, and center doctor can update/delete patients
router.put('/:id', ensureCenterStaffOrDoctor, updatePatient);
router.delete('/:id', ensureCenterStaffOrDoctor, deletePatient);

// Test Routes for Patient - Center admin, center receptionist, and center doctor can add tests
router.post('/:id/tests', ensureCenterStaffOrDoctor, addTestToPatient);
router.get('/:id/show-tests', getPatientAndTests);

// Patient Data Routes - Center admin, center receptionist, and center doctor can access
router.get('/:id/history', ensureCenterStaffOrDoctor, getPatientHistory);
router.get('/:id/medications', ensureCenterStaffOrDoctor, getPatientMedications);
router.get('/:id/follow-ups', ensureCenterStaffOrDoctor, getPatientFollowUps);

// Doctor-specific routes
router.put('/:patientId/mark-viewed', ensureDoctor, markPatientAsViewed);

// Reassignment and revisit routes
router.put('/:patientId/reassign-doctor', ensureCenterStaffOrDoctor, reassignDoctor);
router.post('/auto-reassign-unviewed', ensureCenterStaffOrDoctor, autoReassignUnviewedPatients);
router.post('/:patientId/record-revisit', ensureCenterStaffOrDoctor, recordPatientRevisit);

// Temporary route for adding sample data (remove in production)
router.post('/:id/add-sample-data', ensureCenterStaffOrDoctor, addSampleData);

// Test endpoint (remove in production)
router.get('/test', testEndpoint);

export default router;
