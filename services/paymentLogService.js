import PaymentLog from '../models/PaymentLog.js';
import TestRequest from '../models/TestRequest.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Center from '../models/Center.js';

/**
 * Payment Logging Service
 * Handles logging of all payment transactions including billing updates
 */

/**
 * Log a payment transaction
 * @param {Object} paymentData - Payment data
 * @param {ObjectId} testRequestId - Test request ID
 * @param {ObjectId} userId - User ID who processed the payment
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created payment log
 */
export const logPaymentTransaction = async (paymentData, testRequestId, userId, metadata = {}) => {
  try {
    console.log('🔍 Logging payment transaction:', {
      testRequestId,
      userId,
      paymentData,
      metadata
    });

    // Get test request details for payment context
    const testRequest = await TestRequest.findById(testRequestId)
      .populate('patientId', 'name uhId phone')
      .populate('centerId', 'name code');
    
    if (!testRequest) {
      throw new Error(`Test request ${testRequestId} not found`);
    }

    // Extract payment information
    const {
      amount,
      paymentMethod = 'cash',
      paymentType = 'test',
      transactionId,
      externalTransactionId,
      receiptNumber,
      receiptFile,
      notes,
      verificationNotes,
      paymentGateway,
      status = 'completed'
    } = paymentData;

    // Prepare payment log entry
    const paymentLogEntry = {
      testRequestId,
      patientId: testRequest.patientId?._id || testRequest.patientId,
      patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
      centerId: testRequest.centerId?._id || testRequest.centerId,
      centerName: testRequest.centerName || testRequest.centerId?.name || 'Unknown Center',
      amount,
      currency: paymentData.currency || 'INR',
      paymentType,
      paymentMethod,
      status,
      externalTransactionId,
      paymentGateway,
      receiptNumber,
      receiptFile,
      notes,
      verificationNotes,
      processedBy: userId,
      createdBy: userId,
      metadata: {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        source: metadata.source || 'web',
        isReassignedEntry: paymentData.isReassignedEntry || false,
        reassignedEntryId: paymentData.reassignedEntryId,
        ...metadata
      },
      billingId: paymentData.billingId,
      invoiceNumber: testRequest.billing?.invoiceNumber,
      transactionId: transactionId || null,
      verified: metadata.verified || false,
      verifiedBy: metadata.verifiedBy,
      verifiedAt: metadata.verifiedAt
    };

    // Add status change reason for initial entry
    paymentLogEntry.statusHistory = [{
      status,
      changedAt: new Date(),
      changedBy: userId,
      reason: 'Payment logged',
      notes: 'Initial payment record created'
    }];

    console.log('💾 Creating payment log entry:', {
      transactionId: paymentLogEntry.transactionId,
      amount,
      paymentMethod,
      status
    });

    const paymentLog = new PaymentLog(paymentLogEntry);
    const savedPaymentLog = await paymentLog.save();
    
    console.log('✅ Payment logged successfully:', savedPaymentLog._id);
    
    return savedPaymentLog;
  } catch (error) {
    console.error('❌ Error logging payment transaction:', error);
    throw error;
  }
};

/**
 * Log a payment status update
 * @param {ObjectId} testRequestId - Test request ID
 * @param {String} oldStatus - Previous status
 * @param {String} newStatus - New status
 * @param {ObjectId} userId - User ID updating status
 * @param {String} reason - Reason for status change
 * @param {String} notes - Additional notes
 */
export const logPaymentStatusUpdate = async (testRequestId, oldStatus, newStatus, userId, reason, notes) => {
  try {
    console.log('🔍 Logging payment status update:', {
      testRequestId,
      oldStatus,
      newStatus,
      userId,
      reason
    });

    // Find the most recent payment log for this test request
    const existingPaymentLog = await PaymentLog.findOne({ 
      testRequestId,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 });

    if (existingPaymentLog) {
      await existingPaymentLog.updateStatus(newStatus, userId, reason, notes);
      console.log('✅ Payment status updated successfully');
      return existingPaymentLog;
    } else {
      console.log('⚠️ No existing payment log found for test request:', testRequestId);
      return null;
    }
  } catch (error) {
    console.error('❌ Error logging payment status update:', error);
    throw error;
  }
};

