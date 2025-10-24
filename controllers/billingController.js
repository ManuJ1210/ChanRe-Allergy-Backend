import TestRequest from '../models/TestRequest.js';
import Patient from '../models/Patient.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import PaymentLog from '../models/PaymentLog.js';
import { 
  logPaymentTransaction, 
  logPaymentStatusUpdate,
  logPaymentCancellation,
  logPaymentRefund,
  logPatientBillingPayment,
  logPatientBillingRefund,
  logPatientBillingCancellation
} from '../services/paymentLogService.js';
import TransactionService from '../services/transactionService.js';

// Generate bill for a test request (Receptionist action)
export const generateBillForTestRequest = async (req, res) => {
  try {
    // Early return for debugging - remove this after testing
    if (req.user?.role === 'receptionist') {
      // Proceeding with bill generation
    } else {
      return res.status(403).json({ 
        message: 'Access denied. Only receptionists can generate bills.',
        userRole: req.user?.role
      });
    }
    
    const { id } = req.params;
    const { items = [], taxes = 0, discounts = 0, currency = 'INR', notes } = req.body;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        message: 'Invalid test request ID format',
        receivedId: id,
        validationError: 'invalid_objectid_format',
        expectedFormat: '24 character hexadecimal string'
      });
    }

    // Find the test request in database
    
    const testRequest = await TestRequest.findById(id)
      .select('patientName centerId centerName centerCode _id status billing doctorId isActive workflowStage patientId')
      .populate('patientId', 'name phone address age gender');
    
    if (!testRequest) {
      return res.status(404).json({ 
        message: 'Test request not found',
        searchedId: id,
        suggestion: 'Please check if the test request ID is correct and exists in the database'
      });
    }

    // Validate test request structure
    if (!testRequest._id || !testRequest.status) {
      return res.status(400).json({ 
        message: 'Test request has invalid structure',
        missingFields: {
          id: !testRequest._id,
          status: !testRequest.status
        },
        debug: {
          testRequest: testRequest
        }
      });
    }

    // Check if test request is active
    if (testRequest.isActive === false) {
      return res.status(400).json({ 
        message: 'Cannot generate bill for inactive test request',
        testRequestStatus: 'inactive'
      });
    }
    // Validate test request has required fields
    if (!testRequest.patientName || !testRequest.centerId) {
      return res.status(400).json({ 
        message: 'Test request is missing required fields (patientName or centerId)',
        missingFields: {
          patientName: !testRequest.patientName,
          centerId: !testRequest.centerId
        },
        debug: {
          patientName: testRequest.patientName,
          centerId: testRequest.centerId
        }
      });
    }

    // Validate center access (if user has a centerId)
    // For receptionists, allow access regardless of centerId for now
    if (req.user.role === 'receptionist') {
      // Receptionist access granted for billing operations
    } else {
      // For non-receptionists, require centerId match
      if (req.user.centerId && req.user.centerId.toString() !== testRequest.centerId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. You can only generate bills for test requests in your center.',
          userCenterId: req.user.centerId,
          testRequestCenterId: testRequest.centerId
        });
      }
    }

    // Check if bill already exists
    // Check if test request is in correct status for billing
    if (testRequest.status !== 'Billing_Pending') {
      return res.status(400).json({ 
        message: `Cannot generate bill. Test request must be in 'Billing_Pending' status. Current status: ${testRequest.status}`,
        currentStatus: testRequest.status,
        requiredStatus: 'Billing_Pending'
      });
    }

    // Check if test request is in correct workflow stage
    if (testRequest.workflowStage && testRequest.workflowStage !== 'billing') {
      return res.status(400).json({ 
        message: `Cannot generate bill. Test request must be in 'billing' workflow stage. Current stage: ${testRequest.workflowStage}`,
        currentWorkflowStage: testRequest.workflowStage,
        requiredWorkflowStage: 'billing'
      });
    }

    // Check if billing already exists and is in correct status
    if (testRequest.billing) {
      if (testRequest.billing.status !== 'not_generated') {
        return res.status(400).json({ 
          message: `Cannot generate bill. Current billing status: ${testRequest.billing.status}`,
          currentBillingStatus: testRequest.billing.status,
          currentStatus: testRequest.status
        });
      }
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        message: 'Items array is required and must contain at least one item',
        receivedItems: items,
        validationErrors: {
          isArray: Array.isArray(items),
          hasLength: items?.length > 0
        }
      });
    }

    // Validate each item has required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.name || !item.name.trim()) {
        return res.status(400).json({ 
          message: `Item ${i + 1} must have a name`,
          itemIndex: i,
          item: item,
          validationError: 'missing_name'
        });
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
        return res.status(400).json({ 
          message: `Item ${i + 1} must have a valid unit price greater than 0`,
          itemIndex: i,
          item: item,
          validationError: 'invalid_unit_price'
        });
      }
    }

    // Compute totals
    const itemsWithTotals = items.map((it) => ({
      name: it.name.trim(),
      code: it.code || '',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.quantity || 1) * Number(it.unitPrice || 0)
    }));
    
    const subTotal = itemsWithTotals.reduce((sum, it) => sum + (it.total || 0), 0);
    const totalAmount = Math.max(0, subTotal + Number(taxes || 0) - Number(discounts || 0));
    
    // Generate a simple invoice number
    const prefix = testRequest.centerCode || testRequest.centerId?.code || 'INV';
    const invoiceNumber = `${prefix}-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${String(testRequest._id).slice(-5)}`;

    // Update test request with billing information
    const billingData = {
      status: 'generated',
      amount: totalAmount,
      currency,
      items: itemsWithTotals,
      taxes: Number(taxes || 0),
      discounts: Number(discounts || 0),
      invoiceNumber,
      generatedAt: new Date(),
      generatedBy: req.user.id || req.user._id,
      notes
    };
    
    testRequest.billing = billingData;
    testRequest.status = 'Billing_Generated';
    testRequest.workflowStage = 'billing';
    testRequest.updatedAt = new Date();
    
    // Save to database
    const updated = await testRequest.save();

    // Notify stakeholders
    try {
      const recipients = await User.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'centeradmin', centerId: testRequest.centerId },
          { role: 'superadmin', isSuperAdminStaff: true }
        ],
        isDeleted: { $ne: true }
      });

      for (const r of recipients) {
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Bill Generated',
          message: `Invoice ${invoiceNumber} generated for ${testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'} - ${testRequest.testType || 'Unknown Test'}`,
          data: { 
            testRequestId: testRequest._id, 
            invoiceNumber, 
            amount: totalAmount, 
            status: 'Billing_Generated',
            patientId: testRequest.patientId,
            patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
            testType: testRequest.testType
          },
          read: false
        });
        await n.save();
      }
    } catch (notifyErr) {
      // Billing generation notification error
    }

    res.status(200).json({ 
      message: 'Bill generated successfully', 
      testRequest: updated 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to generate bill', 
      error: error.message,
      errorType: error.name,
      errorCode: error.code
    });
  }
};

// Mark bill as paid (Receptionist action)
export const markBillPaidForTestRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionId, verificationNotes } = req.body;

    // Handle uploaded receipt file
    let receiptFileName = null;
    if (req.file) {
      receiptFileName = req.file.filename;
    }

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        message: 'Invalid test request ID format',
        receivedId: id
      });
    }

    // Find the test request
    const testRequest = await TestRequest.findById(id)
      .select('patientName centerId centerName centerCode _id status billing doctorId patientId testType')
      .populate('patientId', 'name phone address age gender');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if billing exists and is in correct status
    if (!testRequest.billing || testRequest.billing.status === 'not_generated') {
      return res.status(400).json({ 
        message: 'Cannot mark bill as paid. No bill generated for this test request.',
        currentBillingStatus: testRequest.billing?.status || 'not_generated'
      });
    }

    // Check if bill is already fully paid (allow partial payments to continue)
    // Note: We allow additional payments even if status is 'paid' to support partial payment workflow
    // The frontend will handle the actual payment amount validation
    if (testRequest.billing.status === 'paid' && testRequest.billing.paidAmount >= testRequest.billing.amount) {
      return res.status(400).json({ 
        message: 'Bill is already fully paid.',
        currentBillingStatus: testRequest.billing.status,
        paidAmount: testRequest.billing.paidAmount,
        totalAmount: testRequest.billing.amount
      });
    }

    // Handle payment amount from request body (for partial payments)
    const paymentAmount = parseFloat(req.body.paymentAmount) || testRequest.billing.amount;
    const currentPaidAmount = testRequest.billing.paidAmount || 0;
    const newPaidAmount = currentPaidAmount + paymentAmount;
    const totalAmount = testRequest.billing.amount;
    
    // Update payment information
    testRequest.billing.paidAmount = newPaidAmount;
    testRequest.billing.paidAt = new Date();
    testRequest.billing.paidBy = req.user.id || req.user._id;
    testRequest.billing.paymentMethod = paymentMethod || 'Cash';
    testRequest.billing.transactionId = transactionId;
    testRequest.billing.receiptUpload = receiptFileName;
    testRequest.billing.verificationNotes = verificationNotes;
    
    // Set status based on payment amount
    if (newPaidAmount >= totalAmount) {
      // Fully paid - check if tests are already completed
      testRequest.billing.status = 'paid';
      
      // ✅ FIXED: If tests are already completed, set status to Report_Sent to prevent new request creation
      if (['Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'].includes(testRequest.status)) {
        testRequest.status = 'Report_Sent'; // Keep as Report_Sent to prevent new request creation
        testRequest.workflowStage = 'completed';
      } else {
        testRequest.status = 'Billing_Paid'; // Only set to Billing_Paid if tests are not completed
        testRequest.workflowStage = 'lab_assignment';
      }
    } else {
      // Partially paid - also ready for lab processing (allow lab to see and work on it)
      testRequest.billing.status = 'partially_paid';
      testRequest.status = 'Billing_Paid'; // Allow lab to see it
      testRequest.workflowStage = 'lab_assignment'; // Move to lab stage
    }
    
    testRequest.updatedAt = new Date();

    // Save to database
    const updated = await testRequest.save();

    // LOG PAYMENT TRANSACTION
    try {
      console.log('🔍 Attempting to log payment transaction:', {
        testRequestId: testRequest._id,
        paymentAmount,
        paymentMethod,
        transactionId,
        userId: req.user.id || req.user._id
      });

      const paymentData = {
        amount: paymentAmount,
        paymentMethod: paymentMethod || 'Cash',
        transactionId: transactionId,
        receiptFile: receiptFileName,
        notes: verificationNotes,
        verificationNotes: verificationNotes,
        currency: testRequest.billing?.currency || 'INR',
        paymentType: 'test',
        status: newPaidAmount >= totalAmount ? 'completed' : 'completed', // Log as completed since it's processed
      };

      const metadata = {
        source: 'web',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
      };

      const paymentLog = await logPaymentTransaction(paymentData, testRequest._id, req.user.id || req.user._id, metadata);
      console.log('✅ Payment transaction logged successfully:', paymentLog._id);
    } catch (paymentLogError) {
      console.error('❌ Payment logging failed:', paymentLogError);
      // Continue execution - payment logging failure should not stop the transaction
    }

    // Notify stakeholders (lab staff only when fully paid)
    try {
      // Ensure we have a proper patient name
      const patientName = testRequest.patientName || 
                         (testRequest.patientId && typeof testRequest.patientId === 'object' ? testRequest.patientId.name : null) ||
                         (testRequest.patientId && typeof testRequest.patientId === 'string' ? testRequest.patientId : null) ||
                         'Unknown Patient';

      // Always notify all stakeholders including lab staff for any payment (partial or full)
      const recipients = await User.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'centeradmin', centerId: testRequest.centerId },
          { role: 'superadmin', isSuperAdminStaff: true },
          { role: 'lab', centerId: testRequest.centerId } // Always include lab staff for any payment
        ],
        isDeleted: { $ne: true }
      });
      
      // Determine notification message based on payment status
      let notificationTitle;
      let notificationMessage;
      
      if (newPaidAmount >= totalAmount) {
        notificationTitle = 'Payment Received - Test Ready for Lab';
        notificationMessage = `Payment received for ${patientName} - ${testRequest.testType || 'Unknown Test'}. Amount: ${testRequest.billing.currency} ${testRequest.billing.amount}. Test request is now ready for lab processing.`;
      } else {
        notificationTitle = 'Partial Payment Received - Test Ready for Lab';
        notificationMessage = `Partial payment received for ${patientName} - ${testRequest.testType || 'Unknown Test'}. Amount paid: ${testRequest.billing.currency} ${newPaidAmount} of ${testRequest.billing.currency} ${totalAmount}. Test request is ready for lab processing with partial payment status.`;
      }

      for (const r of recipients) {
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: notificationTitle,
          message: notificationMessage,
          data: { 
            testRequestId: testRequest._id, 
            amount: testRequest.billing.amount,
            paidAmount: newPaidAmount,
            remainingAmount: totalAmount - newPaidAmount,
            paymentStatus: newPaidAmount >= totalAmount ? 'fully_paid' : 'partially_paid',
            billingStatus: newPaidAmount >= totalAmount ? 'paid' : 'partially_paid',
            status: updated.status, // Use the actual updated status
            patientId: testRequest.patientId,
            patientName: patientName,
            testType: testRequest.testType || 'Unknown Test'
          },
          read: false
        });
        await n.save();
      }
    } catch (notifyErr) {
      // Payment notification error
    }

    res.status(200).json({ 
      message: 'Payment marked successfully. Test request is now ready for lab processing.', 
      testRequest: updated 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark bill as paid', error: error.message });
  }
};

// Get billing information for a test request
export const getBillingInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const testRequest = await TestRequest.findById(id)
      .select('patientName centerId centerName centerCode _id status billing createdAt')
      .populate('centerId', 'name code');

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json({
      testRequest: {
        _id: testRequest._id,
        patientName: testRequest.patientName,
        centerId: testRequest.centerId,
        centerName: testRequest.centerName,
        centerCode: testRequest.centerCode,
        status: testRequest.status,
        billing: testRequest.billing,
        createdAt: testRequest.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get billing information', error: error.message });
  }
};

// Get all billing data for superadmin (across all centers)
export const getAllBillingData = async (req, res) => {
  try {
    // Get all test requests with billing information from database - only include items with actual billing status
    const billingRequests = await TestRequest.find({ 
      isActive: true,
      billing: { $exists: true, $ne: null },
      'billing.status': { $exists: true, $ne: null }
    })
      .select('testType testDescription selectedTests status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone specializations')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    res.status(200).json({
      success: true,
      billingRequests,
      total: billingRequests.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch billing data',
      error: error.message 
    });
  }
};

// Get billing data for a specific center
export const getBillingDataForCenter = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    if (!centerId) {
      return res.status(400).json({ message: 'Center ID is required' });
    }

    // Get all test requests with billing information for this center - only include items with actual billing status
    const billingRequests = await TestRequest.find({ 
      centerId,
      isActive: true,
      billing: { $exists: true, $ne: null },
      'billing.status': { $exists: true, $ne: null }
    })
      .select('testType testDescription selectedTests status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone specializations')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      billingRequests,
      total: billingRequests.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch center billing data',
      error: error.message 
    });
  }
};

