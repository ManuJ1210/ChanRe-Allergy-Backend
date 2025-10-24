import Patient from '../models/Patient.js';
import User from '../models/User.js';
import PaymentLog from '../models/PaymentLog.js';
import { 
  logPatientBillingPayment,
  logPatientBillingRefund,
  logPatientBillingCancellation
} from '../services/paymentLogService.js';
import TransactionService from '../services/transactionService.js';

/**
 * Controller for handling patient reassignment billing operations
 */
class ReassignmentBillingController {
  
  /**
   * Create invoice for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createInvoice(req, res) {
    try {
      console.log('🚀 Creating invoice for reassigned patient:', req.body);
      
      const {
        patientId,
        doctorId,
        centerId,
        consultationType = 'OP',
        consultationFee = 850,
        serviceCharges = [],
        taxPercentage = 0,
        discountPercentage = 0,
        notes = '',
        isReassignedEntry = true
      } = req.body;

      // Validate required fields
      if (!patientId || !doctorId || !centerId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID, Doctor ID, and Center ID are required'
        });
      }

      // Find patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      console.log(`🔍 Fetched patient ${patient.name} - Current reassignedBilling count: ${patient.reassignedBilling?.length || 0}`);
      if (patient.reassignedBilling && patient.reassignedBilling.length > 0) {
        console.log(`🔍 Existing reassignedBilling:`, patient.reassignedBilling.map(b => ({
          invoiceNumber: b.invoiceNumber,
          amount: b.amount,
          status: b.status
        })));
      }

      // Find doctor
      const doctor = await User.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      // Check if patient is eligible for free reassignment (within 7 days)
      const isEligibleForFreeReassignment = ReassignmentBillingController.isEligibleForFreeReassignment(patient);
      
      // Calculate consultation fee based on eligibility
      let finalConsultationFee = consultationFee;
      if (isEligibleForFreeReassignment) {
        finalConsultationFee = 0; // Free for first reassignment within 7 days
      } else if (consultationType === 'IP') {
        finalConsultationFee = 1050;
      }

      // Calculate service charges total
      const serviceTotal = serviceCharges.reduce((sum, service) => 
        sum + (parseFloat(service.amount) || 0), 0
      );

      // Calculate totals
      const subtotal = finalConsultationFee + serviceTotal;
      const taxAmount = (subtotal * (parseFloat(taxPercentage) || 0)) / 100;
      const discountAmount = (subtotal * (parseFloat(discountPercentage) || 0)) / 100;
      const total = subtotal + taxAmount - discountAmount;

      // Create invoice data that matches billingSchema
      const invoiceData = {
        type: 'reassignment_consultation', // Required field for billingSchema
        description: `${consultationType} Consultation for Reassigned Patient`,
        amount: total, // Required field for billingSchema
        consultationType,
        isReassignedEntry: true,
        doctorId,
        status: 'pending',
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}-${patient.uhId || patient._id.toString().slice(-4)}`,
        serviceDetails: serviceCharges.filter(s => s.name && s.amount).map(s => `${s.name}: ₹${s.amount}`).join(', '),
        paymentNotes: isEligibleForFreeReassignment ? 
          `Free reassignment for ${patient.name} (within 7 days)` : 
          notes || `Invoice for reassigned patient: ${patient.name}`,
        createdAt: new Date(), // Ensure proper timestamp
        updatedAt: new Date(), // Ensure proper timestamp
        // Store additional data in a custom field for frontend use
        customData: {
          consultationFee: finalConsultationFee,
          serviceCharges: serviceCharges.filter(s => s.name && s.amount),
          taxPercentage: parseFloat(taxPercentage) || 0,
          discountPercentage: parseFloat(discountPercentage) || 0,
          totals: {
            subtotal,
            taxAmount,
            discountAmount,
            total,
            paid: 0,
            due: total
          }
        }
      };

      // CRITICAL FIX: Ensure proper array handling for reassignment billing
      console.log(`🔍 CRITICAL FIX: Starting reassignment billing creation for ${patient.name}`);
      
      // Ensure reassignedBilling array exists
      if (!patient.reassignedBilling) {
        patient.reassignedBilling = [];
        console.log(`🔍 Initialized empty reassignedBilling array`);
      }

      console.log(`🔍 Before adding invoice - Patient ${patient.name} has ${patient.reassignedBilling.length} reassignment bills`);
      
      // Create a copy of existing bills to prevent reference issues
      const existingBills = [...patient.reassignedBilling];
      console.log(`🔍 Existing bills count: ${existingBills.length}`);
      
      // Add new invoice data
      const newBills = [...existingBills, invoiceData];
      console.log(`🔍 New bills count: ${newBills.length}`);
      
      // Set the new array
      patient.reassignedBilling = newBills;
      
      console.log(`🔍 After setting new array - Patient ${patient.name} now has ${patient.reassignedBilling.length} reassignment bills`);
      console.log(`🔍 New invoice data:`, {
        invoiceNumber: invoiceData.invoiceNumber,
        amount: invoiceData.amount,
        status: invoiceData.status,
        createdAt: invoiceData.createdAt
      });
      
      console.log(`🔍 About to save patient - reassignedBilling length: ${patient.reassignedBilling.length}`);
      
      // Use updateOne to ensure atomic operation
      const updateResult = await Patient.updateOne(
        { _id: patientId },
        { 
          $push: { 
            reassignedBilling: invoiceData 
          },
          $set: {
            lastReassignedAt: new Date(),
            isReassigned: true
          }
        }
      );
      
      console.log(`🔍 Update result:`, updateResult);
      
      // Verify by fetching from database again
      const verifyPatient = await Patient.findById(patientId);
      console.log(`🔍 Verification - Database has ${verifyPatient.reassignedBilling?.length || 0} reassignment bills`);
      if (verifyPatient.reassignedBilling && verifyPatient.reassignedBilling.length > 0) {
        console.log(`🔍 Database reassignedBilling:`, verifyPatient.reassignedBilling.map(b => ({
          invoiceNumber: b.invoiceNumber,
          amount: b.amount,
          status: b.status,
          createdAt: b.createdAt
        })));
      }

      console.log('✅ Invoice created successfully:', {
        patientId,
        invoiceNumber: invoiceData.invoiceNumber,
        total: total,
        isFree: isEligibleForFreeReassignment
      });

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice: invoiceData
      });

    } catch (error) {
      console.error('❌ Error creating invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create invoice',
        error: error.message
      });
    }
  }

  /**
   * Process payment for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processPayment(req, res) {
    try {
      console.log('🚀 Processing payment for reassigned patient:', req.body);
      
      const {
        invoiceId,
        patientId,
        amount,
        paymentMethod = 'cash',
        notes = '',
        appointmentTime = null,
        centerId
      } = req.body;

      // Validate required fields
      if (!patientId || !amount || !centerId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID, amount, and center ID are required'
        });
      }

      // Find patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Find the latest reassignment billing entry
      const reassignmentBills = patient.reassignedBilling || [];
      if (reassignmentBills.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No reassignment billing found for this patient'
        });
      }

      const latestBill = reassignmentBills[reassignmentBills.length - 1];
      const paymentAmount = parseFloat(amount);

      // Validate payment amount
      if (paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than 0'
        });
      }

      // Check if payment exceeds due amount
      const currentDue = latestBill.customData?.totals?.due || (latestBill.amount - (latestBill.paidAmount || 0));
      if (paymentAmount > currentDue) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (₹${paymentAmount}) cannot exceed due amount (₹${currentDue})`
        });
      }

      // Update billing totals
      const currentPaid = latestBill.customData?.totals?.paid || latestBill.paidAmount || 0;
      const currentTotal = latestBill.customData?.totals?.total || latestBill.amount || 0;
      const newPaidAmount = currentPaid + paymentAmount;
      const newDueAmount = currentTotal - newPaidAmount;

      // Update customData totals
      if (latestBill.customData && latestBill.customData.totals) {
        latestBill.customData.totals.paid = newPaidAmount;
        latestBill.customData.totals.due = newDueAmount;
      }
      
      // Also update top-level fields for backward compatibility
      latestBill.paidAmount = newPaidAmount;

      // Add payment record
      if (!latestBill.payments) {
        latestBill.payments = [];
      }

      const paymentRecord = {
        amount: paymentAmount,
        method: paymentMethod,
        notes: notes,
        processedBy: req.user._id,
        processedAt: new Date(),
        receiptNumber: `RCP-${Date.now()}-${patient.uhId || patient._id.toString().slice(-4)}`
      };

      latestBill.payments.push(paymentRecord);

      // Update bill status
      if (newDueAmount <= 0) {
        latestBill.status = 'paid';
        latestBill.paidAt = new Date();
      } else {
        latestBill.status = 'partial';
      }

      // If appointment time is provided, schedule appointment
      if (appointmentTime) {
        if (!patient.appointments) {
          patient.appointments = [];
        }
        
        patient.appointments.push({
          doctorId: latestBill.doctorId,
          scheduledAt: new Date(appointmentTime),
          type: 'reassignment_consultation',
          status: 'scheduled',
          notes: `Appointment scheduled after payment for reassignment consultation`,
          createdAt: new Date()
        });
      }

      await patient.save();

      // Log payment transaction for reassignment billing
      try {
        console.log('💳 Logging reassignment billing payment transaction');
        
        // Prepare payment data for logging
        const paymentData = {
          amount: paymentAmount,
          paymentMethod,
          paymentType: 'consultation',
          notes: notes || `Reassignment consultation payment for patient: ${patient.name}`,
          invoiceNumber: latestBill.invoiceNumber,
          consultationType: latestBill.consultationType || 'OP',
          appointmentTime: appointmentTime,
          status: 'completed',
          isReassignedEntry: true,
          reassignedEntryId: latestBill._id
        };

        // Prepare metadata
        const metadata = {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers?.['user-agent'],
          source: 'web',
          verified: true,
          verifiedBy: req.user.id || req.user._id,
          verifiedAt: new Date()
        };

        // Log the payment transaction
        await logPatientBillingPayment(
          patientId,
          paymentData,
          req.user.id || req.user._id,
          metadata
        );
        
        console.log('✅ Reassignment billing payment logged successfully');
      } catch (paymentLogError) {
        console.error('❌ Error logging reassignment billing payment:', paymentLogError);
        // Continue execution - payment logging failure should not stop the transaction
      }

      // Create reassignment transaction record
      try {
        const reassignmentTransactionData = {
          patientId: patientId,
          assignedDoctorId: patient.assignedDoctor?._id || patient.assignedDoctor,
          currentDoctorId: patient.currentDoctor?._id || patient.currentDoctor,
          centerId: centerId,
          reassignmentType: 'regular',
          consultationType: latestBill.consultationType || 'OP',
          reassignmentReason: patient.reassignmentHistory?.[patient.reassignmentHistory.length - 1]?.reason || 'Patient reassignment',
          reassignmentNotes: patient.reassignmentHistory?.[patient.reassignmentHistory.length - 1]?.notes || '',
          amount: paymentAmount,
          paymentMethod: paymentMethod,
          paymentType: paymentAmount >= (latestBill.amount || 0) ? 'full' : 'partial',
          invoiceNumber: latestBill.invoiceNumber,
          paymentBreakdown: {
            consultationFee: latestBill.consultationFee || latestBill.amount || 0,
            serviceCharges: latestBill.serviceCharges || [],
            subtotal: latestBill.amount || 0,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: latestBill.amount || 0
          },
          isEligibleForFreeReassignment: ReassignmentBillingController.isEligibleForFreeReassignment(patient),
          firstConsultationDate: patient.billing?.[0]?.createdAt,
          notes: notes || 'Payment processed for reassignment consultation'
        };

        await TransactionService.createReassignmentTransaction(reassignmentTransactionData, req.user);
        console.log('✅ Reassignment transaction created successfully');
      } catch (transactionError) {
        console.error('❌ Error creating reassignment transaction:', transactionError);
        // Continue execution - transaction creation failure should not stop the payment
      }

      console.log('✅ Payment processed for reassignment consultation:', {
        patientId,
        amount: paymentAmount,
        method: paymentMethod,
        receiptNumber: paymentRecord.receiptNumber,
        invoiceNumber: latestBill.invoiceNumber
      });

      console.log('✅ Payment processed successfully:', {
        patientId,
        amount: paymentAmount,
        method: paymentMethod,
        newDue: newDueAmount,
        appointmentScheduled: !!appointmentTime
      });

      res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        payment: paymentRecord,
        updatedBill: latestBill,
        appointmentScheduled: !!appointmentTime
      });

    } catch (error) {
      console.error('❌ Error processing payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process payment',
        error: error.message
      });
    }
  }

  /**
   * Cancel bill for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async cancelBill(req, res) {
    try {
      console.log('🚀 Cancelling bill for reassigned patient:', req.body);
      console.log('🔍 Request validation:', {
        patientId: req.body.patientId,
        reason: req.body.reason,
        centerId: req.body.centerId,
        patientIdType: typeof req.body.patientId,
        reasonType: typeof req.body.reason,
        centerIdType: typeof req.body.centerId,
        patientIdExists: !!req.body.patientId,
        reasonExists: !!req.body.reason,
        centerIdExists: !!req.body.centerId
      });
      
      const {
        patientId,
        reason,
        centerId
      } = req.body;

      // Validate required fields
      if (!patientId || !reason || !centerId) {
        console.log('❌ Validation failed:', {
          patientId: patientId,
          reason: reason,
          centerId: centerId,
          patientIdValid: !!patientId,
          reasonValid: !!reason,
          centerIdValid: !!centerId
        });
        return res.status(400).json({
          success: false,
          message: 'Patient ID, reason, and center ID are required'
        });
      }

      // Find patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Find the latest reassignment billing entry
      const reassignmentBills = patient.reassignedBilling || [];
      if (reassignmentBills.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No reassignment billing found for this patient'
        });
      }

      const latestBill = reassignmentBills[reassignmentBills.length - 1];

      console.log('🔍 Latest bill details:', {
        billId: latestBill._id,
        status: latestBill.status,
        amount: latestBill.amount,
        paidAmount: latestBill.paidAmount,
        customData: latestBill.customData,
        invoiceNumber: latestBill.invoiceNumber,
        createdAt: latestBill.createdAt
      });

      // Check if bill is already cancelled
      if (latestBill.status === 'cancelled') {
        console.log('❌ Bill is already cancelled:', latestBill.status);
        return res.status(400).json({
          success: false,
          message: 'Bill is already cancelled'
        });
      }

      // Check if bill is already refunded
      if (latestBill.status === 'refunded') {
        console.log('❌ Bill is already refunded:', latestBill.status);
        return res.status(400).json({
          success: false,
          message: 'Bill is already refunded'
        });
      }

      // Update bill status
      console.log('🔄 Updating bill status from', latestBill.status, 'to cancelled');
      latestBill.status = 'cancelled';
      latestBill.cancelledAt = new Date();
      latestBill.cancellationReason = reason;
      latestBill.cancelledBy = req.user._id;

      console.log('🔄 Saving patient with updated bill status...');
      await patient.save();
      console.log('✅ Patient saved successfully');

      // Verify the update was saved
      const updatedPatient = await Patient.findById(patientId);
      const updatedBill = updatedPatient.reassignedBilling[updatedPatient.reassignedBilling.length - 1];
      console.log('🔍 Verification - Updated bill status:', updatedBill.status);

      // Log payment cancellation
      try {
        console.log('💳 Logging reassignment billing cancellation transaction');
        
        // Prepare metadata
        const metadata = {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers?.['user-agent'],
          source: 'web'
        };

        // Log the cancellation transaction
        await logPatientBillingCancellation(
          patientId,
          reason,
          req.user.id || req.user._id,
          metadata
        );
        
        console.log('✅ Reassignment billing cancellation logged successfully');
      } catch (paymentLogError) {
        console.error('❌ Error logging reassignment billing cancellation:', paymentLogError);
        // Continue execution - payment logging failure should not stop the transaction
      }

      const billAmount = latestBill.customData?.totals?.total || latestBill.amount || 0;
      console.log('✅ Bill cancelled successfully:', {
        patientId,
        reason: reason,
        amount: billAmount,
        invoiceNumber: latestBill.invoiceNumber,
        newStatus: updatedBill.status
      });

      res.status(200).json({
        success: true,
        message: 'Bill cancelled successfully',
        cancelledBill: latestBill
      });

    } catch (error) {
      console.error('❌ Error cancelling bill:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel bill',
        error: error.message
      });
    }
  }

  /**
   * Process refund for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processRefund(req, res) {
    try {
      console.log('🚀 Processing refund for reassigned patient:', req.body);
      
      const {
        patientId,
        amount,
        refundMethod = 'cash',
        refundType = 'full', // 'full' or 'partial'
        reason,
        notes = '',
        centerId
      } = req.body;

      // Validate required fields
      if (!patientId || !amount || !reason || !centerId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID, amount, reason, and center ID are required'
        });
      }

      // Find patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Find the latest reassignment billing entry
      const reassignmentBills = patient.reassignedBilling || [];
      if (reassignmentBills.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No reassignment billing found for this patient'
        });
      }

      const latestBill = reassignmentBills[reassignmentBills.length - 1];
      const refundAmount = parseFloat(amount);

      // Validate refund amount
      if (refundAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount must be greater than 0'
        });
      }

      // Calculate total paid amount and already refunded amount
      const paidAmount = latestBill.customData?.totals?.paid || latestBill.paidAmount || 0;
      const refundedAmount = latestBill.refunds?.reduce((sum, refund) => sum + (refund.amount || 0), 0) || 0;
      const availableForRefund = paidAmount - refundedAmount;
      
      console.log('💰 Refund calculation:', {
        paidAmount,
        refundedAmount,
        availableForRefund,
        requestedRefund: refundAmount
      });
      
      // Validate refund amount
      if (refundAmount > availableForRefund) {
        return res.status(400).json({
          success: false,
          message: `Refund amount (₹${refundAmount}) cannot exceed available refund amount (₹${availableForRefund})`
        });
      }

      // Update billing totals
      const currentTotal = latestBill.customData?.totals?.total || latestBill.amount || 0;
      const newPaidAmount = paidAmount - refundAmount;
      const newDueAmount = currentTotal - newPaidAmount;

      // Update customData totals
      if (latestBill.customData && latestBill.customData.totals) {
        latestBill.customData.totals.paid = newPaidAmount;
        latestBill.customData.totals.due = newDueAmount;
      }
      
      // Also update top-level fields for backward compatibility
      latestBill.paidAmount = newPaidAmount;

      // Add refund record
      if (!latestBill.refunds) {
        latestBill.refunds = [];
      }

      const refundRecord = {
        amount: refundAmount,
        method: refundMethod,
        reason: reason,
        notes: notes,
        processedBy: req.user._id,
        processedAt: new Date(),
        refundNumber: `REF-${Date.now()}-${patient.uhId || patient._id.toString().slice(-4)}`
      };

      latestBill.refunds.push(refundRecord);

      // Update bill status based on refund type and amount
      if (refundType === 'full' && refundAmount >= availableForRefund) {
        // Full refund - mark as refunded
        latestBill.status = 'refunded';
        latestBill.paidAt = null;
        latestBill.refundedAt = new Date();
        latestBill.refundedBy = req.user._id;
        console.log('✅ Bill marked as fully refunded');
      } else if (refundType === 'partial' || refundAmount < availableForRefund) {
        // Partial refund - mark as partially refunded
        latestBill.status = 'partially_refunded';
        latestBill.refundedAt = new Date();
        latestBill.refundedBy = req.user._id;
        console.log('✅ Bill marked as partially refunded');
      } else if (newDueAmount <= 0) {
        // If partial refund but still fully paid
        latestBill.status = 'paid';
        latestBill.paidAt = new Date();
        console.log('✅ Bill remains fully paid after partial refund');
      } else {
        // If partial refund and still has balance
        latestBill.status = 'partial';
        console.log('✅ Bill remains partially paid after refund');
      }

      await patient.save();

      // Log payment refund for reassignment billing
      try {
        console.log('💳 Logging reassignment billing refund transaction');
        
        // Prepare metadata
        const metadata = {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers?.['user-agent'],
          source: 'web',
          externalRefundId: refundRecord.refundNumber
        };

        // Log the refund transaction
        await logPatientBillingRefund(
          patientId,
          refundAmount,
          refundMethod,
          reason,
          req.user.id || req.user._id,
          metadata
        );
        
        console.log('✅ Reassignment billing refund logged successfully');
      } catch (paymentLogError) {
        console.error('❌ Error logging reassignment billing refund:', paymentLogError);
        // Continue execution - payment logging failure should not stop the transaction
      }

      // Update transaction records with refund information
      try {
        console.log('💳 Updating transaction records with refund information');
        
        // Find the most recent reassignment transaction for this patient
        const ReassignmentTransaction = (await import('../models/ReassignmentTransaction.js')).default;
        const transaction = await ReassignmentTransaction.findOne({ 
          patientId: patientId 
        }).sort({ createdAt: -1 });
        
        if (transaction) {
          const refundData = {
            amount: refundAmount,
            refundMethod: refundMethod,
            refundReason: reason,
            refundedAt: new Date(),
            refundType: refundType,
            refundedBy: req.user.id || req.user._id,
            externalRefundId: refundRecord.refundNumber
          };
          
          await transaction.addRefund(refundData);
          console.log('✅ Transaction record updated with refund information');
        } else {
          console.log('⚠️ No reassignment transaction found to update with refund');
        }
      } catch (transactionError) {
        console.error('❌ Error updating transaction record with refund:', transactionError);
        // Continue execution - transaction update failure should not stop the refund
      }

      console.log('✅ Refund processed for reassignment consultation:', {
        patientId,
        amount: refundAmount,
        refundMethod: refundMethod,
        refundType: refundType,
        reason: reason,
        refundNumber: refundRecord.refundNumber,
        invoiceNumber: latestBill.invoiceNumber,
        newStatus: latestBill.status
      });

      res.status(200).json({
        success: true,
        message: `${refundType === 'full' ? 'Full' : 'Partial'} refund processed successfully`,
        refundType: refundType,
        refund: refundRecord,
        updatedBill: latestBill,
        totalPaidAmount: paidAmount,
        totalRefundedAmount: refundedAmount + refundAmount
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
   * Get billing status for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getBillingStatus(req, res) {
    try {
      const { patientId } = req.params;

      // Find patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Get reassignment billing entries
      const reassignmentBills = patient.reassignedBilling || [];
      
      // Calculate totals
      const totalAmount = reassignmentBills.reduce((sum, bill) => sum + (bill.totals?.total || 0), 0);
      const totalPaid = reassignmentBills.reduce((sum, bill) => sum + (bill.totals?.paid || 0), 0);
      const totalDue = totalAmount - totalPaid;

      // Check eligibility for free reassignment
      const isEligibleForFreeReassignment = ReassignmentBillingController.isEligibleForFreeReassignment(patient);

      res.status(200).json({
        success: true,
        data: {
          patient: {
            _id: patient._id,
            name: patient.name,
            uhId: patient.uhId,
            isReassigned: patient.isReassigned,
            reassignmentHistory: patient.reassignmentHistory || []
          },
          billing: {
            totalAmount,
            totalPaid,
            totalDue,
            bills: reassignmentBills,
            isEligibleForFreeReassignment,
            status: totalDue <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting billing status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get billing status',
        error: error.message
      });
    }
  }

  /**
   * Check if patient is eligible for free reassignment (within 7 days of first consultation)
   * @param {Object} patient - Patient object
   * @returns {boolean} - True if eligible for free reassignment
   */
  static isEligibleForFreeReassignment(patient) {
    if (!patient.billing || patient.billing.length === 0) {
      return false;
    }

    // Check if patient has already been reassigned
    if (patient.isReassigned || patient.reassignmentHistory?.length > 0) {
      return false;
    }

    // Get the first consultation date
    const firstConsultationDate = new Date(patient.billing[0]?.createdAt || patient.createdAt);
    const currentDate = new Date();
    const daysDifference = Math.floor((currentDate - firstConsultationDate) / (1000 * 60 * 60 * 24));

    return daysDifference <= 7;
  }

  /**
   * Get consultation fee based on reassignment eligibility
   * @param {Object} patient - Patient object
   * @param {string} consultationType - Type of consultation (OP/IP)
   * @returns {number} - Consultation fee
   */
  static getConsultationFee(patient, consultationType = 'OP') {
    if (ReassignmentBillingController.isEligibleForFreeReassignment(patient)) {
      return 0; // Free for first reassignment within 7 days
    }
    
    if (consultationType === 'IP') {
      return 1050;
    }
    
    return 850; // Default OP consultation fee
  }
}

export default ReassignmentBillingController;
