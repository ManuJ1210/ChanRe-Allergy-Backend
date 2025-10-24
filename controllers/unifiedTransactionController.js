import TransactionService from '../services/transactionService.js';

/**
 * Unified controller for managing transactions across all billing types
 */
class UnifiedTransactionController {
  
  /**
   * Get all transactions from all collections with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllTransactions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        paymentMethod,
        transactionType,
        centerId,
        startDate,
        endDate,
        search
      } = req.query;

      const filters = {
        status,
        paymentMethod,
        centerId,
        startDate,
        endDate,
        search
      };

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await TransactionService.getAllTransactions(filters, pagination);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('❌ Error fetching all transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }

  /**
   * Get transaction statistics from all collections
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransactionStats(req, res) {
    try {
      const { centerId, startDate, endDate } = req.query;

      const filters = {
        centerId,
        startDate,
        endDate
      };

      const stats = await TransactionService.getTransactionStats(filters);

      res.json({
        success: true,
        ...stats
      });

    } catch (error) {
      console.error('❌ Error fetching transaction statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transaction statistics',
        error: error.message
      });
    }
  }

  /**
   * Get transaction by ID from any collection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;

      const transaction = await TransactionService.getTransaction(transactionId);

      res.json({
        success: true,
        transaction
      });

    } catch (error) {
      console.error('❌ Error fetching transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transaction',
        error: error.message
      });
    }
  }

  /**
   * Update transaction status across any collection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTransactionStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const { status, reason, notes } = req.body;

      const transaction = await TransactionService.updateTransactionStatus(
        transactionId,
        status,
        req.user,
        reason,
        notes
      );

      res.json({
        success: true,
        message: 'Transaction status updated successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update transaction status',
        error: error.message
      });
    }
  }

  /**
   * Process refund for transaction across any collection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processRefund(req, res) {
    try {
      const { transactionId } = req.params;
      const { amount, refundMethod, refundReason, notes, patientBehavior } = req.body;

      const refundData = {
        amount: parseFloat(amount),
        refundMethod,
        refundReason,
        notes,
        patientBehavior
      };

      const transaction = await TransactionService.processRefund(
        transactionId,
        refundData,
        req.user
      );

      res.json({
        success: true,
        message: 'Refund processed successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error processing refund:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error.message
      });
    }
  }

  /**
   * Get transaction dashboard data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransactionDashboard(req, res) {
    try {
      const { centerId, startDate, endDate } = req.query;

      const filters = {
        centerId,
        startDate,
        endDate
      };

      // Get statistics
      const stats = await TransactionService.getTransactionStats(filters);

      // Get recent transactions
      const recentTransactions = await TransactionService.getAllTransactions(filters, { page: 1, limit: 10 });

      // Get status breakdown
      const statusBreakdown = {
        pending: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        refunded: 0,
        partially_refunded: 0
      };

      recentTransactions.transactions.forEach(transaction => {
        if (statusBreakdown.hasOwnProperty(transaction.status)) {
          statusBreakdown[transaction.status]++;
        }
      });

      res.json({
        success: true,
        dashboard: {
          stats,
          recentTransactions: recentTransactions.transactions,
          statusBreakdown,
          pagination: recentTransactions.pagination
        }
      });

    } catch (error) {
      console.error('❌ Error fetching transaction dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transaction dashboard',
        error: error.message
      });
    }
  }
}

export default UnifiedTransactionController;