// Cancel a bill
export const cancelBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const testRequest = await TestRequest.findById(id).select('patientName centerId centerName centerCode _id status billing');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if billing exists
    if (!testRequest.billing || testRequest.billing.status === 'not_generated') {
      return res.status(400).json({ 
        message: 'Cannot cancel bill. No bill generated for this test request.',
        currentBillingStatus: testRequest.billing?.status || 'not_generated'
      });
    }

    // Check if bill is already cancelled or refunded
    if (testRequest.billing.status === 'cancelled') {
      return res.status(400).json({ 
        message: 'Cannot cancel bill. Bill has already been cancelled.',
        currentBillingStatus: testRequest.billing.status
      });
    }

    if (testRequest.billing.status === 'refunded') {
      return res.status(400).json({ 
        message: 'Cannot cancel bill. Bill has already been refunded.',
        currentBillingStatus: testRequest.billing.status
      });
    }

    // Allow cancellation of paid bills - user can process refund separately
    // No need to prevent cancellation based on payment status

    // Update billing status to cancelled
    testRequest.billing.status = 'cancelled';
    testRequest.billing.cancelledAt = new Date();
    testRequest.billing.cancelledBy = req.user.id || req.user._id;
    testRequest.billing.cancellationReason = cancellationReason;

    // Update main status back to pending
    testRequest.status = 'Pending';
    testRequest.updatedAt = new Date();

    // Save to database
    const updated = await testRequest.save();

    // LOG PAYMENT CANCELLATION
    try {
      await logPaymentCancellation(testRequest._id, req.user.id || req.user._id, cancellationReason);
    } catch (paymentLogError) {
      // Continue execution - payment logging failure should not stop the transaction
    }

    // Notify stakeholders
    try {
      const recipients = await User.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'centeradmin', centerId: testRequest.centerId },
          { role: 'superadmin', isSuperAdminStaff: true }
        ],
        isDeleted: { $ne: true }
      });

      for (const r of recipients) {
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Bill Cancelled',
          message: `Bill cancelled for ${testRequest.patientName} - ${testRequest.testType}. Reason: ${cancellationReason || 'No reason provided'}`,
          data: { testRequestId: testRequest._id, status: 'Pending', cancellationReason },
          read: false
        });
        await n.save();
      }
    } catch (notifyErr) {
      // Notification error
    }

    res.status(200).json({ 
      message: 'Bill cancelled successfully', 
      testRequest: updated 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel bill', error: error.message });
  }
};

// Fix center data inconsistencies in billing records
export const fixCenterData = async (req, res) => {
  try {
    console.log('🔧 Fixing center data inconsistencies...');
    
    const Center = (await import('../models/Center.js')).default;
    
    // Get all centers
    const centers = await Center.find({}).select('_id centername name centerCode');
    console.log('🔧 Found centers:', centers.map(c => ({
      id: c._id,
      name: c.centername || c.name,
      code: c.centerCode
    })));
    
    // Get all test requests with billing
    const testRequests = await TestRequest.find({
      isActive: true,
      billing: { $exists: true, $ne: null }
    }).select('centerId centerName centerCode');
    
    console.log('🔧 Found test requests with billing:', testRequests.length);
    
    let updatedCount = 0;
    let reassignedCount = 0;
    
    for (const testRequest of testRequests) {
      const currentCenter = centers.find(c => c._id.toString() === testRequest.centerId.toString());
      const nameBasedCenter = centers.find(c => 
        (c.centername || c.name) === testRequest.centerName
      );
      
      if (currentCenter) {
        // Center ID is correct, just fix name/code if needed
        const correctCenterName = currentCenter.centername || currentCenter.name;
        const correctCenterCode = currentCenter.centerCode;
        
        if (testRequest.centerName !== correctCenterName || testRequest.centerCode !== correctCenterCode) {
          console.log('🔧 Updating center info for test request:', {
            testRequestId: testRequest._id,
            oldCenterName: testRequest.centerName,
            newCenterName: correctCenterName,
            oldCenterCode: testRequest.centerCode,
            newCenterCode: correctCenterCode
          });
          
          await TestRequest.updateOne(
            { _id: testRequest._id },
            { 
              centerName: correctCenterName,
              centerCode: correctCenterCode
            }
          );
          
          updatedCount++;
        }
      } else if (nameBasedCenter) {
        // Center ID is wrong, but center name matches a real center - reassign
        console.log('🔧 Reassigning test request to correct center:', {
          testRequestId: testRequest._id,
          oldCenterId: testRequest.centerId,
          newCenterId: nameBasedCenter._id,
          centerName: testRequest.centerName
        });
        
        await TestRequest.updateOne(
          { _id: testRequest._id },
          { 
            centerId: nameBasedCenter._id,
            centerName: nameBasedCenter.centername || nameBasedCenter.name,
            centerCode: nameBasedCenter.centerCode
          }
        );
        
        reassignedCount++;
      } else {
        console.log('⚠️ No matching center found for test request:', {
          testRequestId: testRequest._id,
          centerId: testRequest.centerId,
          centerName: testRequest.centerName
        });
      }
    }
    
    console.log(`✅ Fixed ${updatedCount} center names and reassigned ${reassignedCount} test requests`);
    
    res.json({
      success: true,
      message: `Fixed ${updatedCount} center names and reassigned ${reassignedCount} test requests`,
      updatedCount,
      reassignedCount,
      totalCenters: centers.length,
      totalTestRequests: testRequests.length
    });
    
  } catch (error) {
    console.error('❌ Error fixing center data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fix center data',
      error: error.message 
    });
  }
};

// Validate center data consistency
export const validateCenterData = async (req, res) => {
  try {
    console.log('🔍 Validating center data consistency...');
    
    const Center = (await import('../models/Center.js')).default;
    
    // Get all centers
    const centers = await Center.find({}).select('_id centername name centerCode');
    console.log('🔍 Found centers:', centers.map(c => ({
      id: c._id.toString(),
      name: c.centername || c.name,
      code: c.centerCode
    })));
    
    // Get all test requests with billing
    const testRequests = await TestRequest.find({
      isActive: true,
      billing: { $exists: true, $ne: null }
    }).select('_id centerId centerName centerCode billing.status billing.amount');
    
    console.log('🔍 Found test requests with billing:', testRequests.length);
    
    const inconsistencies = [];
    const centerStats = {};
    
    for (const testRequest of testRequests) {
      const center = centers.find(c => c._id.toString() === testRequest.centerId.toString());
      
      if (!center) {
        inconsistencies.push({
          type: 'missing_center',
          testRequestId: testRequest._id,
          centerId: testRequest.centerId,
          centerName: testRequest.centerName,
          message: 'Center ID not found in centers collection'
        });
      } else {
        const correctCenterName = center.centername || center.name;
        const correctCenterCode = center.centerCode;
        
        if (testRequest.centerName !== correctCenterName) {
          inconsistencies.push({
            type: 'name_mismatch',
            testRequestId: testRequest._id,
            centerId: testRequest.centerId,
            currentName: testRequest.centerName,
            correctName: correctCenterName,
            message: 'Center name mismatch'
          });
        }
        
        if (testRequest.centerCode !== correctCenterCode) {
          inconsistencies.push({
            type: 'code_mismatch',
            testRequestId: testRequest._id,
            centerId: testRequest.centerId,
            currentCode: testRequest.centerCode,
            correctCode: correctCenterCode,
            message: 'Center code mismatch'
          });
        }
        
        // Count stats per center
        const centerKey = correctCenterName;
        if (!centerStats[centerKey]) {
          centerStats[centerKey] = {
            centerId: center._id.toString(),
            centerName: correctCenterName,
            centerCode: correctCenterCode,
            totalBills: 0,
            totalAmount: 0,
            inconsistencies: 0
          };
        }
        
        centerStats[centerKey].totalBills++;
        centerStats[centerKey].totalAmount += testRequest.billing?.amount || 0;
        
        if (testRequest.centerName !== correctCenterName || testRequest.centerCode !== correctCenterCode) {
          centerStats[centerKey].inconsistencies++;
        }
      }
    }
    
    console.log(`✅ Found ${inconsistencies.length} data inconsistencies`);
    
    res.json({
      success: true,
      totalCenters: centers.length,
      totalTestRequests: testRequests.length,
      inconsistencies: inconsistencies,
      centerStats: Object.values(centerStats),
      summary: {
        totalInconsistencies: inconsistencies.length,
        nameMismatches: inconsistencies.filter(i => i.type === 'name_mismatch').length,
        codeMismatches: inconsistencies.filter(i => i.type === 'code_mismatch').length,
        missingCenters: inconsistencies.filter(i => i.type === 'missing_center').length
      }
    });
    
  } catch (error) {
    console.error('❌ Error validating center data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to validate center data',
      error: error.message 
    });
  }
};

// Test endpoint to check billing data
export const testBillingData = async (req, res) => {
  try {
    console.log('🧪 Testing billing data...');
    
    // Check total count
    const totalCount = await TestRequest.countDocuments({
      isActive: true,
      billing: { $exists: true, $ne: null }
    });
    
    // Get sample data
    const sampleData = await TestRequest.findOne({
      isActive: true,
      billing: { $exists: true, $ne: null }
    }).select('centerId centerName billing.generatedAt createdAt billing.status billing.amount');
    
    // Get all centers with billing data
    const centersWithData = await TestRequest.distinct('centerId', {
      isActive: true,
      billing: { $exists: true, $ne: null }
    });
    
    // Get detailed center information
    const centerDetails = await TestRequest.find({
      isActive: true,
      billing: { $exists: true, $ne: null }
    }).select('centerId centerName').limit(10);
    
    // SPECIFIC TEST CENTER DEBUG
    console.log('🔍 DEBUGGING TEST CENTER ISSUE:');
    
    // Find Test Center
    const Center = (await import('../models/Center.js')).default;
    const testCenter = await Center.findOne({ centername: 'Test Center' });
    console.log('🔍 Test Center found:', testCenter);
    
    if (testCenter) {
      // Check test requests for Test Center
      const testCenterRequests = await TestRequest.find({
        centerId: testCenter._id,
        isActive: true
      }).select('_id centerId centerName patientName testType billing status createdAt');
      
      console.log('🔍 Test requests for Test Center:', testCenterRequests.length);
      console.log('🔍 Test requests data:', testCenterRequests);
      
      // Check billing data for Test Center
      const testCenterBilling = await TestRequest.find({
        centerId: testCenter._id,
        isActive: true,
        billing: { $exists: true, $ne: null }
      }).select('_id centerId centerName patientName testType billing status createdAt');
      
      console.log('🔍 Billing requests for Test Center:', testCenterBilling.length);
      console.log('🔍 Billing requests data:', testCenterBilling);
      
      // Check if there are any requests with centerName = 'Test Center' but different centerId
      const testCenterNameRequests = await TestRequest.find({
        centerName: 'Test Center',
        isActive: true,
        billing: { $exists: true, $ne: null }
      }).select('_id centerId centerName patientName testType billing status createdAt');
      
      console.log('🔍 Requests with centerName = Test Center:', testCenterNameRequests.length);
      console.log('🔍 Requests with centerName = Test Center data:', testCenterNameRequests);
    }
    
    res.json({
      success: true,
      totalCount,
      sampleData,
      centersWithData,
      centerDetails,
      message: 'Billing data test completed'
    });
  } catch (error) {
    console.error('❌ Error testing billing data:', error);
    res.status(500).json({ message: 'Failed to test billing data', error: error.message });
  }
};

