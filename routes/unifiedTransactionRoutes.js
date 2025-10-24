import express from 'express';
import UnifiedTransactionController from '../controllers/unifiedTransactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Get all transactions from all collections with filtering and pagination
router.get('/all', UnifiedTransactionController.getAllTransactions);

// Get transaction dashboard data
router.get('/dashboard', UnifiedTransactionController.getTransactionDashboard);

// Get transaction statistics from all collections
router.get('/stats', UnifiedTransactionController.getTransactionStats);

// Get transaction by ID from any collection
router.get('/:transactionId', UnifiedTransactionController.getTransaction);

// Update transaction status across any collection
router.patch('/:transactionId/status', UnifiedTransactionController.updateTransactionStatus);

// Process refund for transaction across any collection
router.post('/:transactionId/refund', UnifiedTransactionController.processRefund);

export default router;
