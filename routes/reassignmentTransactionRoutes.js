import express from 'express';
import ReassignmentTransactionController from '../controllers/reassignmentTransactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Create a new reassignment transaction
router.post('/create', ReassignmentTransactionController.createTransaction);

// Get transaction by ID
router.get('/:transactionId', ReassignmentTransactionController.getTransaction);

// Update transaction status
router.patch('/:transactionId/status', ReassignmentTransactionController.updateTransactionStatus);

// Process refund for transaction
router.post('/:transactionId/refund', ReassignmentTransactionController.processRefund);

// Get all transactions with filtering and pagination
router.get('/', ReassignmentTransactionController.getTransactions);

// Get transaction statistics
router.get('/stats/summary', ReassignmentTransactionController.getTransactionStats);

export default router;