// Get billing reports for superadmin (daily, weekly, monthly, yearly)
export const getBillingReports = async (req, res) => {
  try {
    console.log('🚀 getBillingReports called');
    
    const { period, centerId, startDate, endDate } = req.query;
    
    console.log('📋 Report parameters:', {
      period,
      centerId,
      startDate,
      endDate
    });

    // Build base query - only include items with actual billing status
    let baseQuery = {
      isActive: true,
      billing: { $exists: true, $ne: null },
      'billing.status': { $exists: true, $ne: null }
    };

    // Add center filter if specified
    if (centerId && centerId !== 'all') {
      try {
        console.log('🔍 BACKEND: Processing centerId:', centerId);
        console.log('🔍 BACKEND: centerId type:', typeof centerId);
        console.log('🔍 BACKEND: centerId length:', centerId.length);
        
        const mongoose = require('mongoose');
        const centerObjectId = new mongoose.Types.ObjectId(centerId);
        console.log('🔍 BACKEND: Converted to ObjectId:', centerObjectId);
        console.log('🔍 BACKEND: ObjectId string:', centerObjectId.toString());
        
        // Get center details for validation and debugging
        const Center = (await import('../models/Center.js')).default;
        const centerDetails = await Center.findById(centerId).select('_id centername name centerCode');
        console.log('🔍 BACKEND: Center details found:', centerDetails);
        
        if (centerDetails) {
          const centerName = centerDetails.centername || centerDetails.name;
          console.log('🔍 Center filter applied:', {
            centerId: centerObjectId,
            centerName: centerName,
            centerCode: centerDetails.centerCode
          });
          
          // Use strict centerId filtering only
          baseQuery.centerId = centerObjectId;
          
          // Debug: Check what centers exist in the database
          const allCenters = await Center.find({}).select('_id centername name centerCode');
          console.log('🔍 All centers in database:', allCenters.map(c => ({
            id: c._id.toString(),
            name: c.centername || c.name,
            code: c.centerCode
          })));
          
          const selectedCenter = allCenters.find(c => c._id.toString() === centerId);
          console.log('🔍 Selected center details:', selectedCenter ? {
            id: selectedCenter._id.toString(),
            name: selectedCenter.centername || selectedCenter.name,
            code: selectedCenter.centerCode
          } : 'NOT FOUND');
          
          // Debug: Check billing data for each center
          for (const center of allCenters) {
            const centerBillingCount = await TestRequest.countDocuments({
              centerId: center._id,
              isActive: true,
              billing: { $exists: true, $ne: null }
            });
            console.log(`🔍 Center "${center.centername || center.name}" (${center._id}): ${centerBillingCount} billing records`);
          }
        } else {
          console.log('❌ Center not found in database:', centerId);
          baseQuery.centerId = centerObjectId;
        }
        
      } catch (error) {
        console.log('🔍 Error converting centerId to ObjectId:', error.message);
        // If conversion fails, don't apply center filter and log the error
        console.log('🔍 Invalid centerId format, skipping center filter');
        // Don't set baseQuery.centerId if conversion fails
      }
    }

    // Build date filter based on period
    let dateQuery = {};
    const now = new Date();
    
    if (period === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      dateQuery = {
        $or: [
          { 'billing.generatedAt': { $gte: today, $lt: tomorrow } },
          { createdAt: { $gte: today, $lt: tomorrow } }
        ]
      };
      console.log('🔍 Daily filter applied:', { today: today.toISOString(), tomorrow: tomorrow.toISOString() });
      
    } else if (period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      
      dateQuery = {
        $or: [
          { 'billing.generatedAt': { $gte: weekAgo } },
          { createdAt: { $gte: weekAgo } }
        ]
      };
      console.log('🔍 Weekly filter applied:', { weekAgo: weekAgo.toISOString(), now: now.toISOString() });
      
    } else if (period === 'monthly') {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      monthAgo.setHours(0, 0, 0, 0);
      
      dateQuery = {
        $or: [
          { 'billing.generatedAt': { $gte: monthAgo } },
          { createdAt: { $gte: monthAgo } }
        ]
      };
      console.log('🔍 Monthly filter applied:', { monthAgo: monthAgo.toISOString(), now: now.toISOString() });
      
    } else if (period === 'yearly') {
      const yearAgo = new Date(now);
      yearAgo.setDate(yearAgo.getDate() - 365);
      yearAgo.setHours(0, 0, 0, 0);
      
      dateQuery = {
        $or: [
          { 'billing.generatedAt': { $gte: yearAgo } },
          { createdAt: { $gte: yearAgo } }
        ]
      };
      console.log('🔍 Yearly filter applied:', { yearAgo: yearAgo.toISOString(), now: now.toISOString() });
      
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateQuery = {
        $or: [
          { 'billing.generatedAt': { $gte: start, $lte: end } },
          { createdAt: { $gte: start, $lte: end } }
        ]
      };
      console.log('🔍 Custom date range applied:', { start: start.toISOString(), end: end.toISOString() });
    }

    // Combine base query with date query
    let finalQuery = {
      ...baseQuery,
      ...dateQuery
    };

    console.log('🔍 Final query:', JSON.stringify(finalQuery, null, 2));
    console.log('🔍 BACKEND: About to execute aggregation with centerId filter:', finalQuery.centerId);
    console.log('🔍 BACKEND: CenterId type:', typeof finalQuery.centerId);
    console.log('🔍 BACKEND: CenterId value:', finalQuery.centerId);

    // First, let's check if there's any data at all without filters
    const totalCount = await TestRequest.countDocuments({
      isActive: true,
      billing: { $exists: true, $ne: null }
    });
    console.log('🔍 Total billing records in database (no filters):', totalCount);
    
    // Check what center IDs actually exist in the database
    const existingCenterIds = await TestRequest.distinct('centerId', {
      isActive: true,
      billing: { $exists: true, $ne: null }
    });
    console.log('🔍 Existing center IDs in database:', existingCenterIds);
    console.log('🔍 Looking for center ID:', centerId);
    console.log('🔍 Center ID found in database:', existingCenterIds.includes(centerId));
    
    // Check if centerId exists as ObjectId
    if (centerId && centerId !== 'all') {
      try {
        const mongoose = require('mongoose');
        const centerObjectId = new mongoose.Types.ObjectId(centerId);
        console.log('🔍 Center ID as ObjectId:', centerObjectId);
        console.log('🔍 Center ID as ObjectId string:', centerObjectId.toString());
        console.log('🔍 Center ID found as ObjectId:', existingCenterIds.some(id => id.toString() === centerObjectId.toString()));
      } catch (error) {
        console.log('🔍 Error creating ObjectId for comparison:', error.message);
      }
    }

    // Check if there's data with just the center filter
    if (centerId && centerId !== 'all') {
      try {
        const mongoose = require('mongoose');
        const centerObjectId = new mongoose.Types.ObjectId(centerId);
        const centerCount = await TestRequest.countDocuments({
          isActive: true,
          billing: { $exists: true, $ne: null },
          centerId: centerObjectId
        });
        console.log('🔍 Records for center (ObjectId):', centerCount);
        
        // Also try with string
        const centerCountString = await TestRequest.countDocuments({
          isActive: true,
          billing: { $exists: true, $ne: null },
          centerId: centerId
        });
        console.log('🔍 Records for center (String):', centerCountString);
        
        // Try with both ObjectId and string in OR query
        const centerCountOr = await TestRequest.countDocuments({
          isActive: true,
          billing: { $exists: true, $ne: null },
          $or: [
            { centerId: centerObjectId },
            { centerId: centerId }
          ]
        });
        console.log('🔍 Records for center (OR query):', centerCountOr);
        
        // Check what center IDs are actually in the billing data
        const billingCenterIds = await TestRequest.distinct('centerId', {
          isActive: true,
          billing: { $exists: true, $ne: null }
        });
        console.log('🔍 All center IDs in billing data:', billingCenterIds.map(id => id.toString()));
        console.log('🔍 Looking for center ID:', centerId);
        console.log('🔍 Center ID as ObjectId:', centerObjectId.toString());
        console.log('🔍 Center ID found in billing data:', billingCenterIds.some(id => id.toString() === centerId));
        console.log('🔍 Center ID found as ObjectId in billing data:', billingCenterIds.some(id => id.toString() === centerObjectId.toString()));
        
      } catch (error) {
        console.log('🔍 Error with center ObjectId:', error.message);
      }
    }

    // Get billing data with aggregation
    console.log('🔍 Executing main aggregation with query:', JSON.stringify(finalQuery, null, 2));
    console.log('🔍 BACKEND: About to execute aggregation with centerId filter:', finalQuery.centerId);
    let billingData = await TestRequest.aggregate([
      { $match: finalQuery },
      {
        $lookup: {
          from: 'centers',
          localField: 'centerId',
          foreignField: '_id',
          as: 'center'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient'
        }
      },
      {
        $project: {
          _id: 1,
          patientName: 1,
          testType: 1,
          testDescription: 1,
          urgency: 1,
          status: 1,
          centerId: 1,
          centerName: { 
            $cond: {
              if: { $gt: [{ $size: '$center' }, 0] },
              then: { $ifNull: [{ $arrayElemAt: ['$center.centername', 0] }, { $arrayElemAt: ['$center.name', 0] }] },
              else: '$centerName'
            }
          },
          centerCode: { 
            $cond: {
              if: { $gt: [{ $size: '$center' }, 0] },
              then: { $ifNull: [{ $arrayElemAt: ['$center.centerCode', 0] }, { $arrayElemAt: ['$center.code', 0] }] },
              else: '$centerCode'
            }
          },
          doctorId: 1,
          doctorName: 1,
          patientId: 1,
          billing: 1,
          createdAt: 1,
          updatedAt: 1,
          'center.name': 1,
          'center.code': 1,
          'doctor.name': 1,
          'doctor.email': 1,
          'patient.name': 1,
          'patient.phone': 1
        }
      },
      { $sort: { 'billing.generatedAt': -1 } }
    ]);

    console.log('🔍 Main aggregation result:', {
      totalRecords: billingData.length,
      centerId: centerId,
      period: period,
      sampleRecords: billingData.slice(0, 3).map(item => ({
        id: item._id,
        centerId: item.centerId,
        centerIdString: item.centerId?.toString(),
        centerName: item.centerName,
        centerCode: item.centerCode,
        patientName: item.patientName,
        amount: item.billing?.amount,
        centerLookup: item.center
      }))
    });
    
    // SPECIFIC DEBUG FOR TEST CENTER
    if (centerId && centerId.toString().includes('68bffd315efab8605aafc789')) {
      console.log('🔍 TEST CENTER SPECIFIC DEBUG:');
      console.log('🔍 Requested centerId:', centerId);
      console.log('🔍 All returned records:', billingData.map(item => ({
        id: item._id,
        centerId: item.centerId?.toString(),
        centerName: item.centerName,
        patientName: item.patientName
      })));
      
      const testCenterRecords = billingData.filter(item => 
        item.centerId?.toString() === '68bffd315efab8605aafc789'
      );
      console.log('🔍 Records matching Test Center ID:', testCenterRecords.length);
      console.log('🔍 Test Center records:', testCenterRecords.map(item => ({
        id: item._id,
        centerId: item.centerId?.toString(),
        centerName: item.centerName,
        patientName: item.patientName
      })));
    }
    
    // Debug: Check if returned data matches the selected center
    if (centerId && centerId !== 'all') {
      console.log('🔍 BACKEND: Checking data consistency for centerId:', centerId);
      const mismatchedRecords = billingData.filter(item => 
        item.centerId?.toString() !== centerId
      );
      if (mismatchedRecords.length > 0) {
        console.error('❌ BACKEND: DATA MISMATCH FOUND!');
        console.error('❌ BACKEND: Expected centerId:', centerId);
        console.error('❌ BACKEND: Mismatched records:', mismatchedRecords.map(item => ({
          id: item._id,
          centerId: item.centerId?.toString(),
          centerName: item.centerName
        })));
        
        // Filter out mismatched records to ensure data integrity
        console.log('🔍 BACKEND: Filtering out mismatched records...');
        const originalLength = billingData.length;
        billingData = billingData.filter(item => item.centerId?.toString() === centerId);
        console.log(`🔍 BACKEND: Filtered from ${originalLength} to ${billingData.length} records`);
      } else {
        console.log('✅ BACKEND: All records match the selected center');
      }
    }

    // If no data found and center filtering is applied, try with OR query
    if (billingData.length === 0 && centerId && centerId !== 'all') {
      console.log('🔍 No data found, trying with OR query for center ID...');
      
      try {
        const mongoose = require('mongoose');
        const centerObjectId = new mongoose.Types.ObjectId(centerId);
        
        // Get center details for fallback filtering
        const Center = (await import('../models/Center.js')).default;
        const centerDetails = await Center.findById(centerId).select('_id centername name centerCode');
        
        // Use strict centerId filtering only
        const fallbackQuery = {
          isActive: true,
          billing: { $exists: true, $ne: null },
          centerId: centerObjectId,
          ...dateQuery
        };
        
        console.log('🔍 Fallback query (OR):', JSON.stringify(fallbackQuery, null, 2));
        
        billingData = await TestRequest.aggregate([
        { $match: fallbackQuery },
        {
          $lookup: {
            from: 'centers',
            localField: 'centerId',
            foreignField: '_id',
            as: 'center'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $lookup: {
            from: 'patients',
            localField: 'patientId',
            foreignField: '_id',
            as: 'patient'
          }
        },
        {
          $project: {
            _id: 1,
            patientName: 1,
            testType: 1,
            testDescription: 1,
            urgency: 1,
            status: 1,
            centerId: 1,
            centerName: { 
              $cond: {
                if: { $gt: [{ $size: '$center' }, 0] },
                then: { $ifNull: [{ $arrayElemAt: ['$center.centername', 0] }, { $arrayElemAt: ['$center.name', 0] }] },
                else: '$centerName'
              }
            },
            centerCode: { 
              $cond: {
                if: { $gt: [{ $size: '$center' }, 0] },
                then: { $ifNull: [{ $arrayElemAt: ['$center.centerCode', 0] }, { $arrayElemAt: ['$center.code', 0] }] },
                else: '$centerCode'
              }
            },
            doctorId: 1,
            doctorName: 1,
            patientId: 1,
            billing: 1,
            createdAt: 1,
            updatedAt: 1,
            'center.name': 1,
            'center.code': 1,
            'doctor.name': 1,
            'doctor.email': 1,
            'patient.name': 1,
            'patient.phone': 1
          }
        },
        { $sort: { 'billing.generatedAt': -1 } }
      ]);
      
        console.log('🔍 Fallback query result:', {
          totalRecords: billingData.length,
          centerId: centerId,
          period: period,
          sampleRecords: billingData.slice(0, 3).map(item => ({
            id: item._id,
            centerId: item.centerId,
            centerName: item.centerName,
            patientName: item.patientName,
            amount: item.billing?.amount
          }))
        });
      
      } catch (error) {
        console.log('🔍 Error in fallback query:', error.message);
      }
    }

    // Calculate statistics
    const stats = {
      totalBills: billingData.length,
      totalAmount: 0,
      paidBills: 0,
      paidAmount: 0,
      pendingBills: 0,
      pendingAmount: 0,
      generatedBills: 0,
      generatedAmount: 0,
      paymentReceivedBills: 0,
      paymentReceivedAmount: 0,
      cancelledBills: 0,
      cancelledAmount: 0
    };

    // Group by center
    const centerStats = {};
    const dailyStats = {};
    const monthlyStats = {};

    billingData.forEach(item => {
      const amount = item.billing?.amount || 0;
      const status = item.billing?.status || 'not_generated';
      const centerName = item.centerName || 'Unknown Center';
      const generatedDate = item.billing?.generatedAt || item.createdAt;
      
      console.log('🔍 Processing item:', {
        patientName: item.patientName,
        amount: amount,
        status: status,
        generatedDate: generatedDate
      });
      
      // Overall stats
      stats.totalAmount += amount;
      stats.totalBills++;
      
      // Only count as generated if billing exists
      if (item.billing && item.billing.status) {
        stats.generatedBills++;
        stats.generatedAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          stats.paidBills++;
          stats.paidAmount += amount;
        } else if (status === 'generated') {
          stats.pendingBills++;
          stats.pendingAmount += amount;
        } else if (status === 'payment_received') {
          stats.paymentReceivedBills++;
          stats.paymentReceivedAmount += amount;
        } else if (status === 'cancelled') {
          stats.cancelledBills++;
          stats.cancelledAmount += amount;
        }
      }

      // Center stats
      if (!centerStats[centerName]) {
        centerStats[centerName] = {
          centerId: item.centerId,
          centerName: centerName,
          totalBills: 0,
          totalAmount: 0,
          paidBills: 0,
          paidAmount: 0,
          pendingBills: 0,
          pendingAmount: 0
        };
      }
      
      centerStats[centerName].totalBills++;
      centerStats[centerName].totalAmount += amount;
      
      if (status === 'paid' || status === 'verified') {
        centerStats[centerName].paidBills++;
        centerStats[centerName].paidAmount += amount;
      } else if (status === 'generated') {
        centerStats[centerName].pendingBills++;
        centerStats[centerName].pendingAmount += amount;
      }

      // Daily stats
      if (generatedDate) {
        const date = new Date(generatedDate).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date: date,
            totalBills: 0,
            totalAmount: 0,
            paidBills: 0,
            paidAmount: 0
          };
        }
        
        dailyStats[date].totalBills++;
        dailyStats[date].totalAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          dailyStats[date].paidBills++;
          dailyStats[date].paidAmount += amount;
        }
      }

      // Monthly stats
      if (generatedDate) {
        const month = new Date(generatedDate).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyStats[month]) {
          monthlyStats[month] = {
            month: month,
            totalBills: 0,
            totalAmount: 0,
            paidBills: 0,
            paidAmount: 0
          };
        }
        
        monthlyStats[month].totalBills++;
        monthlyStats[month].totalAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          monthlyStats[month].paidBills++;
          monthlyStats[month].paidAmount += amount;
        }
      }
    });

    // Convert objects to arrays and sort
    const centerStatsArray = Object.values(centerStats).sort((a, b) => b.totalAmount - a.totalAmount);
    const dailyStatsArray = Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));
    const monthlyStatsArray = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));

    console.log(`✅ Generated billing report for period: ${period}, center: ${centerId}, found ${billingData.length} bills`);
    console.log('🔍 Final stats:', {
      totalBills: stats.totalBills,
      totalAmount: stats.totalAmount,
      paidBills: stats.paidBills,
      paidAmount: stats.paidAmount,
      pendingBills: stats.pendingBills,
      pendingAmount: stats.pendingAmount
    });

    // If no data found, try a simpler query to debug
    if (billingData.length === 0) {
      console.log('🔍 Trying simpler query to debug...');
      
      // Try without date filters
      const simpleQuery = {
        isActive: true,
        billing: { $exists: true, $ne: null }
      };
      
      if (centerId && centerId !== 'all') {
        try {
          const mongoose = require('mongoose');
          simpleQuery.centerId = new mongoose.Types.ObjectId(centerId);
        } catch (error) {
          simpleQuery.centerId = centerId;
        }
      }
      
      const simpleCount = await TestRequest.countDocuments(simpleQuery);
      console.log('🔍 Simple query count (no date filter):', simpleCount);
      
      if (simpleCount > 0) {
        const sampleSimple = await TestRequest.findOne(simpleQuery).select('billing.generatedAt createdAt centerId centerName');
        console.log('🔍 Sample from simple query:', sampleSimple);
      }
      
      // Try with both ObjectId and string formats for center
      if (centerId && centerId !== 'all') {
        try {
          const mongoose = require('mongoose');
          const centerObjectId = new mongoose.Types.ObjectId(centerId);
          
          const objectIdCount = await TestRequest.countDocuments({
            isActive: true,
            billing: { $exists: true, $ne: null },
            centerId: centerObjectId
          });
          
          const stringCount = await TestRequest.countDocuments({
            isActive: true,
            billing: { $exists: true, $ne: null },
            centerId: centerId
          });
          
          console.log('🔍 Center count with ObjectId:', objectIdCount);
          console.log('🔍 Center count with String:', stringCount);
          
          // Check what center IDs actually exist in the database
          const existingCenterIds = await TestRequest.distinct('centerId', {
            isActive: true,
            billing: { $exists: true, $ne: null }
          });
          console.log('🔍 Existing center IDs in database:', existingCenterIds);
          console.log('🔍 Looking for center ID:', centerId);
          console.log('🔍 Center ID found in database:', existingCenterIds.includes(centerId));
          
        } catch (error) {
          console.log('🔍 Error checking with ObjectId:', error.message);
        }
      }
    }

    // Additional debugging for business critical data
    if (billingData.length === 0) {
      console.log('⚠️  WARNING: No billing data found for the selected filters');
      console.log('🔍 Query used:', JSON.stringify(finalQuery, null, 2));
      
      // Check if there's any billing data at all
      const totalBillingCount = await TestRequest.countDocuments({
        isActive: true,
        billing: { $exists: true, $ne: null }
      });
      console.log('🔍 Total billing records in database:', totalBillingCount);
      
      if (totalBillingCount > 0) {
        const sampleRecord = await TestRequest.findOne({
          isActive: true,
          billing: { $exists: true, $ne: null }
        }).select('centerId centerName billing.generatedAt createdAt billing.status billing.amount');
        
        console.log('🔍 Sample billing record:', sampleRecord);
        
        // Check what centers exist in the database
        const centersInDB = await TestRequest.distinct('centerId', {
          isActive: true,
          billing: { $exists: true, $ne: null }
        });
        console.log('🔍 Centers with billing data:', centersInDB);
        
        // Check if the selected center has any data
        if (centerId && centerId !== 'all') {
          const centerDataCount = await TestRequest.countDocuments({
            isActive: true,
            billing: { $exists: true, $ne: null },
            centerId: centerId
          });
          console.log('🔍 Records for selected center:', centerDataCount);
          
          // Try with ObjectId
          try {
            const mongoose = require('mongoose');
            const centerObjectId = new mongoose.Types.ObjectId(centerId);
            const centerDataCountObjectId = await TestRequest.countDocuments({
              isActive: true,
              billing: { $exists: true, $ne: null },
              centerId: centerObjectId
            });
            console.log('🔍 Records for selected center (ObjectId):', centerDataCountObjectId);
          } catch (error) {
            console.log('🔍 Error checking with ObjectId:', error.message);
          }
        }
        
        // Check date ranges
        const dateRangeCheck = await TestRequest.find({
          isActive: true,
          billing: { $exists: true, $ne: null }
        }).limit(5).select('billing.generatedAt createdAt');
        
        console.log('🔍 Sample date ranges in database:', dateRangeCheck.map(doc => ({
          generatedAt: doc.billing?.generatedAt,
          createdAt: doc.createdAt,
          generatedAtType: typeof doc.billing?.generatedAt,
          createdAtType: typeof doc.createdAt
        })));
      }
    }
    
    if (billingData.length > 0) {
      console.log('🔍 Sample billing record centers:', billingData.slice(0, 3).map(item => ({
        id: item._id,
        centerId: item.centerId,
        centerName: item.centerName,
        generatedAt: item.billing?.generatedAt,
        createdAt: item.createdAt,
        status: item.billing?.status
      })));
    } else {
      console.log('🔍 No billing records found. Checking if there are any TestRequest records...');
      // Check if there are any TestRequest records at all
      const totalRecords = await TestRequest.countDocuments({ isActive: true });
      console.log(`🔍 Total active TestRequest records: ${totalRecords}`);
      
      // Check if there are any with billing
      const recordsWithBilling = await TestRequest.countDocuments({ 
        isActive: true, 
        billing: { $exists: true, $ne: null } 
      });
      console.log(`🔍 Records with billing: ${recordsWithBilling}`);
      
      // Check if there are any for the specific center
      if (centerId && centerId !== 'all') {
        const centerRecords = await TestRequest.countDocuments({ 
          isActive: true, 
          centerId: centerId 
        });
        console.log(`🔍 Records for center ${centerId}: ${centerRecords}`);
      }
    }

    res.status(200).json({
      success: true,
      period: period,
      dateRange: {
        startDate: startDate,
        endDate: endDate
      },
      stats: stats,
      centerStats: centerStatsArray,
      dailyStats: dailyStatsArray,
      monthlyStats: monthlyStatsArray,
      billingData: billingData,
      total: billingData.length
    });

  } catch (error) {
    console.error('❌ Error generating billing reports:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate billing reports',
      error: error.message 
    });
  }
};

