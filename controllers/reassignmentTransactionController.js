import ReassignmentTransaction from '../models/ReassignmentTransaction.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

/**
 * Controller for handling reassignment transaction operations
 */
class ReassignmentTransactionController {
  
  /**
   * Create a new reassignment transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createTransaction(req, res) {
    try {
      console.log('🚀 Creating reassignment transaction:', req.body);
      
      const {
        patientId,
        assignedDoctorId,
        currentDoctorId,
        centerId,
        reassignmentType = 'regular',
        consultationType,
        reassignmentReason,
        reassignmentNotes,
        nextConsultationDate,
        amount,
        paymentMethod,
        paymentType = 'full',
        invoiceNumber,
        paymentBreakdown,
        isEligibleForFreeReassignment,
        firstConsultationDate,
        notes,
        processedBy
      } = req.body;

      // Validate required fields
      if (!patientId || !assignedDoctorId || !currentDoctorId || !centerId || !consultationType || !reassignmentReason) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: patientId, assignedDoctorId, currentDoctorId, centerId, consultationType, reassignmentReason'
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

      // Find and validate assigned doctor
      const assignedDoctor = await User.findById(assignedDoctorId);
      if (!assignedDoctor) {
        return res.status(404).json({
          success: false,
          message: 'Assigned doctor not found'
        });
      }

      // Find and validate current doctor
      const currentDoctor = await User.findById(currentDoctorId);
      if (!currentDoctor) {
        return res.status(404).json({
          success: false,
          message: 'Current doctor not found'
        });
      }

      // Create transaction data
      const transactionData = {
        patientId,
        patientName: patient.name,
        patientUhId: patient.uhId,
        assignedDoctorId,
        assignedDoctorName: assignedDoctor.name,
        currentDoctorId,
        currentDoctorName: currentDoctor.name,
        centerId,
        centerName: patient.centerId?.name || 'Unknown Center',
        reassignmentType,
        consultationType,
        reassignmentReason,
        reassignmentNotes,
        nextConsultationDate: nextConsultationDate ? new Date(nextConsultationDate) : null,
        amount: parseFloat(amount) || 0,
        paymentMethod,
        paymentType,
        invoiceNumber,
        paymentBreakdown: paymentBreakdown || {
          consultationFee: parseFloat(amount) || 0,
          serviceCharges: [],
          subtotal: parseFloat(amount) || 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount) || 0
        },
        isEligibleForFreeReassignment: isEligibleForFreeReassignment || false,
        firstConsultationDate: firstConsultationDate ? new Date(firstConsultationDate) : null,
        notes,
        processedBy: processedBy || req.user._id,
        createdBy: req.user._id,
        status: 'pending',
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          source: 'web',
          isReassignedEntry: true
        }
      };

      // Create transaction
      const transaction = new ReassignmentTransaction(transactionData);
      await transaction.save();

      console.log('✅ Reassignment transaction created:', transaction.transactionId);

      res.status(201).json({
        success: true,
        message: 'Reassignment transaction created successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error creating reassignment transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create reassignment transaction',
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
      const transaction = await ReassignmentTransaction.findOne({ transactionId });
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
      const { amount, refundMethod, refundReason, notes, patientBehavior = 'okay' } = req.body;

      // Find transaction
      const transaction = await ReassignmentTransaction.findOne({ transactionId });
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
        notes,
        patientBehavior
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

      const transaction = await ReassignmentTransaction.findOne({ transactionId })
        .populate('patientId', 'name uhId phone email')
        .populate('assignedDoctorId', 'name email')
        .populate('currentDoctorId', 'name email')
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
        reassignmentType,
        consultationType,
        centerId,
        assignedDoctorId,
        currentDoctorId,
        startDate,
        endDate,
        search
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (status) filter.status = status;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (reassignmentType) filter.reassignmentType = reassignmentType;
      if (consultationType) filter.consultationType = consultationType;
      if (centerId) filter.centerId = centerId;
      if (assignedDoctorId) filter.assignedDoctorId = assignedDoctorId;
      if (currentDoctorId) filter.currentDoctorId = currentDoctorId;
      
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
          { assignedDoctorName: { $regex: search, $options: 'i' } },
          { currentDoctorName: { $regex: search, $options: 'i' } },
          { transactionId: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      const transactions = await ReassignmentTransaction.find(filter)
        .populate('patientId', 'name uhId phone email')
        .populate('assignedDoctorId', 'name email')
        .populate('currentDoctorId', 'name email')
        .populate('processedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await ReassignmentTransaction.countDocuments(filter);

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
      const { centerId, assignedDoctorId, currentDoctorId, startDate, endDate } = req.query;

      // Build filter object
      const filter = {};
      if (centerId) filter.centerId = centerId;
      if (assignedDoctorId) filter.assignedDoctorId = assignedDoctorId;
      if (currentDoctorId) filter.currentDoctorId = currentDoctorId;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Get statistics
      const stats = await ReassignmentTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalRefunded: { $sum: '$totalRefundedAmount' },
            freeReassignments: {
              $sum: {
                $cond: [{ $eq: ['$isEligibleForFreeReassignment', true] }, 1, 0]
              }
            },
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
      const statusBreakdown = await ReassignmentTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ]);

      // Get reassignment type breakdown
      const reassignmentTypeBreakdown = await ReassignmentTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$reassignmentType',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ]);

      // Get doctor breakdown
      const doctorBreakdown = await ReassignmentTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$currentDoctorId',
            doctorName: { $first: '$currentDoctorName' },
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
          freeReassignments: 0,
          pendingAmount: 0,
          completedAmount: 0,
          cancelledAmount: 0
        },
        statusBreakdown,
        reassignmentTypeBreakdown,
        doctorBreakdown
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

export default ReassignmentTransactionController;
