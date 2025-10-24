import express from 'express';
import ReceiptTransactionController from '../controllers/receiptTransactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Create a new receipt transaction
router.post('/create', ReceiptTransactionController.createTransaction);

// Get transaction by ID
router.get('/:transactionId', ReceiptTransactionController.getTransaction);

// Update transaction status
router.patch('/:transactionId/status', ReceiptTransactionController.updateTransactionStatus);

// Process refund for transaction
router.post('/:transactionId/refund', ReceiptTransactionController.processRefund);

// Get all transactions with filtering and pagination
router.get('/', ReceiptTransactionController.getTransactions);

// Get transaction statistics
router.get('/stats/summary', ReceiptTransactionController.getTransactionStats);

export default router;