// Get billing statistics for superadmin
export const getBillingStats = async (req, res) => {
  try {
    console.log('🚀 getBillingStats called');
    
    // Get all test requests with billing information - only include items with actual billing status
    const billingRequests = await TestRequest.find({ 
      isActive: true,
      billing: { $exists: true, $ne: null },
      'billing.status': { $exists: true, $ne: null }
    })
      .select('billing status centerId centerName createdAt')
      .lean();

    // Calculate overall statistics
    const stats = {
      totalBills: 0,
      totalAmount: 0,
      paidBills: 0,
      paidAmount: 0,
      pendingBills: 0,
      pendingAmount: 0,
      generatedBills: 0,
      generatedAmount: 0,
      paymentReceivedBills: 0,
      paymentReceivedAmount: 0,
      cancelledBills: 0,
      cancelledAmount: 0,
      notGeneratedBills: 0
    };

    // Group by center
    const centerStats = {};
    const statusStats = {};
    const monthlyStats = {};

    billingRequests.forEach(item => {
      const amount = item.billing?.amount || 0;
      const status = item.billing?.status || 'not_generated';
      const centerName = item.centerName || 'Unknown Center';
      const generatedDate = item.billing?.generatedAt || item.createdAt;
      
      // Overall stats
      stats.totalBills++;
      stats.totalAmount += amount;
      
      if (status === 'paid' || status === 'verified') {
        stats.paidBills++;
        stats.paidAmount += amount;
      } else if (status === 'generated') {
        stats.pendingBills++;
        stats.pendingAmount += amount;
        stats.generatedBills++;
        stats.generatedAmount += amount;
      } else if (status === 'payment_received') {
        stats.paymentReceivedBills++;
        stats.paymentReceivedAmount += amount;
        stats.generatedBills++;
        stats.generatedAmount += amount;
      } else if (status === 'cancelled') {
        stats.cancelledBills++;
        stats.cancelledAmount += amount;
      } else if (status === 'not_generated') {
        stats.notGeneratedBills++;
      }

      // Status stats
      if (!statusStats[status]) {
        statusStats[status] = {
          status: status,
          count: 0,
          amount: 0
        };
      }
      statusStats[status].count++;
      statusStats[status].amount += amount;

      // Center stats
      if (!centerStats[centerName]) {
        centerStats[centerName] = {
          centerName: centerName,
          centerId: item.centerId,
          totalBills: 0,
          totalAmount: 0,
          paidBills: 0,
          paidAmount: 0,
          pendingBills: 0,
          pendingAmount: 0
        };
      }
      
      centerStats[centerName].totalBills++;
      centerStats[centerName].totalAmount += amount;
      
      if (status === 'paid' || status === 'verified') {
        centerStats[centerName].paidBills++;
        centerStats[centerName].paidAmount += amount;
      } else if (status === 'generated') {
        centerStats[centerName].pendingBills++;
        centerStats[centerName].pendingAmount += amount;
      }

      // Monthly stats
      if (generatedDate) {
        const month = new Date(generatedDate).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyStats[month]) {
          monthlyStats[month] = {
            month: month,
            totalBills: 0,
            totalAmount: 0,
            paidBills: 0,
            paidAmount: 0
          };
        }
        
        monthlyStats[month].totalBills++;
        monthlyStats[month].totalAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          monthlyStats[month].paidBills++;
          monthlyStats[month].paidAmount += amount;
        }
      }
    });

    // Convert objects to arrays and sort
    const centerStatsArray = Object.values(centerStats).sort((a, b) => b.totalAmount - a.totalAmount);
    const statusStatsArray = Object.values(statusStats);
    const monthlyStatsArray = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));

    console.log(`✅ Generated billing stats: ${stats.totalBills} total bills, ${stats.totalAmount} total amount`);

    res.status(200).json({
      success: true,
      stats: stats,
      centerStats: centerStatsArray,
      statusStats: statusStatsArray,
      monthlyStats: monthlyStatsArray,
      total: stats.totalBills
    });

  } catch (error) {
    console.error('❌ Error fetching billing stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch billing statistics',
      error: error.message 
    });
  }
};

// Get billing reports for center admin
export const getCenterBillingReports = async (req, res) => {
  try {
    console.log('🚀 getCenterBillingReports called for center:', req.user.centerId);
    
    const { period, startDate, endDate } = req.query;
    const centerId = req.user.centerId;
    
    if (!centerId) {
      return res.status(400).json({ message: 'Center ID is required' });
    }

    console.log('📋 Center report parameters:', {
      period,
      centerId,
      startDate,
      endDate
    });

    // Build date filter based on period
    let dateFilter = {};
    const now = new Date();
    console.log('🔍 Center Current time:', now.toISOString());
    
    if (period === 'daily') {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      console.log('🔍 Center Daily filter - Today:', today.toISOString(), 'Tomorrow:', tomorrow.toISOString());
      dateFilter = {
        $or: [
          { 'billing.generatedAt': { $gte: today, $lt: tomorrow } },
          { createdAt: { $gte: today, $lt: tomorrow } }
        ]
      };
    } else if (period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      console.log('🔍 Center Weekly filter - Week ago:', weekAgo.toISOString(), 'Now:', now.toISOString());
      dateFilter = {
        $or: [
          { 'billing.generatedAt': { $gte: weekAgo } },
          { createdAt: { $gte: weekAgo } }
        ]
      };
    } else if (period === 'monthly') {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      monthAgo.setHours(0, 0, 0, 0);
      console.log('🔍 Center Monthly filter - Month ago:', monthAgo.toISOString(), 'Now:', now.toISOString());
      dateFilter = {
        $or: [
          { 'billing.generatedAt': { $gte: monthAgo } },
          { createdAt: { $gte: monthAgo } }
        ]
      };
    } else if (period === 'yearly') {
      const yearAgo = new Date(now);
      yearAgo.setDate(yearAgo.getDate() - 365);
      yearAgo.setHours(0, 0, 0, 0);
      console.log('🔍 Center Yearly filter - Year ago:', yearAgo.toISOString(), 'Now:', now.toISOString());
      dateFilter = {
        $or: [
          { 'billing.generatedAt': { $gte: yearAgo } },
          { createdAt: { $gte: yearAgo } }
        ]
      };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      console.log('🔍 Center Custom date range - Start:', start.toISOString(), 'End:', end.toISOString());
      dateFilter = {
        $or: [
          { 'billing.generatedAt': { $gte: start, $lte: end } },
          { createdAt: { $gte: start, 'billing.generatedAt': { $gte: start, $lte: end }, $lte: end } }
        ]
      };
    }

    // Build query for this center only - only include items with actual billing status
    let query = {
      centerId: centerId,
      isActive: true,
      billing: { $exists: true, $ne: null },
      'billing.status': { $exists: true, $ne: null },
      ...dateFilter
    };

    console.log('🔍 Center query:', JSON.stringify(query, null, 2));

    // Get billing data with aggregation
    const billingData = await TestRequest.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient'
        }
      },
      {
        $project: {
          _id: 1,
          patientName: 1,
          testType: 1,
          testDescription: 1,
          urgency: 1,
          status: 1,
          centerId: 1,
          centerName: 1,
          centerCode: 1,
          doctorId: 1,
          doctorName: 1,
          patientId: 1,
          billing: 1,
          createdAt: 1,
          updatedAt: 1,
          'doctor.name': 1,
          'doctor.email': 1,
          'patient.name': 1,
          'patient.phone': 1
        }
      },
      { $sort: { 'billing.generatedAt': -1 } }
    ]);

    // Calculate statistics
    const stats = {
      totalBills: billingData.length,
      totalAmount: 0,
      paidBills: 0,
      paidAmount: 0,
      pendingBills: 0,
      pendingAmount: 0,
      generatedBills: 0,
      generatedAmount: 0,
      paymentReceivedBills: 0,
      paymentReceivedAmount: 0,
      cancelledBills: 0,
      cancelledAmount: 0
    };

    // Group by doctor
    const doctorStats = {};
    const dailyStats = {};
    const monthlyStats = {};

    billingData.forEach(item => {
      const amount = item.billing?.amount || 0;
      const status = item.billing?.status || 'not_generated';
      const doctorName = item.doctorName || 'Unknown Doctor';
      const generatedDate = item.billing?.generatedAt || item.createdAt;
      
      // Overall stats
      stats.totalAmount += amount;
      stats.totalBills++;
      
      // Only count as generated if billing exists
      if (item.billing && item.billing.status) {
        stats.generatedBills++;
        stats.generatedAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          stats.paidBills++;
          stats.paidAmount += amount;
        } else if (status === 'generated') {
          stats.pendingBills++;
          stats.pendingAmount += amount;
        } else if (status === 'payment_received') {
          stats.paymentReceivedBills++;
          stats.paymentReceivedAmount += amount;
        } else if (status === 'cancelled') {
          stats.cancelledBills++;
          stats.cancelledAmount += amount;
        }
      }

      // Doctor stats
      if (!doctorStats[doctorName]) {
        doctorStats[doctorName] = {
          doctorId: item.doctorId,
          doctorName: doctorName,
          totalBills: 0,
          totalAmount: 0,
          paidBills: 0,
          paidAmount: 0,
          pendingBills: 0,
          pendingAmount: 0
        };
      }
      
      doctorStats[doctorName].totalBills++;
      doctorStats[doctorName].totalAmount += amount;
      
      if (status === 'paid' || status === 'verified') {
        doctorStats[doctorName].paidBills++;
        doctorStats[doctorName].paidAmount += amount;
      } else if (status === 'generated') {
        doctorStats[doctorName].pendingBills++;
        doctorStats[doctorName].pendingAmount += amount;
      }

      // Daily stats
      if (generatedDate) {
        const date = new Date(generatedDate).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date: date,
            totalBills: 0,
            totalAmount: 0,
            paidBills: 0,
            paidAmount: 0
          };
        }
        
        dailyStats[date].totalBills++;
        dailyStats[date].totalAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          dailyStats[date].paidBills++;
          dailyStats[date].paidAmount += amount;
        }
      }

      // Monthly stats
      if (generatedDate) {
        const month = new Date(generatedDate).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyStats[month]) {
          monthlyStats[month] = {
            month: month,
            totalBills: 0,
            totalAmount: 0,
            paidBills: 0,
            paidAmount: 0
          };
        }
        
        monthlyStats[month].totalBills++;
        monthlyStats[month].totalAmount += amount;
        
        if (status === 'paid' || status === 'verified') {
          monthlyStats[month].paidBills++;
          monthlyStats[month].paidAmount += amount;
        }
      }
    });

    // Convert objects to arrays and sort
    const doctorStatsArray = Object.values(doctorStats).sort((a, b) => b.totalAmount - a.totalAmount);
    const dailyStatsArray = Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));
    const monthlyStatsArray = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));

    console.log(`✅ Generated center billing report for period: ${period}, found ${billingData.length} bills`);
    console.log('🔍 Center Final stats:', {
      totalBills: stats.totalBills,
      totalAmount: stats.totalAmount,
      paidBills: stats.paidBills,
      paidAmount: stats.paidAmount,
      pendingBills: stats.pendingBills,
      pendingAmount: stats.pendingAmount
    });
    
    // Debug: Show sample data for different periods
    if (billingData.length > 0) {
      console.log('🔍 Center Sample billing data:', billingData.slice(0, 3).map(item => ({
        patientName: item.patientName,
        amount: item.billing?.amount,
        status: item.billing?.status,
        generatedAt: item.billing?.generatedAt,
        createdAt: item.createdAt,
        doctorName: item.doctorName
      })));
    } else {
      console.log('🔍 Center: No billing records found. Checking if there are any TestRequest records...');
      // Check if there are any TestRequest records at all for this center
      const totalRecords = await TestRequest.countDocuments({ 
        isActive: true, 
        centerId: centerId 
      });
      console.log(`🔍 Center: Total active TestRequest records for center ${centerId}: ${totalRecords}`);
      
      // Check if there are any with billing for this center
      const recordsWithBilling = await TestRequest.countDocuments({ 
        isActive: true, 
        centerId: centerId,
        billing: { $exists: true, $ne: null } 
      });
      console.log(`🔍 Center: Records with billing for center ${centerId}: ${recordsWithBilling}`);
    }

    res.status(200).json({
      success: true,
      period: period,
      centerId: centerId,
      dateRange: {
        startDate: startDate,
        endDate: endDate
      },
      stats: stats,
      doctorStats: doctorStatsArray,
      dailyStats: dailyStatsArray,
      monthlyStats: monthlyStatsArray,
      billingData: billingData,
      total: billingData.length
    });

  } catch (error) {
    console.error('❌ Error generating center billing reports:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate center billing reports',
      error: error.message 
    });
  }
};

