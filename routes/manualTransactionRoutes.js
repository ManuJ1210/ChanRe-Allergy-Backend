import express from 'express';
import ManualTransactionController from '../controllers/manualTransactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Create manual consultation transaction
router.post('/consultation', ManualTransactionController.createConsultationTransaction);

// Create manual receipt transaction
router.post('/receipt', ManualTransactionController.createReceiptTransaction);

// Create manual reassignment transaction
router.post('/reassignment', ManualTransactionController.createReassignmentTransaction);

// Get all transactions for a specific patient
router.get('/patient/:patientId', ManualTransactionController.getPatientTransactions);

export default router;
