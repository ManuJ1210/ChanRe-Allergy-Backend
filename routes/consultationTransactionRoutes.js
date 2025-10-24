import express from 'express';
import ConsultationTransactionController from '../controllers/consultationTransactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Create a new consultation transaction
router.post('/create', ConsultationTransactionController.createTransaction);

// Get transaction by ID
router.get('/:transactionId', ConsultationTransactionController.getTransaction);

// Update transaction status
router.patch('/:transactionId/status', ConsultationTransactionController.updateTransactionStatus);

// Process refund for transaction
router.post('/:transactionId/refund', ConsultationTransactionController.processRefund);

// Get all transactions with filtering and pagination
router.get('/', ConsultationTransactionController.getTransactions);

// Get transaction statistics
router.get('/stats/summary', ConsultationTransactionController.getTransactionStats);

export default router;