// Create consultation fee billing (Receptionist action)
export const createConsultationFeeBilling = async (req, res) => {
  try {
    console.log('🚀 createConsultationFeeBilling called');
    console.log('📋 Request body:', req.body);

    const { patientId, doctorId, amount, paymentMethod, notes, isReassignedEntry, reassignedEntryId } = req.body;

    // Validate required fields
    if (!patientId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and amount are required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }

    // Find the patient
    const patient = await Patient.findById(patientId).populate('centerId', 'name');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if consultation fee already exists for the current doctor
    // For reassigned patients, we allow multiple consultation fees (one per doctor)
    // Reassigned patients are treated as new patients but without registration fee
    const currentDoctorId = doctorId || patient.assignedDoctor?._id || patient.assignedDoctor;
    
    console.log('🔍 Patient assigned doctor info:', {
      patientId: patient._id,
      patientName: patient.name,
      assignedDoctor: patient.assignedDoctor,
      assignedDoctorId: patient.assignedDoctor?._id,
      currentDoctorId: currentDoctorId,
      doctorIdFromRequest: doctorId,
      isReassignedEntry: isReassignedEntry,
      reassignedEntryId: reassignedEntryId,
      note: 'Reassigned patients treated as new patients (no registration fee required)'
    });
    
    const existingConsultationFee = patient.billing && patient.billing.find(bill => 
      (bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')) &&
      bill.doctorId && bill.doctorId.toString() === currentDoctorId?.toString()
    );

    if (existingConsultationFee) {
      return res.status(400).json({
        success: false,
        message: 'Consultation fee already exists for this patient with the current doctor'
      });
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'CON');

    // Create consultation fee billing record
    // For reassigned patients, treat them as new patients (no registration fee required)
    const consultationFee = {
      type: 'consultation',
      description: notes || `Doctor consultation fee for ${patient.name}${isReassignedEntry ? ' (reassigned patient)' : ''}`,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'cash',
      status: 'paid',
      paidBy: req.user.name,
      paidAt: new Date(),
      invoiceNumber: invoiceNumber,
      doctorId: currentDoctorId, // Track which doctor this consultation fee is for
      isReassignedEntry: isReassignedEntry || false,
      reassignedEntryId: reassignedEntryId || null,
      createdAt: new Date()
    };
    
    console.log('🔍 Created consultation fee:', {
      type: consultationFee.type,
      description: consultationFee.description,
      amount: consultationFee.amount,
      doctorId: consultationFee.doctorId,
      doctorIdType: typeof consultationFee.doctorId,
      doctorIdString: consultationFee.doctorId?.toString(),
      currentDoctorId: currentDoctorId,
      currentDoctorIdType: typeof currentDoctorId,
      currentDoctorIdString: currentDoctorId?.toString(),
      invoiceNumber: consultationFee.invoiceNumber
    });

    // Add billing record to patient ONLY if it's not a reassigned entry
    if (!isReassignedEntry) {
      if (!patient.billing) {
        patient.billing = [];
      }
      patient.billing.push(consultationFee);

      // Save patient
      await patient.save();
    } else {
      console.log('⚠️ Skipping adding billing record to patient - this is a reassigned entry');
    }

    console.log('✅ Consultation fee billing created successfully');
    console.log('📋 Updated patient billing:', patient.billing);
    console.log('📋 Patient ID:', patient._id);
    console.log('📋 Patient name:', patient.name);
    
    // Verify the billing was actually saved
    const savedPatient = await Patient.findById(patient._id);
    console.log('📋 Verification - Saved patient billing:', savedPatient.billing);

    // LOG CONSULTATION FEE PAYMENT
    try {
      const paymentData = {
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'cash',
        paymentType: 'consultation',
        status: 'completed',
        notes: notes,
        currency: 'INR',
        invoiceNumber: consultationFee.invoiceNumber
      };

      const metadata = {
        source: 'web',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        isReassignedEntry: isReassignedEntry || false,
        reassignedEntryId: reassignedEntryId || null
      };

      // Create a virtual test request ID for consultation fees
      const consultationTestRequestId = `consultation-${patient._id}-${Date.now()}`;
      
      await logPaymentTransaction(
        paymentData, 
        consultationTestRequestId, 
        req.user.id || req.user._id, 
        metadata
      );
      console.log('✅ Consultation fee payment logged successfully');
    } catch (paymentLogError) {
      console.error('❌ Error logging consultation fee payment:', paymentLogError);
      // Continue execution - payment logging failure should not stop the transaction
    }

    // Create consultation transaction record
    try {
      const consultationTransactionData = {
        patientId: patientId,
        doctorId: currentDoctorId,
        centerId: patient.centerId,
        consultationType: 'OP', // Default consultation type
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'cash',
        paymentType: parseFloat(amount) >= (consultationFee.amount || 0) ? 'full' : 'partial',
        invoiceNumber: consultationFee.invoiceNumber,
        paymentBreakdown: {
          registrationFee: 0,
          consultationFee: parseFloat(amount),
          serviceCharges: [],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        notes: notes || 'Consultation fee payment processed'
      };

      await TransactionService.createConsultationTransaction(consultationTransactionData, req.user);
      console.log('✅ Consultation transaction created successfully');
    } catch (transactionError) {
      console.error('❌ Error creating consultation transaction:', transactionError);
      // Continue execution - transaction creation failure should not stop the payment
    }

    res.status(201).json({
      success: true,
      message: 'Consultation fee payment recorded successfully',
      billing: consultationFee,
      patient: patient // Return the complete updated patient object
    });

  } catch (error) {
    console.error('❌ Error creating consultation fee billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record consultation fee payment',
      error: error.message
    });
  }
};

// Create registration fee billing (for new patients only)
export const createRegistrationFeeBilling = async (req, res) => {
  try {
    console.log('🚀 createRegistrationFeeBilling called');
    
    const { patientId, registrationFee, serviceCharges, amount, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!patientId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and amount are required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if patient is new (registered within last 24 hours)
    const isNewPatient = isPatientNew(patient);
    if (!isNewPatient) {
      return res.status(400).json({
        success: false,
        message: 'Registration fee can only be charged for new patients (registered within 24 hours)'
      });
    }

    // Check if registration fee already exists
    const existingRegistrationFee = patient.billing && patient.billing.find(bill => 
      bill.type === 'registration'
    );

    if (existingRegistrationFee) {
      return res.status(400).json({
        success: false,
        message: 'Registration fee already exists for this patient'
      });
    }

    // If frontend sends separate registrationFee and serviceCharges, create separate billing records
    if (registrationFee && serviceCharges) {
      const billingRecords = [];

      // Create registration fee billing record
      const registrationInvoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'REG');
      const registrationBill = {
        type: 'registration',
        description: `Registration fee for new patient ${patient.name}`,
        amount: parseFloat(registrationFee),
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        paidBy: req.user.name,
        paidAt: new Date(),
        invoiceNumber: registrationInvoiceNumber,
        createdAt: new Date()
      };
      billingRecords.push(registrationBill);

      // Create service charges billing record
      const serviceInvoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'SRV');
      const serviceBill = {
        type: 'service',
        description: `Service charges for new patient ${patient.name}`,
        amount: parseFloat(serviceCharges),
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        paidBy: req.user.name,
        paidAt: new Date(),
        invoiceNumber: serviceInvoiceNumber,
        createdAt: new Date()
      };
      billingRecords.push(serviceBill);

      // Add billing records to patient
      if (!patient.billing) {
        patient.billing = [];
      }
      patient.billing.push(...billingRecords);

      // Save patient
      await patient.save();

      console.log('✅ Registration and service charges billing created successfully');

      res.status(201).json({
        success: true,
        message: 'Registration and service charges payment recorded successfully',
        billing: billingRecords,
        patient: patient
      });
    } else {
      // Legacy single record approach
      const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'REG');
      const registrationFeeRecord = {
        type: 'registration',
        description: notes || `Registration fee for new patient ${patient.name}`,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        paidBy: req.user.name,
        paidAt: new Date(),
        invoiceNumber: invoiceNumber,
        createdAt: new Date()
      };

      // Add billing record to patient
      if (!patient.billing) {
        patient.billing = [];
      }
      patient.billing.push(registrationFeeRecord);

      // Save patient
      await patient.save();

      console.log('✅ Registration fee billing created successfully');

      res.status(201).json({
        success: true,
        message: 'Registration fee payment recorded successfully',
        billing: registrationFeeRecord,
        patient: patient
      });
    }

  } catch (error) {
    console.error('❌ Error creating registration fee billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record registration fee payment',
      error: error.message
    });
  }
};

// Create service charges billing
export const createServiceChargesBilling = async (req, res) => {
  try {
    console.log('🚀 createServiceChargesBilling called');
    
    const { patientId, services, paymentMethod, notes, doctorId, isReassignedEntry, reassignedEntryId } = req.body;

    // Validate required fields
    if (!patientId || !services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and services array are required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Process each service
    const serviceBills = [];
    let totalAmount = 0;

    for (const service of services) {
      if (!service.name || !service.amount) {
        return res.status(400).json({
          success: false,
          message: 'Each service must have a name and amount'
        });
      }

      // Generate invoice number for each service
      const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'SRV');

      const serviceBill = {
        type: 'service',
        description: service.description || service.name,
        amount: parseFloat(service.amount),
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        paidBy: req.user.name,
        paidAt: new Date(),
        invoiceNumber: invoiceNumber,
        serviceDetails: service.details || '',
        doctorId: doctorId || patient.assignedDoctor?._id || patient.assignedDoctor, // Track which doctor this service is for
        isReassignedEntry: isReassignedEntry || false,
        reassignedEntryId: reassignedEntryId || null,
        createdAt: new Date()
      };

      serviceBills.push(serviceBill);
      totalAmount += parseFloat(service.amount);
    }

    // Add billing records to patient ONLY if it's not a reassigned entry
    if (!isReassignedEntry) {
      if (!patient.billing) {
        patient.billing = [];
      }
      patient.billing.push(...serviceBills);

      // Save patient
      await patient.save();
    } else {
      console.log('⚠️ Skipping adding service billing records to patient - this is a reassigned entry');
    }

    console.log('✅ Service charges billing created successfully');

    res.status(201).json({
      success: true,
      message: 'Service charges payment recorded successfully',
      billing: serviceBills,
      totalAmount: totalAmount,
      patient: patient
    });

  } catch (error) {
    console.error('❌ Error creating service charges billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record service charges payment',
      error: error.message
    });
  }
};

