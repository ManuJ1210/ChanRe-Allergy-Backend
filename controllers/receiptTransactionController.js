import ReceiptTransaction from '../models/ReceiptTransaction.js';
import TestRequest from '../models/TestRequest.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

/**
 * Controller for handling receipt transaction operations
 */
class ReceiptTransactionController {
  
  /**
   * Create a new receipt transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createTransaction(req, res) {
    try {
      console.log('🚀 Creating receipt transaction:', req.body);
      
      const {
        testRequestId,
        patientId,
        centerId,
        amount,
        paymentMethod,
        paymentType = 'full',
        receiptNumber,
        receiptFile,
        invoiceNumber,
        paymentBreakdown,
        notes,
        processedBy
      } = req.body;

      // Validate required fields
      if (!testRequestId || !patientId || !centerId || !amount || !paymentMethod || !receiptNumber) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: testRequestId, patientId, centerId, amount, paymentMethod, receiptNumber'
        });
      }

      // Find and validate test request
      const testRequest = await TestRequest.findById(testRequestId);
      if (!testRequest) {
        return res.status(404).json({
          success: false,
          message: 'Test request not found'
        });
      }

      // Find and validate patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Create transaction data
      const transactionData = {
        testRequestId,
        patientId,
        patientName: patient.name,
        patientUhId: patient.uhId,
        centerId,
        centerName: testRequest.centerName || 'Unknown Center',
        amount: parseFloat(amount),
        paymentMethod,
        paymentType,
        receiptNumber,
        receiptFile,
        invoiceNumber,
        paymentBreakdown: paymentBreakdown || {
          items: [],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        notes,
        processedBy: processedBy || req.user._id,
        createdBy: req.user._id,
        status: 'pending',
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          source: 'web'
        }
      };

      // Create transaction
      const transaction = new ReceiptTransaction(transactionData);
      await transaction.save();

      console.log('✅ Receipt transaction created:', transaction.transactionId);

      res.status(201).json({
        success: true,
        message: 'Receipt transaction created successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error creating receipt transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create receipt transaction',
        error: error.message
      });
    }
  }

  /**
   * Update transaction status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTransactionStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const { status, reason, notes } = req.body;

      // Validate status
      const validStatuses = ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      // Find transaction
      const transaction = await ReceiptTransaction.findOne({ transactionId });
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Update status
      await transaction.updateStatus(status, req.user._id, reason, notes);

      console.log('✅ Transaction status updated:', transactionId, 'to', status);

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
   * Process refund for transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processRefund(req, res) {
    try {
      const { transactionId } = req.params;
      const { amount, refundMethod, refundReason, notes } = req.body;

      // Find transaction
      const transaction = await ReceiptTransaction.findOne({ transactionId });
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Validate refund amount
      if (amount > transaction.remainingRefundAmount) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount exceeds remaining refundable amount'
        });
      }

      // Process refund
      const refundData = {
        amount: parseFloat(amount),
        refundMethod,
        refundReason,
        refundedBy: req.user._id,
        notes
      };

      await transaction.addRefund(refundData);

      console.log('✅ Refund processed for transaction:', transactionId);

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
   * Get transaction by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;

      const transaction = await ReceiptTransaction.findOne({ transactionId })
        .populate('patientId', 'name uhId phone email')
        .populate('testRequestId', 'patientName centerName status')
        .populate('processedBy', 'name email')
        .populate('createdBy', 'name email');

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

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
   * Get all transactions with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransactions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        paymentMethod,
        centerId,
        startDate,
        endDate,
        search
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (status) filter.status = status;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (centerId) filter.centerId = centerId;
      
      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Search filter
      if (search) {
        filter.$or = [
          { patientName: { $regex: search, $options: 'i' } },
          { patientUhId: { $regex: search, $options: 'i' } },
          { receiptNumber: { $regex: search, $options: 'i' } },
          { transactionId: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      const transactions = await ReceiptTransaction.find(filter)
        .populate('patientId', 'name uhId phone email')
        .populate('testRequestId', 'patientName centerName status')
        .populate('processedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await ReceiptTransaction.countDocuments(filter);

      res.json({
        success: true,
        transactions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transactions',
        error: error.message
      });
    }
  }

  /**
   * Get transaction statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTransactionStats(req, res) {
    try {
      const { centerId, startDate, endDate } = req.query;

      // Build filter object
      const filter = {};
      if (centerId) filter.centerId = centerId;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Get statistics
      const stats = await ReceiptTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalRefunded: { $sum: '$totalRefundedAmount' },
            pendingAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
              }
            },
            completedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
              }
            },
            cancelledAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'cancelled'] }, '$amount', 0]
              }
            }
          }
        }
      ]);

      // Get status breakdown
      const statusBreakdown = await ReceiptTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ]);

      // Get payment method breakdown
      const paymentMethodBreakdown = await ReceiptTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ]);

      res.json({
        success: true,
        stats: stats[0] || {
          totalTransactions: 0,
          totalAmount: 0,
          totalRefunded: 0,
          pendingAmount: 0,
          completedAmount: 0,
          cancelledAmount: 0
        },
        statusBreakdown,
        paymentMethodBreakdown
      });

    } catch (error) {
      console.error('❌ Error fetching transaction stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch transaction statistics',
        error: error.message
      });
    }
  }
}

export default ReceiptTransactionController;
