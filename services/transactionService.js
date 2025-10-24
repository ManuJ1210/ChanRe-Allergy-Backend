import ReceiptTransaction from '../models/ReceiptTransaction.js';
import ConsultationTransaction from '../models/ConsultationTransaction.js';
import ReassignmentTransaction from '../models/ReassignmentTransaction.js';
import TestRequest from '../models/TestRequest.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

/**
 * Service for creating and managing transactions across different billing types
 */
class TransactionService {
  
  /**
   * Create a receipt transaction
   * @param {Object} data - Transaction data
   * @param {Object} user - User who processed the transaction
   * @returns {Object} Created transaction
   */
  static async createReceiptTransaction(data, user) {
    try {
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
        notes
      } = data;

      // Find test request and patient for additional data
      const [testRequest, patient] = await Promise.all([
        TestRequest.findById(testRequestId).select('centerName'),
        Patient.findById(patientId).select('name uhId')
      ]);

      if (!testRequest || !patient) {
        throw new Error('Test request or patient not found');
      }

      // Generate transaction ID manually as fallback
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      const transactionId = `RECEIPT-${timestamp}-${randomPart.toUpperCase()}`;

      const transactionData = {
        transactionId: transactionId, // Add transactionId manually
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
        processedBy: user._id,
        createdBy: user._id,
        status: 'completed', // Receipt transactions are typically completed when created
        metadata: {
          source: 'web'
        }
      };

      const transaction = new ReceiptTransaction(transactionData);
      await transaction.save();

      console.log('✅ Receipt transaction created:', transaction.transactionId);
      return transaction;

    } catch (error) {
      console.error('❌ Error creating receipt transaction:', error);
      throw error;
    }
  }

  /**
   * Create a consultation transaction
   * @param {Object} data - Transaction data
   * @param {Object} user - User who processed the transaction
   * @returns {Object} Created transaction
   */
  static async createConsultationTransaction(data, user) {
    try {
      const {
        patientId,
        doctorId,
        centerId,
        consultationType,
        appointmentDate,
        amount,
        paymentMethod,
        paymentType = 'full',
        invoiceNumber,
        paymentBreakdown,
        notes
      } = data;

      // Find patient and doctor for additional data
      const [patient, doctor] = await Promise.all([
        Patient.findById(patientId).select('name uhId centerId').populate('centerId', 'name'),
        User.findById(doctorId).select('name')
      ]);

      if (!patient || !doctor) {
        throw new Error('Patient or doctor not found');
      }

      console.log('🔍 Patient data:', {
        name: patient.name,
        centerId: patient.centerId,
        centerName: patient.centerId?.name
      });

      // If centerName is not available, try to get it from the centerId parameter
      let finalCenterName = patient.centerId?.name || 'Unknown Center';
      if (finalCenterName === 'Unknown Center' && centerId) {
        // Try to fetch center name from the centerId parameter
        try {
          const Center = (await import('../models/Center.js')).default;
          const center = await Center.findById(centerId).select('name');
          if (center) {
            finalCenterName = center.name;
          }
        } catch (error) {
          console.log('⚠️ Could not fetch center name from centerId:', error.message);
        }
      }

      // Generate transaction ID manually as fallback
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      const transactionId = `CONSULT-${timestamp}-${randomPart.toUpperCase()}`;

      const transactionData = {
        transactionId: transactionId, // Add transactionId manually
        patientId,
        patientName: patient.name,
        patientUhId: patient.uhId,
        doctorId,
        doctorName: doctor.name,
        centerId: patient.centerId?._id || patient.centerId || centerId,
        centerName: finalCenterName,
        consultationType,
        appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
        amount: parseFloat(amount),
        paymentMethod,
        paymentType,
        invoiceNumber,
        paymentBreakdown: paymentBreakdown || {
          registrationFee: 0,
          consultationFee: parseFloat(amount),
          serviceCharges: [],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        notes,
        processedBy: user._id,
        createdBy: user._id,
        status: 'completed', // Consultation transactions are typically completed when created
        metadata: {
          source: 'web'
        }
      };

      console.log('🔍 Transaction data before creation:', transactionData);
      
      const transaction = new ConsultationTransaction(transactionData);
      console.log('🔍 Transaction object created:', {
        transactionId: transaction.transactionId,
        patientName: transaction.patientName,
        doctorName: transaction.doctorName,
        centerName: transaction.centerName
      });
      
      await transaction.save();

      console.log('✅ Consultation transaction created:', transaction.transactionId);
      return transaction;

    } catch (error) {
      console.error('❌ Error creating consultation transaction:', error);
      throw error;
    }
  }

  /**
   * Create a reassignment transaction
   * @param {Object} data - Transaction data
   * @param {Object} user - User who processed the transaction
   * @returns {Object} Created transaction
   */
  static async createReassignmentTransaction(data, user) {
    try {
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
        amount = 0,
        paymentMethod = 'cash',
        paymentType = 'full',
        invoiceNumber,
        paymentBreakdown,
        isEligibleForFreeReassignment = false,
        firstConsultationDate,
        notes
      } = data;

      // Find patient and doctors for additional data
      const [patient, assignedDoctor, currentDoctor] = await Promise.all([
        Patient.findById(patientId).select('name uhId centerId').populate('centerId', 'name'),
        User.findById(assignedDoctorId).select('name'),
        User.findById(currentDoctorId).select('name')
      ]);

      if (!patient || !assignedDoctor || !currentDoctor) {
        throw new Error('Patient or doctor not found');
      }

      console.log('🔍 Reassignment patient data:', {
        name: patient.name,
        centerId: patient.centerId,
        centerName: patient.centerId?.name
      });

      // Generate transaction ID manually as fallback
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      const transactionId = `REASSIGN-${timestamp}-${randomPart.toUpperCase()}`;

      const transactionData = {
        transactionId: transactionId, // Add transactionId manually
        patientId,
        patientName: patient.name,
        patientUhId: patient.uhId,
        assignedDoctorId,
        assignedDoctorName: assignedDoctor.name,
        currentDoctorId,
        currentDoctorName: currentDoctor.name,
        centerId: patient.centerId?._id || patient.centerId || centerId,
        centerName: patient.centerId?.name || 'Unknown Center',
        reassignmentType,
        consultationType,
        reassignmentReason,
        reassignmentNotes,
        nextConsultationDate: nextConsultationDate ? new Date(nextConsultationDate) : null,
        amount: parseFloat(amount),
        paymentMethod,
        paymentType,
        invoiceNumber,
        paymentBreakdown: paymentBreakdown || {
          consultationFee: parseFloat(amount),
          serviceCharges: [],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        isEligibleForFreeReassignment,
        firstConsultationDate: firstConsultationDate ? new Date(firstConsultationDate) : null,
        notes,
        processedBy: user._id,
        createdBy: user._id,
        status: 'completed', // Reassignment transactions are typically completed when created
        metadata: {
          source: 'web',
          isReassignedEntry: true
        }
      };

      console.log('🔍 Reassignment transaction data before creation:', transactionData);
      
      const transaction = new ReassignmentTransaction(transactionData);
      console.log('🔍 Reassignment transaction object created:', {
        transactionId: transaction.transactionId,
        patientName: transaction.patientName,
        assignedDoctorName: transaction.assignedDoctorName,
        currentDoctorName: transaction.currentDoctorName,
        centerName: transaction.centerName
      });
      
      await transaction.save();

      console.log('✅ Reassignment transaction created:', transaction.transactionId);
      return transaction;

    } catch (error) {
      console.error('❌ Error creating reassignment transaction:', error);
      throw error;
    }
  }

  /**
   * Update transaction status
   * @param {String} transactionId - Transaction ID
   * @param {String} status - New status
   * @param {Object} user - User updating the status
   * @param {String} reason - Reason for status change
   * @param {String} notes - Additional notes
   * @returns {Object} Updated transaction
   */
  static async updateTransactionStatus(transactionId, status, user, reason, notes) {
    try {
      // Try to find transaction in all collections
      let transaction = await ReceiptTransaction.findOne({ transactionId });
      if (!transaction) {
        transaction = await ConsultationTransaction.findOne({ transactionId });
      }
      if (!transaction) {
        transaction = await ReassignmentTransaction.findOne({ transactionId });
      }

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      await transaction.updateStatus(status, user._id, reason, notes);

      console.log('✅ Transaction status updated:', transactionId, 'to', status);
      return transaction;

    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      throw error;
    }
  }

  /**
   * Process refund for transaction
   * @param {String} transactionId - Transaction ID
   * @param {Object} refundData - Refund data
   * @param {Object} user - User processing the refund
   * @returns {Object} Updated transaction
   */
  static async processRefund(transactionId, refundData, user) {
    try {
      // Try to find transaction in all collections
      let transaction = await ReceiptTransaction.findOne({ transactionId });
      if (!transaction) {
        transaction = await ConsultationTransaction.findOne({ transactionId });
      }
      if (!transaction) {
        transaction = await ReassignmentTransaction.findOne({ transactionId });
      }

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const refundPayload = {
        ...refundData,
        refundedBy: user._id
      };

      await transaction.addRefund(refundPayload);

      console.log('✅ Refund processed for transaction:', transactionId);
      return transaction;

    } catch (error) {
      console.error('❌ Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID from any collection
   * @param {String} transactionId - Transaction ID
   * @returns {Object} Transaction data
   */
  static async getTransaction(transactionId) {
    try {
      // Try to find transaction in all collections
      let transaction = await ReceiptTransaction.findOne({ transactionId })
        .populate('patientId', 'name uhId phone email')
        .populate('testRequestId', 'patientName centerName status')
        .populate('processedBy', 'name email')
        .populate('createdBy', 'name email');

      if (!transaction) {
        transaction = await ConsultationTransaction.findOne({ transactionId })
          .populate('patientId', 'name uhId phone email')
          .populate('doctorId', 'name email')
          .populate('processedBy', 'name email')
          .populate('createdBy', 'name email');
      }

      if (!transaction) {
        transaction = await ReassignmentTransaction.findOne({ transactionId })
          .populate('patientId', 'name uhId phone email')
          .populate('assignedDoctorId', 'name email')
          .populate('currentDoctorId', 'name email')
          .populate('processedBy', 'name email')
          .populate('createdBy', 'name email');
      }

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return transaction;

    } catch (error) {
      console.error('❌ Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * Get all transactions from all collections with filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Object} Transactions and pagination info
   */
  static async getAllTransactions(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      // Build base filter
      const baseFilter = {};
      if (filters.status) baseFilter.status = filters.status;
      if (filters.paymentMethod) baseFilter.paymentMethod = filters.paymentMethod;
      if (filters.centerId) baseFilter.centerId = filters.centerId;
      
      // Date range filter
      if (filters.startDate || filters.endDate) {
        baseFilter.createdAt = {};
        if (filters.startDate) baseFilter.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) baseFilter.createdAt.$lte = new Date(filters.endDate);
      }

      // Search filter
      if (filters.search) {
        baseFilter.$or = [
          { patientName: { $regex: filters.search, $options: 'i' } },
          { transactionId: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Get transactions from all collections
      const [receiptTransactions, consultationTransactions, reassignmentTransactions] = await Promise.all([
        ReceiptTransaction.find(baseFilter)
          .populate('patientId', 'name uhId phone email')
          .populate('testRequestId', 'patientName centerName status')
          .populate('processedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        
        ConsultationTransaction.find(baseFilter)
          .populate('patientId', 'name uhId phone email')
          .populate('doctorId', 'name email')
          .populate('processedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        
        ReassignmentTransaction.find(baseFilter)
          .populate('patientId', 'name uhId phone email')
          .populate('assignedDoctorId', 'name email')
          .populate('currentDoctorId', 'name email')
          .populate('processedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
      ]);

      // Combine all transactions
      const allTransactions = [
        ...receiptTransactions.map(t => ({ ...t.toObject(), transactionType: 'receipt' })),
        ...consultationTransactions.map(t => ({ ...t.toObject(), transactionType: 'consultation' })),
        ...reassignmentTransactions.map(t => ({ ...t.toObject(), transactionType: 'reassignment' }))
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Get total counts
      const [receiptTotal, consultationTotal, reassignmentTotal] = await Promise.all([
        ReceiptTransaction.countDocuments(baseFilter),
        ConsultationTransaction.countDocuments(baseFilter),
        ReassignmentTransaction.countDocuments(baseFilter)
      ]);

      const total = receiptTotal + consultationTotal + reassignmentTotal;

      return {
        transactions: allTransactions.slice(0, parseInt(limit)),
        pagination: {
          current: page,
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };

    } catch (error) {
      console.error('❌ Error fetching all transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction statistics from all collections
   * @param {Object} filters - Filter criteria
   * @returns {Object} Statistics
   */
  static async getTransactionStats(filters = {}) {
    try {
      // Build base filter
      const baseFilter = {};
      if (filters.centerId) baseFilter.centerId = filters.centerId;
      if (filters.startDate || filters.endDate) {
        baseFilter.createdAt = {};
        if (filters.startDate) baseFilter.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) baseFilter.createdAt.$lte = new Date(filters.endDate);
      }

      // Get statistics from all collections
      const [receiptStats, consultationStats, reassignmentStats] = await Promise.all([
        ReceiptTransaction.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalTransactions: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
              totalRefunded: { $sum: '$totalRefundedAmount' }
            }
          }
        ]),
        ConsultationTransaction.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalTransactions: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
              totalRefunded: { $sum: '$totalRefundedAmount' }
            }
          }
        ]),
        ReassignmentTransaction.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalTransactions: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
              totalRefunded: { $sum: '$totalRefundedAmount' }
            }
          }
        ])
      ]);

      // Combine statistics
      const combinedStats = {
        totalTransactions: (receiptStats[0]?.totalTransactions || 0) + 
                          (consultationStats[0]?.totalTransactions || 0) + 
                          (reassignmentStats[0]?.totalTransactions || 0),
        totalAmount: (receiptStats[0]?.totalAmount || 0) + 
                    (consultationStats[0]?.totalAmount || 0) + 
                    (reassignmentStats[0]?.totalAmount || 0),
        totalRefunded: (receiptStats[0]?.totalRefunded || 0) + 
                      (consultationStats[0]?.totalRefunded || 0) + 
                      (reassignmentStats[0]?.totalRefunded || 0),
        receiptTransactions: receiptStats[0] || { totalTransactions: 0, totalAmount: 0, totalRefunded: 0 },
        consultationTransactions: consultationStats[0] || { totalTransactions: 0, totalAmount: 0, totalRefunded: 0 },
        reassignmentTransactions: reassignmentStats[0] || { totalTransactions: 0, totalAmount: 0, totalRefunded: 0 }
      };

      return combinedStats;

    } catch (error) {
      console.error('❌ Error fetching transaction statistics:', error);
      throw error;
    }
  }
}

export default TransactionService;