// Generate invoice for patient
export const generatePatientInvoice = async (req, res) => {
  try {
    console.log('🚀 generatePatientInvoice called');
    
    const { patientId, billingIds, isReassignedEntry, reassignedEntryId, currentDoctorId } = req.body;

    // Validate required fields
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }

    // Find the patient
    const patient = await Patient.findById(patientId)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name');
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get billing records and EXCLUDE reassigned billing records
    let billingRecords = (patient.billing || []).filter(bill => {
      // Exclude any billing records that are marked as reassigned entries
      return !bill.isReassignedEntry;
    });
    
    console.log('🔍 Original billing records (excluding reassigned):', billingRecords.map(bill => ({
      id: bill._id,
      type: bill.type,
      description: bill.description,
      doctorId: bill.doctorId,
      amount: bill.amount,
      isReassignedEntry: bill.isReassignedEntry,
      reassignedEntryId: bill.reassignedEntryId,
      createdAt: bill.createdAt
    })));
    
    // Filter by specific billing IDs if provided
    if (billingIds && Array.isArray(billingIds) && billingIds.length > 0) {
      billingRecords = billingRecords.filter(bill => billingIds.includes(bill._id.toString()));
      console.log('🔍 Filtered by specific billing IDs:', billingRecords.length);
    }

    // For reassigned entries, create completely fresh invoices with only reassigned billing
    if (isReassignedEntry && currentDoctorId) {
      console.log('🔍 Creating fresh invoice for reassigned entry - current doctor:', currentDoctorId);
      
      // Only include billing records that are specifically for this reassigned entry
      billingRecords = billingRecords.filter(bill => {
        // Include only billing records that are marked as reassigned entries
        // This ensures completely separate invoices for reassigned patients
        return bill.isReassignedEntry && 
               bill.reassignedEntryId === reassignedEntryId &&
               bill.doctorId && 
               bill.doctorId.toString() === currentDoctorId.toString();
      });
      
      console.log('🔍 Fresh billing records for reassigned entry:', billingRecords.length);
      
      // If no reassigned billing records exist yet, that's okay - they'll get a fresh invoice
      // when they make their first payment after reassignment
    }

    if (billingRecords.length === 0) {
      // For reassigned patients, allow empty invoice generation
      if (isReassignedEntry) {
        console.log('🔍 No billing records for reassigned patient - generating empty invoice');
        billingRecords = []; // Allow empty billing records for reassigned patients
      } else {
        return res.status(400).json({
          success: false,
          message: 'No billing records found for invoice generation'
        });
      }
    }

    // Calculate totals by type
    const totals = {
      consultation: 0,
      registration: 0,
      service: 0,
      test: 0,
      medication: 0,
      total: 0
    };

    // Only calculate totals if there are billing records
    if (billingRecords.length > 0) {
      billingRecords.forEach(bill => {
        totals[bill.type] = (totals[bill.type] || 0) + bill.amount;
        totals.total += bill.amount;
      });
    }

    // Generate invoice number - special format for reassigned patients
    const invoicePrefix = isReassignedEntry ? 'REASSIGN' : 'INV';
    const invoiceNumber = generateInvoiceNumber(patient.centerCode || invoicePrefix, invoicePrefix);

    // Get the original creator from the first billing record
    const originalCreator = billingRecords.length > 0 ? billingRecords[0].paidBy : req.user.name;

    // Get the doctor name from the consultation fee (for reassigned patients)
    const consultationFee = billingRecords.find(bill => 
      bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')
    );
    const doctorName = consultationFee?.doctorId ? 
      (await User.findById(consultationFee.doctorId))?.name || patient.assignedDoctor?.name || 'Not Assigned' :
      patient.assignedDoctor?.name || 'Not Assigned';

    // Create invoice data
    const invoice = {
      invoiceNumber: invoiceNumber,
      isReassignedEntry: isReassignedEntry || false,
      reassignedEntryId: reassignedEntryId || null,
      patient: {
        name: patient.name,
        uhId: patient.uhId,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        age: patient.age,
        gender: patient.gender,
        reassignmentHistory: patient.reassignmentHistory || []
      },
      center: {
        name: patient.centerId?.name || 'Medical Center',
        code: patient.centerId?.code || 'MC'
      },
      doctor: doctorName,
      billingRecords: billingRecords,
      totals: totals,
      generatedAt: new Date(),
      generatedBy: originalCreator
    };

    console.log('✅ Invoice generated successfully');

    res.status(200).json({
      success: true,
      message: 'Invoice generated successfully',
      invoice: invoice
    });

  } catch (error) {
    console.error('❌ Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  }
};

// Helper function to generate invoice number
const generateInvoiceNumber = (centerCode, type) => {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${centerCode}-${type}-${timestamp}-${randomSuffix}`;
};

// Helper function to check if patient is new
const isPatientNew = (patient) => {
  const registrationDate = new Date(patient.createdAt);
  const now = new Date();
  const hoursDifference = (now - registrationDate) / (1000 * 60 * 60);
  return hoursDifference <= 24;
};

// Update existing billing records with missing invoice numbers
export const updateMissingInvoiceNumbers = async (req, res) => {
  try {
    console.log('🚀 updateMissingInvoiceNumbers called');
    
    // Find all patients with billing records that don't have invoice numbers
    const patients = await Patient.find({
      'billing.invoiceNumber': { $exists: false }
    });

    let updatedCount = 0;
    let totalBillingRecords = 0;

    for (const patient of patients) {
      if (patient.billing && patient.billing.length > 0) {
        let patientUpdated = false;
        
        for (const billingRecord of patient.billing) {
          totalBillingRecords++;
          
          if (!billingRecord.invoiceNumber) {
            // Generate invoice number based on billing type
            let typeCode = 'BILL';
            if (billingRecord.type === 'consultation') {
              typeCode = 'CON';
            } else if (billingRecord.type === 'registration') {
              typeCode = 'REG';
            } else if (billingRecord.type === 'service') {
              typeCode = 'SRV';
            } else if (billingRecord.type === 'test') {
              typeCode = 'TST';
            } else if (billingRecord.type === 'medication') {
              typeCode = 'MED';
            }
            
            billingRecord.invoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', typeCode);
            patientUpdated = true;
            updatedCount++;
          }
        }
        
        if (patientUpdated) {
          await patient.save();
          console.log(`✅ Updated invoice numbers for patient: ${patient.name}`);
        }
      }
    }

    console.log(`✅ Updated ${updatedCount} billing records with invoice numbers`);

    res.status(200).json({
      success: true,
      message: 'Invoice numbers updated successfully',
      updatedRecords: updatedCount,
      totalRecords: totalBillingRecords,
      patientsProcessed: patients.length
    });

  } catch (error) {
    console.error('❌ Error updating missing invoice numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update missing invoice numbers',
      error: error.message
    });
  }
};

// Update billing details for a test request (Center Admin action)
export const updateBillDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, invoiceNumber, status, updatedBy, updatedAt } = req.body;

    console.log('🔄 Updating bill details for test request:', id);
    console.log('📝 Update data:', { amount, description, invoiceNumber, status, updatedBy });

    // Find the test request
    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({
        success: false,
        message: 'Test request not found'
      });
    }

    // Check if billing exists
    if (!testRequest.billing) {
      return res.status(400).json({
        success: false,
        message: 'No billing information found for this test request'
      });
    }

    // Update billing details
    if (amount !== undefined) testRequest.billing.amount = amount;
    if (description !== undefined) testRequest.billing.description = description;
    if (invoiceNumber !== undefined) testRequest.billing.invoiceNumber = invoiceNumber;
    if (status !== undefined) testRequest.billing.status = status;
    
    // Add update tracking
    testRequest.billing.updatedBy = updatedBy || 'Center Admin';
    testRequest.billing.updatedAt = updatedAt || new Date();
    testRequest.updatedAt = new Date();

    // Save the updated test request
    const updated = await testRequest.save();

    console.log('✅ Bill details updated successfully');
    console.log('📋 Updated billing:', updated.billing);

    res.status(200).json({
      success: true,
      message: 'Bill details updated successfully',
      billing: updated.billing,
      testRequestId: updated._id
    });

  } catch (error) {
    console.error('❌ Error updating bill details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bill details',
      error: error.message
    });
  }
};

// Update payment status for a test request (Center Admin action)
export const updatePaymentStatus = async (req, res) => {
  try {
    console.log('🚀 updatePaymentStatus function called');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request body:', req.body);
    console.log('👤 User:', req.user);
    
    // Handle case where user might not be available (testing without middleware)
    if (!req.user) {
      console.log('⚠️ No user found - testing without middleware');
    }
    
    const { id } = req.params;
    const { paidAmount, paymentStatus, paymentMethod, notes, updatedBy, updatedAt } = req.body;

    console.log('💰 Updating payment status for test request:', id);
    console.log('📝 Payment update data:', { paidAmount, paymentStatus, paymentMethod, notes, updatedBy });

    // Find the test request
    console.log('🔍 Searching for test request with ID:', id);
    let testRequest;
    try {
      testRequest = await TestRequest.findById(id);
      console.log('✅ Database query completed');
    } catch (dbError) {
      console.error('❌ Database error finding test request:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while finding test request',
        error: dbError.message
      });
    }
    
    if (!testRequest) {
      console.log('❌ Test request not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Test request not found'
      });
    }

    console.log('✅ Test request found:', {
      id: testRequest._id,
      patientName: testRequest.patientName,
      testType: testRequest.testType,
      hasBilling: !!testRequest.billing,
      billingStructure: testRequest.billing ? Object.keys(testRequest.billing) : 'No billing'
    });

    // Check if billing exists
    if (!testRequest.billing) {
      console.log('❌ No billing information found for test request:', id);
      return res.status(400).json({
        success: false,
        message: 'No billing information found for this test request'
      });
    }

    const totalAmount = testRequest.billing.amount || 0;
    console.log('💰 Current billing info:', {
      totalAmount,
      currentPaidAmount: testRequest.billing.paidAmount || 0,
      currentStatus: testRequest.billing.status,
      currentPaymentStatus: testRequest.billing.paymentStatus
    });
    
    // Convert paidAmount to number to ensure proper type
    const numericPaidAmount = parseFloat(paidAmount) || 0;
    console.log('💰 Converting paid amount:', { original: paidAmount, converted: numericPaidAmount });
    
    // ✅ FIXED: Store previous paid amount BEFORE updating for payment logging
    const previousPaidAmount = testRequest.billing?.paidAmount || 0;
    console.log('💰 Previous vs new paid amount:', { previous: previousPaidAmount, new: numericPaidAmount });
    
    // Validate data types before proceeding
    console.log('🔍 Data type validation:', {
      paidAmount: typeof numericPaidAmount,
      paymentMethod: typeof paymentMethod,
      paymentStatus: typeof paymentStatus,
      notes: typeof notes,
      updatedBy: typeof updatedBy
    });
    
    // Validate paid amount
    if (numericPaidAmount < 0 || numericPaidAmount > totalAmount) {
      console.log('❌ Invalid paid amount:', { paidAmount: numericPaidAmount, totalAmount });
      return res.status(400).json({
        success: false,
        message: `Paid amount must be between 0 and ${totalAmount}`
      });
    }

    // Ensure billing object is properly initialized
    if (!testRequest.billing) {
      testRequest.billing = {};
    }

    // Initialize missing fields with defaults if they don't exist
    if (testRequest.billing.paidAmount === undefined) {
      testRequest.billing.paidAmount = 0;
    }
    if (testRequest.billing.paymentStatus === undefined) {
      testRequest.billing.paymentStatus = 'pending';
    }
    if (testRequest.billing.paymentNotes === undefined) {
      testRequest.billing.paymentNotes = '';
    }
    if (testRequest.billing.paymentMethod === undefined) {
      testRequest.billing.paymentMethod = 'cash';
    }

    // Update payment information
    testRequest.billing.paidAmount = numericPaidAmount;
    testRequest.billing.paymentMethod = paymentMethod || testRequest.billing.paymentMethod || 'cash';
    testRequest.billing.paymentNotes = notes || testRequest.billing.paymentNotes || '';
    
    // Update status based on payment amount
    if (numericPaidAmount >= totalAmount) {
      testRequest.billing.status = 'paid';
      testRequest.billing.paymentStatus = 'completed';
      
      // ✅ FIXED: If tests are already completed, set status to Report_Sent to prevent new request creation
      if (['Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'].includes(testRequest.status)) {
        testRequest.status = 'Report_Sent'; // Keep as Report_Sent to prevent new request creation
        console.log('✅ Payment completed - Test request already completed, keeping Report_Sent status');
      } else if (testRequest.status === 'Billing_Paid' || testRequest.status === 'Billing_Generated') {
        // Update to a status that allows report access
        testRequest.status = 'Billing_Paid';
        console.log('✅ Payment completed - Updated test request status to Billing_Paid');
      }
    } else if (numericPaidAmount > 0) {
      testRequest.billing.status = 'partially_paid'; // ✅ Fixed: Use correct enum value
      testRequest.billing.paymentStatus = 'partial';
    } else {
      testRequest.billing.status = 'generated';
      testRequest.billing.paymentStatus = 'pending';
    }
    
    // Override status if explicitly provided
    if (paymentStatus) {
      testRequest.billing.paymentStatus = paymentStatus;
      if (paymentStatus === 'completed') {
        testRequest.billing.status = 'paid';
        
        // ✅ FIXED: If tests are already completed, set status to Report_Sent to prevent new request creation
        if (['Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'].includes(testRequest.status)) {
          testRequest.status = 'Report_Sent'; // Keep as Report_Sent to prevent new request creation
          console.log('✅ Payment explicitly completed - Test request already completed, keeping Report_Sent status');
        } else if (testRequest.status === 'Billing_Paid' || testRequest.status === 'Billing_Generated') {
          testRequest.status = 'Billing_Paid';
          console.log('✅ Payment explicitly completed - Updated test request status to Billing_Paid');
        }
      } else if (paymentStatus === 'partial') {
        testRequest.billing.status = 'partially_paid'; // ✅ Fixed: Use correct enum value
      } else {
        testRequest.billing.status = 'generated';
      }
    }
    
    // Add update tracking
    testRequest.billing.updatedBy = updatedBy || 'Center Admin';
    testRequest.billing.updatedAt = updatedAt || new Date();
    testRequest.updatedAt = new Date();

    console.log('💾 Saving updated test request...');
    console.log('📋 Test request before save:', {
      id: testRequest._id,
      billing: testRequest.billing,
      billingKeys: testRequest.billing ? Object.keys(testRequest.billing) : 'No billing'
    });
    
    // Save the updated test request with error handling
    let updated;
    try {
      updated = await testRequest.save();
      console.log('✅ Test request saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving test request:', saveError);
      console.error('❌ Save error details:', {
        message: saveError.message,
        name: saveError.name,
        code: saveError.code,
        errors: saveError.errors,
        stack: saveError.stack
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to save test request',
        error: saveError.message,
        details: saveError.errors || saveError.code,
        fullError: {
          name: saveError.name,
          code: saveError.code,
          errors: saveError.errors,
          stack: saveError.stack
        }
      });
    }

    // LOG PAYMENT TRANSACTION
    try {
      console.log('🔍 Attempting to log payment transaction in updatePaymentStatus:', {
        testRequestId: testRequest._id,
        paidAmount: numericPaidAmount,
        paymentMethod: paymentMethod || 'cash',
        userId: req.user?.id || req.user?._id
      });

      // Check if this is a new payment (not just a status update)
      const paymentDifference = numericPaidAmount - previousPaidAmount;
      
      if (paymentDifference > 0) {
        // This is a new payment - log it as a transaction
        const paymentData = {
          amount: paymentDifference,
          paymentMethod: paymentMethod || 'cash',
          transactionId: `ADMIN-${Date.now()}`,
          notes: notes || `Payment updated by admin - Amount: ${paymentDifference}`,
          currency: 'INR',
          paymentType: 'test',
          status: 'completed'
        };

        const metadata = {
          source: 'admin',
          ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
          userAgent: req.headers?.['user-agent'] || 'admin-panel'
        };

        const paymentLog = await logPaymentTransaction(paymentData, testRequest._id, req.user?.id || req.user?._id, metadata);
        console.log('✅ Payment transaction logged successfully:', paymentLog._id);
      }

      // Also log status update if status changed
      const previousStatus = testRequest.billing?.status || 'not_generated';
      const currentStatus = updated.billing?.status;
      
      if (currentStatus !== previousStatus) {
        await logPaymentStatusUpdate(
          testRequest._id,
          previousStatus,
          currentStatus,
          req.user?.id || req.user?._id,
          `Payment status updated by admin`,
          `Updated payment amount to ${numericPaidAmount}, status changed from ${previousStatus} to ${currentStatus}`
        );
        console.log('✅ Payment status update logged successfully');
      }
    } catch (paymentLogError) {
      console.error('❌ Error logging payment transaction:', paymentLogError);
      // Continue execution - logging failure should not stop the transaction
    }

    console.log('✅ Payment status updated successfully');
    console.log('💰 Updated payment info:', {
      totalAmount: updated.billing.amount,
      paidAmount: updated.billing.paidAmount,
      remainingAmount: updated.billing.amount - updated.billing.paidAmount,
      status: updated.billing.status,
      paymentStatus: updated.billing.paymentStatus,
      testRequestStatus: updated.status
    });
    
    // ✅ NEW: Log report access status after payment update
    const isPaymentComplete = (updated.billing.amount || 0) - (updated.billing.paidAmount || 0) <= 0;
    const isTestCompleted = ['Testing_Completed', 'Billing_Paid', 'Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'].includes(updated.status);
    console.log('🔓 Report access status after payment update:', {
      testRequestId: updated._id,
      isPaymentComplete,
      isTestCompleted,
      reportAccessible: isTestCompleted || isPaymentComplete,
      billingStatus: updated.billing.status,
      testRequestStatus: updated.status
    });

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      billing: updated.billing,
      testRequestId: updated._id,
      paymentSummary: {
        totalAmount: updated.billing.amount,
        paidAmount: updated.billing.paidAmount,
        remainingAmount: updated.billing.amount - updated.billing.paidAmount,
        status: updated.billing.status,
        paymentStatus: updated.billing.paymentStatus
      }
    });

  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};

// Record payment against patient billing (NEW WORKFLOW)
export const recordPatientPayment = async (req, res) => {
  try {
    console.log('🚀 recordPatientPayment called');
    console.log('📋 Request body:', req.body);
    console.log('👤 User:', req.user?.id || req.user?._id, req.user?.name);
    
    const { patientId, amount, paymentMethod, paymentType, notes } = req.body;

    if (!patientId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and amount are required'
      });
    }

    // Find the patient with billing
    const patient = await Patient.findById(patientId).populate('billing');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    console.log('📋 Patient found:', {
      id: patient._id,
      name: patient.name,
      billingLength: patient.billing?.length,
      billing: patient.billing?.map(b => ({
        type: b.type,
        amount: b.amount,
        paidAmount: b.paidAmount,
        status: b.status
      }))
    });

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    const collectionAmount = numericAmount;

    // Update billing records to mark as paid
    if (patient.billing && patient.billing.length > 0) {
      let remainingAmount = collectionAmount;
      
      for (const bill of patient.billing) {
        if (remainingAmount <= 0) break;
        
        const billAmount = parseFloat(bill.amount) || 0;
        const currentPaid = parseFloat(bill.paidAmount) || 0;
        const remainingBill = billAmount - currentPaid;
        
        console.log('📋 Processing bill:', {
          type: bill.type,
          billAmount,
          currentPaid,
          remainingBill,
          remainingAmount
        });
        
        if (remainingBill > 0) {
          const toPay = Math.min(remainingAmount, remainingBill);
          
          // Update the billing record safely
          bill.paidAmount = (currentPaid + toPay).toString();
          bill.paymentMethod = paymentMethod || 'cash';
          bill.paidBy = req.user?.name || req.user?.userName || 'Unknown';
          bill.paidAt = new Date();
          
          if (bill.paidAmount >= billAmount) {
            bill.status = 'paid';
          } else if (parseFloat(bill.paidAmount) > 0) {
            bill.status = 'partially_paid';
          }
          
          console.log('📋 Bill updated:', {
            type: bill.type,
            paidAmount: bill.paidAmount,
            status: bill.status
          });
          
          remainingAmount -= toPay;
        }
      }
    } else {
      console.log('⚠️ No billing records found for patient');
      // Return success even if no billing - this could be intentional for partial payments
    }

    console.log('💾 Saving patient...');
    await patient.save();
    console.log('✅ Patient saved successfully');

    // LOG PAYMENT TRANSACTION - Use proper payment logging service
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        console.warn('⚠️ No user ID found for payment logging - skipping payment log');
      } else {
        const paymentData = {
          amount: collectionAmount,
          paymentMethod: paymentMethod || 'cash',
          paymentType: paymentType || 'consultation',
          status: 'completed',
          notes: notes || 'Payment recorded from billing UI',
          currency: 'INR'
        };

        const metadata = {
          source: 'web',
          ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
          userAgent: req.headers?.['user-agent'] || 'unknown'
        };

        // Use the proper payment logging service
        await logPatientBillingPayment(patientId, paymentData, userId, metadata);
        console.log('✅ Patient payment logged successfully in payment history');
      }
    } catch (paymentLogError) {
      console.error('❌ Error in payment logging:', paymentLogError);
      // Don't fail the whole operation
    }

    console.log('✅ Patient payment recorded successfully');
    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      patient: patient
    });

  } catch (error) {
    console.error('❌ Error recording patient payment:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
  }
};

// Record partial payments (NEW WORKFLOW)
export const recordPartialPayment = async (req, res) => {
  try {
    console.log('🚀 recordPartialPayment called');
    const { patientId, payments, paymentMethod, notes } = req.body;

    if (!patientId || !payments) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and payments breakdown are required'
      });
    }

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    let totalPaid = 0;
    const { consultation, registration, service } = payments;

    // Update consultation payments
    if (consultation && consultation > 0) {
      const consultationFee = patient.billing?.find(bill => 
        bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')
      );
      if (consultationFee) {
        const currentPaid = consultationFee.paidAmount || 0;
        consultationFee.paidAmount = currentPaid + consultation;
        consultationFee.paymentMethod = paymentMethod || 'cash';
        consultationFee.paidBy = req.user.name;
        consultationFee.paidAt = new Date();
        
        if (consultationFee.paidAmount >= consultationFee.amount) {
          consultationFee.status = 'paid';
        } else if (consultationFee.paidAmount > 0) {
          consultationFee.status = 'partially_paid';
        }
        
        totalPaid += consultation;
      }
    }

    // Update registration payments
    if (registration && registration > 0) {
      const registrationFee = patient.billing?.find(bill => bill.type === 'registration');
      if (registrationFee) {
        const currentPaid = registrationFee.paidAmount || 0;
        registrationFee.paidAmount = currentPaid + registration;
        registrationFee.paymentMethod = paymentMethod || 'cash';
        registrationFee.paidBy = req.user.name;
        registrationFee.paidAt = new Date();
        
        if (registrationFee.paidAmount >= registrationFee.amount) {
          registrationFee.status = 'paid';
        } else if (registrationFee.paidAmount > 0) {
          registrationFee.status = 'partially_paid';
        }
        
        totalPaid += registration;
      }
    }

    // Update service payments
    if (service && service > 0) {
      const serviceBills = patient.billing?.filter(bill => bill.type === 'service') || [];
      let remainingServiceAmount = service;
      
      for (const serviceBill of serviceBills) {
        if (remainingServiceAmount <= 0) break;
        
        const billAmount = serviceBill.amount || 0;
        const currentPaid = serviceBill.paidAmount || 0;
        const remainingBill = billAmount - currentPaid;
        
        if (remainingBill > 0) {
          const toPay = Math.min(remainingServiceAmount, remainingBill);
          serviceBill.paidAmount = currentPaid + toPay;
          serviceBill.paymentMethod = paymentMethod || 'cash';
          serviceBill.paidBy = req.user.name;
          serviceBill.paidAt = new Date();
          
          if (serviceBill.paidAmount >= serviceBill.amount) {
            serviceBill.status = 'paid';
          } else if (serviceBill.paidAmount > 0) {
            serviceBill.status = 'partially_paid';
          }
          
          remainingServiceAmount -= toPay;
        }
      }
      
      totalPaid += service;
    }

    await patient.save();

    // LOG PAYMENT TRANSACTION
    try {
      const paymentData = {
        amount: totalPaid,
        paymentMethod: paymentMethod || 'cash',
        paymentType: 'mixed',
        status: 'completed',
        notes: `Partial payment breakdown: ${JSON.stringify(payments)}. ${notes || ''}`,
        currency: 'INR'
      };

      const metadata = {
        source: 'web',
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers?.['user-agent']
      };

      // Log each individual payment transaction for proper payment history tracking
      await logPatientBillingPayment(patientId, paymentData, req.user._id, metadata);
      console.log('💳 Partial payment logged successfully in payment history');
    } catch (paymentLogError) {
      console.error('❌ Error in payment logging:', paymentLogError);
    }

    console.log('✅ Partial payment recorded successfully');
    res.status(200).json({
      success: true,
      message: 'Partial payment recorded successfully',
      totalPaid: totalPaid,
      patient: patient
    });

  } catch (error) {
    console.error('❌ Error recording partial payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record partial payment',
      error: error.message
    });
  }
};

// NEW WORKFLOW FUNCTIONS

// Create comprehensive invoice (registration + consultation + services)
export const createComprehensiveInvoice = async (req, res) => {
  try {
    console.log('🚀 createComprehensiveInvoice called');
    const { 
      patientId, 
      doctorId, 
      registrationFee, 
      consultationFee, 
      serviceCharges, 
      notes, 
      taxPercentage, 
      discountPercentage,
      isReassignedEntry,
      reassignedEntryId
    } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and Doctor ID are required'
      });
    }

    // Find patient
    const patient = await Patient.findById(patientId).populate('assignedDoctor');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if patient already has billing (only for non-reassigned entries)
    if (!isReassignedEntry && patient.billing && patient.billing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient already has billing records'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // Initialize billing array (only for new invoices, not reassigned entries)
    if (!isReassignedEntry) {
      patient.billing = [];
    }

    // Add registration fee if provided
    if (registrationFee > 0) {
      const registrationBill = {
        type: 'registration',
        description: 'Registration Fee',
        amount: registrationFee,
        paymentMethod: 'pending',
        status: 'pending',
        invoiceNumber: invoiceNumber,
        createdAt: new Date()
      };
      
      // Add reassigned entry fields if applicable
      if (isReassignedEntry) {
        registrationBill.isReassignedEntry = true;
        registrationBill.reassignedEntryId = reassignedEntryId;
        registrationBill.doctorId = doctorId;
      }
      
      patient.billing.push(registrationBill);
    }

    // Add consultation fee
    // Check if this is a followup consultation (free within 7 days)
    const isFollowupEligible = patient.followupEligible && 
                              patient.followupExpiryDate && 
                              new Date() <= patient.followupExpiryDate && 
                              !patient.followupUsed;

    if (isFollowupEligible) {
      // Add free followup consultation
      patient.billing.push({
        type: 'consultation',
        description: 'Followup Consultation (Free within 7 days)',
        amount: 0,
        paidAmount: 0,
        paymentMethod: 'free',
        status: 'paid',
        paidBy: 'System - Followup',
        paidAt: new Date(),
        paymentNotes: 'Free followup consultation within 7 days of paid consultation',
        invoiceNumber: invoiceNumber,
        serviceDetails: 'Free followup consultation',
        consultationType: 'followup',
        isFollowup: true,
        followupParentId: patient.billing.find(b => b.type === 'consultation' && b.amount > 0)?._id,
        createdAt: new Date()
      });
      
      patient.followupUsed = true;
      patient.consultationType = 'followup';
      console.log('🆓 Free followup consultation applied');
    } else if (consultationFee > 0) {
      // Add regular consultation fee
      const consultationBill = {
        type: 'consultation',
        description: 'Doctor Consultation Fee',
        amount: consultationFee,
        paymentMethod: 'pending',
        status: 'pending',
        invoiceNumber: invoiceNumber,
        consultationType: 'OP', // Default to OP, can be changed to IP
        createdAt: new Date()
      };
      
      // Add reassigned entry fields if applicable
      if (isReassignedEntry) {
        consultationBill.isReassignedEntry = true;
        consultationBill.reassignedEntryId = reassignedEntryId;
        consultationBill.doctorId = doctorId;
      }
      
      patient.billing.push(consultationBill);
      
      // Set followup eligibility for future visits
      patient.lastPaidConsultationDate = new Date();
      patient.followupEligible = true;
      patient.followupExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      patient.consultationType = 'OP';
      console.log('💰 Regular consultation fee added, followup eligibility set');
    }

    // Add service charges
    if (serviceCharges && serviceCharges.length > 0) {
      serviceCharges.forEach(service => {
        if (service.name && service.amount) {
          const serviceBill = {
            type: 'service',
            description: service.name,
            amount: parseFloat(service.amount),
            paymentMethod: 'pending',
            status: 'pending',
            invoiceNumber: invoiceNumber,
            serviceDetails: service.description || '',
            createdAt: new Date()
          };
          
          // Add reassigned entry fields if applicable
          if (isReassignedEntry) {
            serviceBill.isReassignedEntry = true;
            serviceBill.reassignedEntryId = reassignedEntryId;
            serviceBill.doctorId = doctorId;
          }
          
          patient.billing.push(serviceBill);
        }
      });
    }

    // Calculate totals
    const subtotal = registrationFee + consultationFee + 
      serviceCharges.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const taxAmount = subtotal * (taxPercentage / 100);
    const discountAmount = subtotal * (discountPercentage / 100);
    const total = subtotal + taxAmount - discountAmount;

    // Save patient
    await patient.save();

    // Create invoice data for response
    const invoice = {
      invoiceNumber,
      patient: {
        _id: patient._id,
        name: patient.name,
        uhId: patient.uhId,
        phone: patient.phone,
        email: patient.email
      },
      doctor: patient.assignedDoctor?.name || 'Not Assigned',
      generatedBy: req.user.name || 'Receptionist',
      generatedAt: new Date(),
      billingRecords: patient.billing,
      totals: {
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total
      },
      notes: notes || '',
      center: {
        name: req.user.center?.name || 'Medical Center'
      }
    };

    console.log('✅ Comprehensive invoice created successfully');
    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice
    });

  } catch (error) {
    console.error('❌ Error creating comprehensive invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
};

// Process payment for existing invoice
export const processPayment = async (req, res) => {
  try {
    console.log('🚀 processPayment called');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📥 Request user:', req.user);
    const { 
      patientId, 
      invoiceId, 
      amount, 
      paymentMethod, 
      paymentType, 
      notes,
      appointmentTime
    } = req.body;

    if (!patientId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, amount, and payment method are required'
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

    if (!patient.billing || patient.billing.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No billing records found for this patient'
      });
    }

    const paymentAmount = parseFloat(amount);
    let remainingAmount = paymentAmount;

    // Process payment against billing items
    for (let bill of patient.billing) {
      if (remainingAmount <= 0) break;
      
      const billAmount = bill.amount || 0;
      const billPaid = bill.paidAmount || 0;
      const billRemaining = billAmount - billPaid;

      if (billRemaining > 0) {
        const paymentForThisBill = Math.min(remainingAmount, billRemaining);
        
        // Update payment
        bill.paidAmount = (billPaid + paymentForThisBill);
        bill.paymentMethod = paymentMethod;
        bill.paidBy = req.user.name || 'Receptionist';
        bill.paidAt = new Date();
        bill.paymentNotes = notes || '';
        
        // Update status
        if (bill.paidAmount >= billAmount) {
          bill.status = 'paid';
        } else {
          bill.status = 'partial';
        }

        remainingAmount -= paymentForThisBill;
      }
    }

    // Update appointment time if provided
    if (appointmentTime) {
      patient.appointmentTime = new Date(appointmentTime);
      patient.appointmentStatus = 'scheduled';
      console.log('📅 Appointment scheduled for:', patient.appointmentTime);
    }

    // Check if this is a followup consultation (free within 7 days)
    const isFollowupEligible = patient.followupEligible && 
                              patient.followupExpiryDate && 
                              new Date() <= patient.followupExpiryDate && 
                              !patient.followupUsed;

    if (isFollowupEligible) {
      // Mark as followup consultation with 0 amount
      const followupBill = {
        type: 'consultation',
        description: 'Followup Consultation (Free within 7 days)',
        amount: 0,
        paidAmount: 0,
        paymentMethod: 'free',
        status: 'paid',
        paidBy: 'System - Followup',
        paidAt: new Date(),
        paymentNotes: 'Free followup consultation within 7 days of paid consultation',
        invoiceNumber: `INV-${Date.now()}-${patient._id.toString().slice(-6)}`,
        consultationType: 'followup',
        isFollowup: true,
        followupParentId: patient.billing.find(b => b.type === 'consultation' && b.amount > 0)?._id
      };
      
      patient.billing.push(followupBill);
      patient.followupUsed = true;
      patient.consultationType = 'followup';
      console.log('🆓 Free followup consultation applied');
    } else {
      // Regular consultation billing
      patient.consultationType = 'OP'; // Default to OP, can be changed to IP if needed
    }

    // Save patient
    await patient.save();

    // Log payment transaction for patient billing
    try {
      console.log('💳 Logging patient billing payment transaction');
      
      // Prepare payment data for logging
      const paymentData = {
        amount: paymentAmount,
        paymentMethod,
        paymentType: paymentType || 'consultation',
        notes: notes || `Payment processed for patient: ${patient.name}`,
        invoiceNumber: patient.billing[0]?.invoiceNumber || `INV-${patient._id.toString().slice(-6)}`,
        consultationType: req.body.consultationType || 'OP',
        appointmentTime: appointmentTime,
        status: 'completed'
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
      
      console.log('✅ Patient billing payment logged successfully');
    } catch (paymentLogError) {
      console.error('❌ Error logging patient billing payment:', paymentLogError);
      // Continue execution - payment logging failure should not stop the transaction
    }

    // Create transaction record - determine type based on billing content
    try {
      // Check if this is a test request payment (receipt transaction)
      const testRequest = await TestRequest.findOne({ patientId: patientId }).sort({ createdAt: -1 });
      
      if (testRequest) {
        // This is a receipt transaction (test request payment)
        const receiptTransactionData = {
          testRequestId: testRequest._id,
          patientId: patientId,
          centerId: testRequest.centerId,
          amount: paymentAmount,
          paymentMethod: paymentMethod,
          paymentType: paymentAmount >= (patient.billing[0]?.amount || 0) ? 'full' : 'partial',
          receiptNumber: `REC-${Date.now()}-${patient._id.toString().slice(-6)}`,
          invoiceNumber: patient.billing[0]?.invoiceNumber || `INV-${Date.now()}-${patient._id.toString().slice(-6)}`,
          paymentBreakdown: {
            items: patient.billing.map(bill => ({
              name: bill.description || bill.type,
              amount: bill.amount || 0,
              quantity: 1
            })),
            subtotal: paymentAmount,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: paymentAmount
          },
          notes: notes || 'Payment processed through billing system'
        };

        await TransactionService.createReceiptTransaction(receiptTransactionData, req.user);
        console.log('✅ Receipt transaction created successfully');
      } else {
        // This is likely a consultation billing transaction
        const consultationTransactionData = {
          patientId: patientId,
          doctorId: patient.assignedDoctor?._id || patient.assignedDoctor,
          centerId: patient.centerId,
          consultationType: 'OP', // Default consultation type
          amount: paymentAmount,
          paymentMethod: paymentMethod,
          paymentType: paymentAmount >= (patient.billing[0]?.amount || 0) ? 'full' : 'partial',
          invoiceNumber: patient.billing[0]?.invoiceNumber || `INV-${Date.now()}-${patient._id.toString().slice(-6)}`,
          paymentBreakdown: {
            registrationFee: 0,
            consultationFee: paymentAmount,
            serviceCharges: [],
            subtotal: paymentAmount,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: paymentAmount
          },
          notes: notes || 'Consultation payment processed through billing system'
        };

        await TransactionService.createConsultationTransaction(consultationTransactionData, req.user);
        console.log('✅ Consultation transaction created successfully');
      }
    } catch (transactionError) {
      console.error('❌ Error creating transaction:', transactionError);
      console.error('❌ Transaction error details:', transactionError.message);
      console.error('❌ Transaction error stack:', transactionError.stack);
      // Continue execution - transaction creation failure should not stop the payment
    }

    console.log('✅ Payment processed successfully');
    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      patient
    });

  } catch (error) {
    console.error('❌ Error processing payment:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Patient data:', patient ? {
      id: patient._id,
      name: patient.name,
      hasBilling: patient.billing ? patient.billing.length : 'unknown',
      billingStructure: patient.billing ? patient.billing[0] : 'no billing'
    } : 'No patient');
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
};

// Cancel bill with reason tracking
export const cancelBillWithReason = async (req, res) => {
  try {
    console.log('🚀 cancelBillWithReason called with penalty policy');
    const { 
      patientId, 
      reason, 
      initiateRefund,
      patientBehavior,
      refundType,
      penaltyAmount,
      refundAmount
    } = req.body;

    if (!patientId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and cancellation reason are required'
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

    if (!patient.billing || patient.billing.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No billing records found for this patient'
      });
    }

    // Get the latest bill for detailed processing
    const latestBill = patient.billing[patient.billing.length - 1];
    const totalPaid = latestBill.customData?.totals?.paid || latestBill.paidAmount || 0;
    const totalAmount = latestBill.customData?.totals?.total || latestBill.amount || 0;

    console.log('💰 Bill details:', {
      totalAmount,
      totalPaid,
      refundType,
      penaltyAmount,
      refundAmount,
      patientBehavior
    });

    // Cancel all billing items
    patient.billing.forEach(bill => {
      bill.status = 'cancelled';
      bill.cancelledAt = new Date();
      bill.cancelledBy = req.user.id || req.user._id;
      bill.cancellationReason = reason;
      
      // Add penalty information to the latest bill
      if (bill === latestBill) {
        bill.penaltyInfo = {
          penaltyAmount: penaltyAmount || 0,
          refundType: refundType || 'partial',
          patientBehavior: patientBehavior || 'okay',
          refundAmount: refundAmount || 0,
          appliedAt: new Date(),
          appliedBy: req.user.id || req.user._id
        };
      }
    });

    // Save patient
    await patient.save();

    // Log cancellation with penalty details
    try {
      const cancellationData = {
        patientId,
        reason,
        cancelledBy: req.user.id || req.user._id,
        totalPaid,
        totalAmount,
        initiateRefund,
        penaltyInfo: {
          penaltyAmount: penaltyAmount || 0,
          refundType: refundType || 'partial',
          patientBehavior: patientBehavior || 'okay',
          refundAmount: refundAmount || 0
        }
      };

      console.log('💳 Logging patient billing cancellation with penalty policy');
      
      // Prepare metadata
      const metadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        source: 'web',
        penaltyPolicy: true,
        patientBehavior: patientBehavior || 'okay'
      };

      // Log the cancellation transaction
      await logPatientBillingCancellation(
        patientId,
        reason,
        req.user.id || req.user._id,
        metadata
      );
      
      console.log('✅ Patient billing cancellation with penalty logged successfully');
    } catch (logError) {
      console.error('❌ Error logging cancellation:', logError);
    }

    // Prepare response message based on penalty policy
    let responseMessage = 'Bill cancelled successfully';
    if (totalPaid > 0) {
      if (refundType === 'full') {
        responseMessage = 'Bill cancelled and full refund processed';
      } else {
        responseMessage = `Bill cancelled and partial refund processed (₹${penaltyAmount || 0} penalty applied)`;
      }
    }

    console.log('✅ Bill cancelled with penalty policy');
    res.status(200).json({
      success: true,
      message: responseMessage,
      refundInitiated: initiateRefund && totalPaid > 0,
      totalPaid,
      totalAmount,
      penaltyAmount: penaltyAmount || 0,
      refundAmount: refundAmount || 0,
      refundType: refundType || 'partial',
      patientBehavior: patientBehavior || 'okay',
      patient
    });

  } catch (error) {
    console.error('❌ Error cancelling bill with penalty policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel bill',
      error: error.message
    });
  }
};

// Process refund with tracking
export const processRefund = async (req, res) => {
  try {
    console.log('🚀 processRefund called');
    console.log('📝 Request body:', req.body);
    const { 
      patientId, 
      amount, 
      refundMethod, 
      reason, 
      notes,
      refundType = 'full', // 'full' or 'partial'
      patientBehavior = 'okay' // 'okay' or 'rude' - determines penalty policy
    } = req.body;

    console.log('🔍 Parsed parameters:', { patientId, amount, refundMethod, reason, notes, refundType, patientBehavior });

    if (!patientId || !amount || !refundMethod || !reason) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Patient ID, amount, refund method, and reason are required'
      });
    }

    // Find patient
    console.log('🔍 Looking for patient with ID:', patientId);
    const patient = await Patient.findById(patientId);
    if (!patient) {
      console.log('❌ Patient not found');
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    console.log('✅ Patient found:', patient.name);
    console.log('📊 Patient billing records:', patient.billing?.length || 0);

    if (!patient.billing || patient.billing.length === 0) {
      console.log('❌ No billing records found');
      return res.status(400).json({
        success: false,
        message: 'No billing records found for this patient'
      });
    }

    const refundAmount = parseFloat(amount);
    console.log('💰 Refund amount:', refundAmount);
    
    // Calculate total paid amount
    const totalPaidAmount = patient.billing.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);
    console.log('💳 Total paid amount:', totalPaidAmount);
    
    // Validate refund amount
    if (refundAmount <= 0) {
      console.log('❌ Invalid refund amount:', refundAmount);
      return res.status(400).json({
        success: false,
        message: 'Refund amount must be greater than 0'
      });
    }
    
    if (refundAmount > totalPaidAmount) {
      console.log('❌ Refund amount exceeds total paid amount');
      return res.status(400).json({
        success: false,
        message: `Refund amount (₹${refundAmount}) cannot exceed total paid amount (₹${totalPaidAmount})`
      });
    }

    // Calculate total already refunded amount
    const totalRefundedAmount = patient.billing.reduce((sum, bill) => sum + (bill.refundAmount || 0), 0);
    const availableForRefund = totalPaidAmount - totalRefundedAmount;
    console.log('🔄 Total refunded amount:', totalRefundedAmount);
    console.log('✅ Available for refund:', availableForRefund);
    
    if (refundAmount > availableForRefund) {
      console.log('❌ Refund amount exceeds available refund amount');
      return res.status(400).json({
        success: false,
        message: `Refund amount (₹${refundAmount}) cannot exceed available refund amount (₹${availableForRefund})`
      });
    }

    let remainingRefundAmount = refundAmount;
    const refundedBills = [];

    console.log('🔄 Starting refund processing with penalty policy...');
    console.log('📋 Total bills to process:', patient.billing.length);
    console.log('🏥 Penalty Policy:', { patientBehavior, refundType });

    // Process refunds for each bill with penalty policy
    // Registration fee penalty policy: Only refund registration fee if patient is rude AND requesting full refund
    const sortedBills = patient.billing.sort((a, b) => {
      // Sort by: cancelled bills first, then by paid amount (descending)
      if (a.status === 'cancelled' && b.status !== 'cancelled') return -1;
      if (b.status === 'cancelled' && a.status !== 'cancelled') return 1;
      return (b.paidAmount || 0) - (a.paidAmount || 0);
    });

    console.log('📊 Sorted bills:', sortedBills.map(b => ({ 
      type: b.type, 
      amount: b.amount, 
      paidAmount: b.paidAmount, 
      refundAmount: b.refundAmount, 
      status: b.status 
    })));

    for (const bill of sortedBills) {
      if (remainingRefundAmount <= 0) break;
      
      const billPaidAmount = bill.paidAmount || 0;
      const billRefundedAmount = bill.refundAmount || 0;
      const billAvailableForRefund = billPaidAmount - billRefundedAmount;
      
      console.log(`🔍 Processing bill: ${bill.type}, Paid: ${billPaidAmount}, Refunded: ${billRefundedAmount}, Available: ${billAvailableForRefund}`);
      
      if (billAvailableForRefund <= 0) continue;
      
      // PENALTY POLICY: Registration fee should only be refunded if patient is rude AND requesting full refund
      if (bill.type === 'registration') {
        const shouldRefundRegistrationFee = patientBehavior === 'rude' && refundType === 'full';
        
        if (!shouldRefundRegistrationFee) {
          console.log(`🚫 Skipping registration fee refund - Penalty Policy: Patient behavior=${patientBehavior}, Refund type=${refundType}`);
          console.log(`💰 Registration fee (₹${billPaidAmount}) held as penalty`);
          continue;
        } else {
          console.log(`✅ Registration fee refund allowed - Patient is rude and requesting full refund`);
        }
      }
      
      const refundForThisBill = Math.min(remainingRefundAmount, billAvailableForRefund);
      console.log(`💰 Refunding ${refundForThisBill} for bill ${bill.type}`);
      
      // Update bill with refund information
      bill.refundAmount = (bill.refundAmount || 0) + refundForThisBill;
      bill.refundedAt = new Date();
      bill.refundedBy = req.user.id || req.user._id;
      bill.refundMethod = refundMethod;
      bill.refundReason = reason;
      bill.refundNotes = notes || '';
      
      // Update bill status based on refund type and amount
      if (refundType === 'full' && refundForThisBill >= billPaidAmount) {
        bill.status = 'refunded';
        console.log(`✅ Bill ${bill.type} marked as fully refunded`);
      } else if (refundType === 'partial' || refundForThisBill < billPaidAmount) {
        bill.status = 'partially_refunded';
        console.log(`🔄 Bill ${bill.type} marked as partially refunded`);
      }
      
      refundedBills.push({
        billId: bill._id,
        description: bill.description || bill.type,
        refundAmount: refundForThisBill,
        totalPaid: billPaidAmount,
        totalRefunded: bill.refundAmount
      });
      
      remainingRefundAmount -= refundForThisBill;
      console.log(`📉 Remaining refund amount: ${remainingRefundAmount}`);
    }

    // Save patient
    console.log('💾 Saving patient with updated billing...');
    await patient.save();
    console.log('✅ Patient saved successfully');

    // Log refund transaction
    try {
      console.log('💳 Logging patient billing refund transaction');
      
      // Prepare metadata
      const metadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        source: 'web',
        externalRefundId: `REF-${Date.now()}-${patientId.toString().slice(-6)}`,
        refundType,
        refundedBills: refundedBills.length
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
      
      console.log('✅ Patient billing refund logged successfully');
    } catch (logError) {
      console.error('❌ Error logging patient billing refund:', logError);
      // Continue execution - payment logging failure should not stop the transaction
    }

    // Update transaction records with refund information
    try {
      console.log('💳 Updating transaction records with refund information');
      
      // Find the most recent consultation transaction for this patient
      const ConsultationTransaction = (await import('../models/ConsultationTransaction.js')).default;
      const transaction = await ConsultationTransaction.findOne({ 
        patientId: patientId 
      }).sort({ createdAt: -1 });
      
      if (transaction) {
        console.log('🔍 User data for refund:', {
          userId: req.user?.id || req.user?._id,
          userObject: req.user
        });
        
        console.log('🔍 Refund data being passed:', {
          amount: refundAmount,
          refundMethod: refundMethod,
          refundReason: reason,
          refundType: refundType
        });
        
        // Map refund method to valid enum values
        const refundMethodMapping = {
          'cash': 'cash',
          'card': 'card',
          'upi': 'upi',
          'net_banking': 'other',
          'bank_transfer': 'bank_transfer',
          'other': 'other'
        };
        
        const mappedRefundMethod = refundMethodMapping[refundMethod] || 'other';
        
        const refundData = {
          amount: refundAmount,
          refundMethod: mappedRefundMethod,
          refundReason: reason,
          refundedAt: new Date(),
          refundType: refundType,
          refundedBy: req.user?.id || req.user?._id || 'system',
          externalRefundId: `REF-${Date.now()}-${patientId.toString().slice(-6)}`
        };
        
        await transaction.addRefund(refundData);
        console.log('✅ Transaction record updated with refund information');
      } else {
        console.log('⚠️ No consultation transaction found to update with refund');
      }
    } catch (transactionError) {
      console.error('❌ Error updating transaction record with refund:', transactionError);
      // Continue execution - transaction update failure should not stop the refund
    }

    console.log('✅ Refund processed successfully');
    res.status(200).json({
      success: true,
      message: `${refundType === 'full' ? 'Full' : 'Partial'} refund processed successfully`,
      refundAmount,
      refundType,
      refundedBills,
      totalPaidAmount,
      totalRefundedAmount: patient.billing.reduce((sum, bill) => sum + (bill.refundAmount || 0), 0),
      patient
    });

  } catch (error) {
    console.error('❌ Error processing refund:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Process refund for test request
export const processTestRequestRefund = async (req, res) => {
  console.log('🔥 FUNCTION CALLED - processTestRequestRefund');
  try {
    console.log('🚀 processTestRequestRefund called for test request:', req.params.id);
    console.log('📋 Request body:', req.body);
    console.log('📋 Request params:', req.params);
    
    const { id } = req.params;
    const { amount, refundMethod, reason, notes } = req.body;

    // Simple validation first
    if (!amount || !refundMethod || !reason) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Amount, refund method, and reason are required'
      });
    }

    console.log('✅ Basic validation passed');

    // Find test request
    console.log('🔍 Finding test request with ID:', id);
    const testRequest = await TestRequest.findById(id).select('patientName centerId centerName centerCode _id status billing');
    
    if (!testRequest) {
      console.log('❌ Test request not found');
      return res.status(404).json({ message: 'Test request not found' });
    }

    console.log('✅ Test request found:', {
      id: testRequest._id,
      patientName: testRequest.patientName,
      billingStatus: testRequest.billing?.status
    });

    // Check if billing exists and is cancelled
    if (!testRequest.billing || testRequest.billing.status !== 'cancelled') {
      console.log('❌ Bill not cancelled:', testRequest.billing?.status);
      return res.status(400).json({ 
        message: 'Cannot process refund. Bill must be cancelled first.',
        currentBillingStatus: testRequest.billing?.status || 'not_generated'
      });
    }

    console.log('✅ Bill is cancelled, proceeding with refund');

    const refundAmount = parseFloat(amount);
    const paidAmount = testRequest.billing.paidAmount || 0;

    console.log('💰 Refund details:', { refundAmount, paidAmount });

    // Validate refund amount
    if (refundAmount <= 0 || refundAmount > paidAmount) {
      console.log('❌ Invalid refund amount');
      return res.status(400).json({
        success: false,
        message: `Refund amount must be between 0 and ${paidAmount}`
      });
    }

    console.log('✅ Refund amount validation passed');

    // Update billing status to refunded
    testRequest.billing.status = 'refunded';
    testRequest.billing.refundedAt = new Date();
    testRequest.billing.refundedBy = req.user?.id || req.user?._id || 'system';
    testRequest.billing.refundMethod = refundMethod;
    testRequest.billing.refundReason = reason;
    testRequest.billing.refundNotes = notes || '';
    testRequest.billing.refundAmount = refundAmount;

    console.log('✅ Billing data updated');

    // Save to database
    console.log('💾 Saving test request to database');
    const updated = await testRequest.save();
    console.log('✅ Test request saved successfully');

    // Log refund transaction
    try {
      console.log('💳 Logging test request refund transaction');
      
      const metadata = {
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers?.['user-agent'] || 'unknown',
        source: 'web',
        externalRefundId: `REF-${Date.now()}-${testRequest._id.toString().slice(-6)}`
      };

      await logPatientBillingRefund(
        testRequest._id,
        refundAmount,
        refundMethod,
        reason,
        req.user?.id || req.user?._id || 'system',
        metadata
      );
      
      console.log('✅ Test request refund logged successfully');
    } catch (paymentLogError) {
      console.error('❌ Error logging refund transaction:', paymentLogError);
      // Continue execution - payment logging failure should not stop the transaction
    }

    // Update transaction records with refund information
    try {
      console.log('💳 Updating transaction records with refund information');
      
      // Find the most recent receipt transaction for this test request
      const ReceiptTransaction = (await import('../models/ReceiptTransaction.js')).default;
      const transaction = await ReceiptTransaction.findOne({ 
        testRequestId: testRequest._id 
      }).sort({ createdAt: -1 });
      
      if (transaction) {
        const refundData = {
          amount: refundAmount,
          refundMethod: refundMethod,
          refundReason: reason,
          refundedAt: new Date(),
          refundType: 'full', // Test request refunds are typically full refunds
          refundedBy: req.user?.id || req.user?._id || 'system',
          externalRefundId: `REF-${Date.now()}-${testRequest._id.toString().slice(-6)}`
        };
        
        await transaction.addRefund(refundData);
        console.log('✅ Transaction record updated with refund information');
      } else {
        console.log('⚠️ No receipt transaction found to update with refund');
      }
    } catch (transactionError) {
      console.error('❌ Error updating transaction record with refund:', transactionError);
      // Continue execution - transaction update failure should not stop the refund
    }

    console.log('✅ Refund processed successfully');

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refundAmount: refundAmount,
      testRequest: {
        _id: updated._id,
        status: updated.status,
        billing: {
          status: updated.billing.status,
          refundedAt: updated.billing.refundedAt,
          refundAmount: updated.billing.refundAmount,
          refundMethod: updated.billing.refundMethod,
          refundReason: updated.billing.refundReason
        }
      }
    });

  } catch (error) {
    console.error('❌ Error processing refund:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


