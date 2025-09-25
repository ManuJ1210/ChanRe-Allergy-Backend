import express from 'express';
import ReassignedPatientController from '../controllers/reassignedPatientController.js';

const router = express.Router();

// Get reassigned patients for a specific doctor
router.get('/doctor/:doctorId', ReassignedPatientController.getReassignedPatientsForDoctor);

// Analyze patient reassignment status
router.get('/analyze/:patientId/:doctorId', ReassignedPatientController.analyzePatientReassignment);

// Get billing status for reassigned patient
router.get('/billing-status/:patientId/:doctorId', ReassignedPatientController.getReassignedPatientBillingStatus);

// Create consultation fee for reassigned patient
router.post('/consultation-fee/:patientId/:doctorId', ReassignedPatientController.createConsultationFeeForReassignedPatient);

// Get all patients with reassignment analysis
router.get('/all-patients', ReassignedPatientController.getAllPatientsWithReassignmentAnalysis);

export default router;