/**
 * Log a payment cancellation
 * @param {ObjectId} testRequestId - Test request ID  
 * @param {ObjectId} userId - User ID cancelling payment
 * @param {String} cancellationReason - Reason for cancellation
 */
export const logPaymentCancellation = async (testRequestId, userId, cancellationReason) => {
  try {
    console.log('🔍 Logging payment cancellation:', {
      testRequestId,
      userId,
      cancellationReason
    });

    // Find all payment logs for this test request
    const paymentLogs = await PaymentLog.find({ 
      testRequestId,
      status: { $ne: 'cancelled' }
    });

    for (const paymentLog of paymentLogs) {
      await paymentLog.updateStatus(
        'cancelled', 
        userId, 
        'Payment cancelled',
        `Cancellation reason: ${cancellationReason}`
      );
    }

    console.log(`✅ Cancelled ${paymentLogs.length} payment logs`);
    return paymentLogs;
  } catch (error) {
    console.error('❌ Error logging payment cancellation:', error);
    throw error;
  }
};

/**
 * Log a payment refund
 * @param {ObjectId} testRequestId - Test request ID
 * @param {Number} refundAmount - Refund amount
 * @param {ObjectId} userId - User ID processing refund
 * @param {String} refundReason - Reason for refund
 * @param {String} externalRefundId - External refund transaction ID
 */
