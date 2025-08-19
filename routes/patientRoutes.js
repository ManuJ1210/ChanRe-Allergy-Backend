import express from 'express';
import {
  addPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  addTestToPatient,
  getPatientAndTests,
  getPatientsByReceptionist,
  getPatientsByDoctor
} from '../controllers/patientController.js';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
// Apply center isolation middleware to ensure data security
router.use(ensureCenterIsolation);

// Patient Routes
router.post('/', addPatient);
router.get('/', getPatients);
router.get('/receptionist/mine', getPatientsByReceptionist);
router.get('/doctor/:doctorId', getPatientsByDoctor);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

// Test Routes for Patient
router.post('/:id/tests', addTestToPatient);
router.get('/:id/show-tests', getPatientAndTests);

export default router;