export const logPaymentRefund = async (testRequestId, refundAmount, userId, refundReason, externalRefundId = null) => {
  try {
    console.log('🔍 Logging payment refund:', {
      testRequestId,
      refundAmount,
      userId,
      refundReason,
      externalRefundId
    });

    const paymentLog = await PaymentLog.findOne({ 
      testRequestId,
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (!paymentLog) {
      console.log('⚠️ No completed payment log found for refund, but refund was processed successfully');
      console.log('⚠️ This might be because the original payment log creation failed due to validation errors');
      return null; // Return null instead of throwing error
    }

    // Update refund information
    paymentLog.refund = {
      refundedAmount: refundAmount,
      refundedAt: new Date(),
      refundedBy: userId,
      refundReason,
      externalRefundId
    };

    await paymentLog.updateStatus('refunded', userId, 'Payment refunded', `Refund amount: ${refundAmount}`);
    
    console.log('✅ Payment refund logged successfully');
    return paymentLog;
  } catch (error) {
    console.error('❌ Error logging payment refund:', error);
    throw error;
  }
};

/**
 * Log patient billing payment (for consultation, registration, service charges)
 * @param {ObjectId} patientId - Patient ID
 * @param {Object} paymentData - Payment data
 * @param {ObjectId} userId - User ID processing payment
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created payment log
 */
export const logPatientBillingPayment = async (patientId, paymentData, userId, metadata = {}) => {
  try {
    console.log('🔍 Logging patient billing payment:', {
      patientId,
      userId,
      paymentData,
      metadata
    });

    // Get patient details for payment context
    const patient = await Patient.findById(patientId)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name email');
    
    if (!patient) {
      throw new Error(`Patient ${patientId} not found`);
    }

    // Extract payment information
    const {
      amount,
      paymentMethod = 'cash',
      paymentType = 'consultation',
      transactionId,
      externalTransactionId,
      receiptNumber,
      receiptFile,
      notes,
      verificationNotes,
      paymentGateway,
      status = 'completed',
      invoiceNumber,
      billingId,
      consultationType = 'OP',
      appointmentTime,
      isReassignedEntry = false,
      reassignedEntryId
    } = paymentData;

    // Generate transaction ID if not provided
    const finalTransactionId = transactionId || (() => {
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      return `PAY-${timestamp}-${randomPart.toUpperCase()}`;
    })();

    // Prepare payment log entry
    const paymentLogEntry = {
      testRequestId: null, // No test request for patient billing
      patientId: patient._id,
      patientName: patient.name,
      centerId: patient.centerId?._id || patient.centerId,
      centerName: patient.centerId?.name || 'Unknown Center',
      amount,
      currency: paymentData.currency || 'INR',
      paymentType,
      paymentMethod,
      status,
      externalTransactionId,
      paymentGateway,
      receiptNumber,
      receiptFile,
      notes,
      verificationNotes,
      processedBy: userId,
      createdBy: userId,
      metadata: {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        source: metadata.source || 'web',
        isReassignedEntry,
        reassignedEntryId,
        consultationType,
        appointmentTime,
        ...metadata
      },
      billingId,
      invoiceNumber,
      transactionId: finalTransactionId,
      verified: metadata.verified || false,
      verifiedBy: metadata.verifiedBy,
      verifiedAt: metadata.verifiedAt
    };

    // Add status change reason for initial entry
    paymentLogEntry.statusHistory = [{
      status,
      changedAt: new Date(),
      changedBy: userId,
      reason: 'Patient billing payment logged',
      notes: `Payment for ${paymentType} - ${notes || 'No additional notes'}`
    }];

    console.log('💾 Creating patient billing payment log entry:', {
      transactionId: paymentLogEntry.transactionId,
      amount,
      paymentMethod,
      status,
      paymentType
    });

    const paymentLog = new PaymentLog(paymentLogEntry);
    const savedPaymentLog = await paymentLog.save();
    
    console.log('✅ Patient billing payment logged successfully:', savedPaymentLog._id);
    
    return savedPaymentLog;
  } catch (error) {
    console.error('❌ Error logging patient billing payment:', error);
    throw error;
  }
};

/**
 * Log patient billing refund
 * @param {ObjectId} patientId - Patient ID
 * @param {Number} refundAmount - Refund amount
 * @param {String} refundMethod - Refund method
 * @param {String} refundReason - Reason for refund
 * @param {ObjectId} userId - User ID processing refund
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Updated payment log
 */
export const logPatientBillingRefund = async (patientId, refundAmount, refundMethod, refundReason, userId, metadata = {}) => {
  try {
    console.log('🔍 Logging patient billing refund:', {
      patientId,
      refundAmount,
      refundMethod,
      refundReason,
      userId
    });

    // Find the most recent payment log for this patient
    const paymentLog = await PaymentLog.findOne({ 
      patientId,
      testRequestId: null, // Patient billing payments have null testRequestId
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (!paymentLog) {
      console.log('⚠️ No completed payment log found for refund, but refund was processed successfully');
      console.log('⚠️ This might be because the original payment log creation failed due to validation errors');
      return null; // Return null instead of throwing error
    }

    // Update refund information
    paymentLog.refund = {
      refundedAmount: refundAmount,
      refundedAt: new Date(),
      refundedBy: userId,
      refundReason,
      refundMethod,
      externalRefundId: metadata.externalRefundId
    };

    await paymentLog.updateStatus('refunded', userId, 'Payment refunded', `Refund amount: ${refundAmount}, Method: ${refundMethod}, Reason: ${refundReason}`);
    
    console.log('✅ Patient billing refund logged successfully');
    return paymentLog;
  } catch (error) {
    console.error('❌ Error logging patient billing refund:', error);
    throw error;
  }
};

/**
 * Log patient billing cancellation
 * @param {ObjectId} patientId - Patient ID
 * @param {String} cancellationReason - Reason for cancellation
 * @param {ObjectId} userId - User ID cancelling payment
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Array>} Updated payment logs
 */
export const logPatientBillingCancellation = async (patientId, cancellationReason, userId, metadata = {}) => {
  try {
    console.log('🔍 Logging patient billing cancellation:', {
      patientId,
      cancellationReason,
      userId
    });

    // Find all payment logs for this patient
    const paymentLogs = await PaymentLog.find({ 
      patientId,
      testRequestId: null, // Patient billing payments have null testRequestId
      status: { $ne: 'cancelled' }
    });

    for (const paymentLog of paymentLogs) {
      await paymentLog.updateStatus(
        'cancelled', 
        userId, 
        'Payment cancelled',
        `Cancellation reason: ${cancellationReason}`
      );
    }

    console.log(`✅ Cancelled ${paymentLogs.length} patient billing payment logs`);
    return paymentLogs;
  } catch (error) {
    console.error('❌ Error logging patient billing cancellation:', error);
    throw error;
  }
};

/**
 * Log partial payment (for existing billing records)
 * @param {ObjectId} testRequestId - Test request ID
 * @param {Number} paymentAmount - Payment amount being added
 * @param {String} paymentMethod - Payment method
 * @param {ObjectId} userId - User ID processing payment
 */
export const logPartialPayment = async (testRequestId, paymentAmount, paymentMethod, userId, metadata = {}) => {
  try {
    console.log('🔍 Logging partial payment:', {
      testRequestId,
      paymentAmount,
      paymentMethod,
      userId
    });

    // Get current test request
    const testRequest = await TestRequest.findById(testRequestId);
    if (!testRequest) {
      throw new Error('Test request not found');
    }

    // Calculate current payment totals
    const existingLogs = await PaymentLog.find({ 
      testRequestId,
      status: { $in: ['completed', 'processing'] }
    });

    const totalPaid = existingLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
    const currentPaymentTotal = totalPaid + paymentAmount;

    console.log('💰 Payment calculation:', {
      subtotalAmount: testRequest.billing?.amount || 0,
      totalPaid,
      newPayment: paymentAmount,
      currentPaymentTotal
    });

    const paymentData = {
      amount: paymentAmount,
      paymentMethod,
      paymentType: 'test',
      notes: `Partial payment: ${paymentAmount} (Total paid so far: ${currentPaymentTotal})`,
      currency: 'INR',
      ...metadata
    };

    const paymentLog = await logPaymentTransaction(
      paymentData,
      testRequestId,
      userId,
      metadata
    );

    return paymentLog;
  } catch (error) {
    console.error('❌ Error logging partial payment:', error);
    throw error;
  }
};

/**
 * Get payment logs for a test request
 * @param {ObjectId} testRequestId - Test request ID
 * @returns {Promise<Array>} Array of payment logs
 */
export const getPaymentLogsForTestRequest = async (testRequestId) => {
  try {
    const paymentLogs = await PaymentLog.find({ testRequestId })
      .sort({ createdAt: -1 })
      .populate('processedBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .lean();

    return paymentLogs;
  } catch (error) {
    console.error('❌ Error getting payment logs:', error);
    throw error;
  }
};

/**
 * Get payment logs for a center
 * @param {ObjectId} centerId - Center ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of payment logs
 */
export const getPaymentLogsForCenter = async (centerId, filters = {}) => {
  try {
    const query = { centerId };
    
    // Add optional filters
    if (filters.status) query.status = filters.status;
    if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
    if (filters.dateFrom && filters.dateTo) {
      query.createdAt = {
        $gte: new Date(filters.dateFrom),
        $lte: new Date(filters.dateTo)
      };
    }

    const paymentLogs = await PaymentLog.find(query)
      .sort({ createdAt: -1 })
      .populate('processedBy', 'name email')
      .populate('testRequestId', 'testType testDescription')
      .populate('patientId', 'name uhId phone')
      .lean();

    return paymentLogs;
  } catch (error) {
    console.error('❌ Error getting payment logs for center:', error);
    throw error;
  }
};

/**
 * Get payment statistics for a center
 * @param {ObjectId} centerId - Center ID
 * @param {Object} dateRange - Date range filters
 * @returns {Promise<Object>} Payment statistics
 */
export const getPaymentStatistics = async (centerId, dateRange = {}) => {
  try {
    const query = { centerId };
    
    if (dateRange.startDate && dateRange.endDate) {
      query.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    const stats = await PaymentLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          cancelledTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          refundedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] }
          },
          refundedAmount: {
            $sum: { 
              $cond: [
                { $eq: ['$status', 'refunded'] }, 
                '$refund.refundedAmount', 
                0
              ] 
            }
          }
        }
      }
    ]);

    return stats[0] || {
      totalTransactions: 0,
      totalAmount: 0,
      completedTransactions: 0,
      completedAmount: 0,
      failedTransactions: 0,
      cancelledTransactions: 0,
      refundedTransactions: 0,
      refundedAmount: 0
    };
  } catch (error) {
    console.error('❌ Error getting payment statistics:', error);
    throw error;
  }
};

export default {
  logPaymentTransaction,
  logPaymentStatusUpdate,
  logPaymentCancellation,
  logPaymentRefund,
  logPatientBillingPayment,
  logPatientBillingRefund,
  logPatientBillingCancellation,
  logPartialPayment,
  getPaymentLogsForTestRequest,
  getPaymentLogsForCenter,
  getPaymentStatistics
};

