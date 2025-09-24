import TestRequest from '../models/TestRequest.js';
import Patient from '../models/Patient.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Generate bill for a test request (Receptionist action)
export const generateBillForTestRequest = async (req, res) => {
  try {
    console.log('🚀 generateBillForTestRequest called for test request:', req.params.id);
    console.log('📋 Request body:', req.body);
    console.log('📋 Request params:', req.params);
    console.log('👤 User context:', {
      userId: req.user?._id || req.user?.id,
      userRole: req.user?.role,
      userType: req.user?.userType,
      centerId: req.user?.centerId,
      userObject: req.user,
      hasRole: !!req.user?.role,
      hasUserType: !!req.user?.userType,
      roleValue: req.user?.role,
      userTypeValue: req.user?.userType
    });
    
    // Early return for debugging - remove this after testing
    if (req.user?.role === 'receptionist') {
      console.log('✅ Receptionist detected, proceeding with bill generation');
    } else {
      console.log('❌ User is not a receptionist:', req.user?.role);
      return res.status(403).json({ 
        message: 'Access denied. Only receptionists can generate bills.',
        userRole: req.user?.role
      });
    }
    
    // Additional debugging for middleware bypass
    console.log('🔍 MIDDLEWARE DEBUG - User passed through ensureCenterIsolation:', {
      hasUser: !!req.user,
      userRole: req.user?.role,
      userType: req.user?.userType,
      hasCenterId: !!req.user?.centerId,
      centerId: req.user?.centerId,
      userId: req.user?._id,
      username: req.user?.username,
      note: 'If you see this, the middleware allowed the request through'
    });
    
    const { id } = req.params;
    const { items = [], taxes = 0, discounts = 0, currency = 'INR', notes } = req.body;

    // Validate ObjectId format
    console.log('🔍 Validating ObjectId format:', {
      id,
      isValidFormat: id.match(/^[0-9a-fA-F]{24}$/),
      length: id?.length,
      type: typeof id
    });
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ ObjectId validation failed:', {
        id,
        isValidFormat: id.match(/^[0-9a-fA-F]{24}$/),
        length: id?.length,
        type: typeof id
      });
      
      return res.status(400).json({ 
        message: 'Invalid test request ID format',
        receivedId: id,
        validationError: 'invalid_objectid_format',
        expectedFormat: '24 character hexadecimal string'
      });
    }

    console.log('📋 Request details:', {
      testRequestId: id,
      itemsCount: items.length,
      taxes,
      discounts,
      currency,
      hasNotes: !!notes,
      items: items,
      notes: notes
    });

    // Find the test request in database
    console.log('🔍 Searching for test request with ID:', id);
    console.log('🔍 MongoDB ObjectId format check:', {
      id,
      isValidFormat: id.match(/^[0-9a-fA-F]{24}$/),
      length: id.length
    });
    
    console.log('🔍 Executing database query...');
    console.log('🔍 Database connection status:', {
      mongooseConnectionState: mongoose.connection.readyState,
      readyStateValues: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      }
    });
    
    const testRequest = await TestRequest.findById(id)
      .select('patientName centerId centerName centerCode _id status billing doctorId isActive workflowStage patientId')
      .populate('patientId', 'name phone address age gender');
    console.log('🔍 Database query completed');
    console.log('🔍 Test request patient data:', {
      testRequestId: id,
      patientName: testRequest.patientName,
      patientId: testRequest.patientId,
      patientIdName: testRequest.patientId?.name,
      finalPatientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'
    });
    
    if (!testRequest) {
      console.log('❌ Test request not found with ID:', id);
      
      // Try to find any test request to see if the issue is with the ID format
      console.log('🔍 Searching for sample test requests...');
      try {
        const allTestRequests = await TestRequest.find().limit(5).select('_id status');
        console.log('🔍 Sample test requests in database:', allTestRequests);
        
        // Also try to find by the exact ID to see if there's a format issue
        const exactMatch = await TestRequest.findOne({ _id: id });
        console.log('🔍 Exact ID match result:', exactMatch);
        
        // Try to find by string ID
        const stringMatch = await TestRequest.findOne({ _id: id.toString() });
        console.log('🔍 String ID match result:', stringMatch);
        
      } catch (dbError) {
        console.error('❌ Database query error:', dbError);
      }
      
      return res.status(404).json({ 
        message: 'Test request not found',
        searchedId: id,
        suggestion: 'Please check if the test request ID is correct and exists in the database'
      });
    }

    // Log the complete test request for debugging
    console.log('📋 Complete test request data:', JSON.stringify(testRequest, null, 2));
    console.log('📋 Test request ID type check:', {
      originalId: id,
      originalIdType: typeof id,
      testRequestId: testRequest._id,
      testRequestIdType: typeof testRequest._id,
      idMatch: id === testRequest._id.toString(),
      idStrictMatch: id === testRequest._id
    });

    // Validate test request structure
    console.log('🔍 Validating test request structure...');
    if (!testRequest._id || !testRequest.status) {
      console.log('❌ Test request has invalid structure:', {
        testRequestId: id,
        hasId: !!testRequest._id,
        hasStatus: !!testRequest.status,
        testRequest: testRequest
      });
      
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
    console.log('✅ Test request structure validation passed');

    // Check if test request is active
    console.log('🔍 Checking test request active status...');
    if (testRequest.isActive === false) {
      console.log('❌ Test request is inactive:', {
        testRequestId: id,
        isActive: testRequest.isActive
      });
      
      return res.status(400).json({ 
        message: 'Cannot generate bill for inactive test request',
        testRequestStatus: 'inactive'
      });
    }
    console.log('✅ Test request is active');

    console.log('📋 Test request found:', {
      testRequestId: id,
      currentStatus: testRequest.status,
      currentBillingStatus: testRequest.billing?.status || 'not_generated',
      hasBilling: !!testRequest.billing,
      patientName: testRequest.patientName,
      centerId: testRequest.centerId,
      centerName: testRequest.centerName,
      centerCode: testRequest.centerCode
    });

    // Validate test request has required fields
    console.log('🔍 Validating required fields...');
    if (!testRequest.patientName || !testRequest.centerId) {
      console.log('❌ Test request missing required fields:', {
        testRequestId: id,
        hasPatientName: !!testRequest.patientName,
        hasCenterId: !!testRequest.centerId,
        patientName: testRequest.patientName,
        centerId: testRequest.centerId
      });
      
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
    console.log('✅ Required fields validation passed');

    // Validate center access (if user has a centerId)
    console.log('🔍 Validating center access...');
    console.log('🔍 Center access check:', {
      testRequestId: id,
      userCenterId: req.user.centerId,
      testRequestCenterId: testRequest.centerId,
      userRole: req.user.role,
      userType: req.user.userType,
      centerMatch: req.user.centerId && req.user.centerId.toString() === testRequest.centerId.toString()
    });
    
    // For receptionists, allow access regardless of centerId for now
    if (req.user.role === 'receptionist') {
      console.log('✅ Receptionist access granted for billing operations:', {
        userId: req.user._id,
        userRole: req.user.role,
        userCenterId: req.user.centerId,
        testRequestCenterId: testRequest.centerId
      });
    } else {
      // For non-receptionists, require centerId match
      if (req.user.centerId && req.user.centerId.toString() !== testRequest.centerId.toString()) {
        console.log('❌ Center access denied for non-receptionist:', {
          testRequestId: id,
          userCenterId: req.user.centerId,
          testRequestCenterId: testRequest.centerId,
          userRole: req.user.role
        });
        
        return res.status(403).json({ 
          message: 'Access denied. You can only generate bills for test requests in your center.',
          userCenterId: req.user.centerId,
          testRequestCenterId: testRequest.centerId
        });
      }
    }
    
    console.log('✅ Center access validation passed');

    // Check if bill already exists
    console.log('🔍 Checking billing status:', {
      testRequestId: id,
      hasBilling: !!testRequest.billing,
      billingStatus: testRequest.billing?.status || 'not_generated',
      mainStatus: testRequest.status
    });
    
    // Check if test request is in correct status for billing
    console.log('🔍 Checking test request status...');
    if (testRequest.status !== 'Billing_Pending') {
      console.log('❌ Bill generation failed - incorrect test request status:', {
        testRequestId: id,
        currentStatus: testRequest.status,
        requiredStatus: 'Billing_Pending'
      });
      
      return res.status(400).json({ 
        message: `Cannot generate bill. Test request must be in 'Billing_Pending' status. Current status: ${testRequest.status}`,
        currentStatus: testRequest.status,
        requiredStatus: 'Billing_Pending'
      });
    }
    console.log('✅ Test request status validation passed');

    // Check if test request is in correct workflow stage
    console.log('🔍 Checking workflow stage...');
    if (testRequest.workflowStage && testRequest.workflowStage !== 'billing') {
      console.log('❌ Bill generation failed - incorrect workflow stage:', {
        testRequestId: id,
        currentWorkflowStage: testRequest.workflowStage,
        requiredWorkflowStage: 'billing'
      });
      
      return res.status(400).json({ 
        message: `Cannot generate bill. Test request must be in 'billing' workflow stage. Current stage: ${testRequest.workflowStage}`,
        currentWorkflowStage: testRequest.workflowStage,
        requiredWorkflowStage: 'billing'
      });
    }
    console.log('✅ Workflow stage validation passed');

    // Check if billing already exists and is in correct status
    console.log('🔍 Checking existing billing...');
    if (testRequest.billing) {
      console.log('🔍 Checking existing billing:', {
        testRequestId: id,
        billingStatus: testRequest.billing.status,
        billingExists: true
      });
      
      if (testRequest.billing.status !== 'not_generated') {
        console.log('❌ Bill generation failed - bill already exists:', {
          testRequestId: id,
          currentBillingStatus: testRequest.billing.status,
          currentStatus: testRequest.status,
          billingExists: true
        });
        
        return res.status(400).json({ 
          message: `Cannot generate bill. Current billing status: ${testRequest.billing.status}`,
          currentBillingStatus: testRequest.billing.status,
          currentStatus: testRequest.status
        });
      }
      console.log('✅ Existing billing validation passed');
    } else {
      console.log('✅ No existing billing found - proceeding with bill generation');
    }

    // Validate items array
    console.log('🔍 Validating items array...');
    console.log('🔍 Validating items array:', {
      itemsType: typeof items,
      isArray: Array.isArray(items),
      itemsLength: items?.length,
      items: items
    });
    
    if (!Array.isArray(items) || items.length === 0) {
      console.log('❌ Items validation failed:', {
        itemsType: typeof items,
        isArray: Array.isArray(items),
        itemsLength: items?.length
      });
      
      return res.status(400).json({ 
        message: 'Items array is required and must contain at least one item',
        receivedItems: items,
        validationErrors: {
          isArray: Array.isArray(items),
          hasLength: items?.length > 0
        }
      });
    }
    console.log('✅ Items array validation passed');

    // Validate each item has required fields
    console.log('🔍 Validating individual items...');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`🔍 Validating item ${i + 1}:`, {
        item,
        hasName: !!item.name,
        nameTrimmed: item.name?.trim(),
        unitPrice: item.unitPrice,
        unitPriceType: typeof item.unitPrice,
        unitPriceValid: typeof item.unitPrice === 'number' && item.unitPrice > 0
      });
      
      if (!item.name || !item.name.trim()) {
        console.log(`❌ Item ${i + 1} validation failed - missing name:`, item);
        return res.status(400).json({ 
          message: `Item ${i + 1} must have a name`,
          itemIndex: i,
          item: item,
          validationError: 'missing_name'
        });
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
        console.log(`❌ Item ${i + 1} validation failed - invalid unit price:`, item);
        return res.status(400).json({ 
          message: `Item ${i + 1} must have a valid unit price greater than 0`,
          itemIndex: i,
          item: item,
          validationError: 'invalid_unit_price'
        });
      }
    }
    console.log('✅ All items validation passed');

    // Compute totals
    console.log('💰 Computing bill totals...');
    const itemsWithTotals = items.map((it) => ({
      name: it.name.trim(),
      code: it.code || '',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.quantity || 1) * Number(it.unitPrice || 0)
    }));
    
    console.log('💰 Items with totals:', itemsWithTotals);
    
    const subTotal = itemsWithTotals.reduce((sum, it) => sum + (it.total || 0), 0);
    const totalAmount = Math.max(0, subTotal + Number(taxes || 0) - Number(discounts || 0));
    
    console.log('💰 Bill calculation summary:', {
      subTotal,
      taxes: Number(taxes || 0),
      discounts: Number(discounts || 0),
      totalAmount
    });

    // Generate a simple invoice number
    const prefix = testRequest.centerCode || testRequest.centerId?.code || 'INV';
    const invoiceNumber = `${prefix}-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${String(testRequest._id).slice(-5)}`;

    console.log('💰 Invoice number generation:', {
      prefix,
      centerCode: testRequest.centerCode,
      centerIdCode: testRequest.centerId?.code,
      fallbackPrefix: 'INV',
      finalPrefix: prefix,
      invoiceNumber
    });

    console.log('💰 Bill calculation summary:', {
      testRequestId: id,
      subTotal,
      taxes: Number(taxes || 0),
      discounts: Number(discounts || 0),
      totalAmount,
      invoiceNumber
    });

    // Update test request with billing information
    console.log('💾 Updating test request with billing information...');
    
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
    
    console.log('💾 Billing data to be saved:', billingData);
    
    testRequest.billing = billingData;
    testRequest.status = 'Billing_Generated';
    testRequest.workflowStage = 'billing';
    testRequest.updatedAt = new Date();
    
    console.log('💾 Test request updated with billing data');

    // Save to database
    console.log('💾 Saving test request to database...');
    const updated = await testRequest.save();
    console.log('✅ Bill saved to database successfully');
    console.log('✅ Updated test request:', {
      id: updated._id,
      status: updated.status,
      workflowStage: updated.workflowStage,
      billingStatus: updated.billing?.status,
      billingAmount: updated.billing?.amount
    });

    // Notify stakeholders
    console.log('📧 Setting up notifications...');
    try {
      const recipients = await User.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'centeradmin', centerId: testRequest.centerId },
          { role: 'superadmin', isSuperAdminStaff: true }
        ],
        isDeleted: { $ne: true }
      });

      console.log(`📧 Found ${recipients.length} recipients for notifications:`, {
        doctorId: testRequest.doctorId,
        centerId: testRequest.centerId,
        recipientsCount: recipients.length
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
      console.log('✅ Notifications sent successfully');
    } catch (notifyErr) {
      console.error('❌ Billing generation notification error:', notifyErr);
    }

    console.log('🎉 Bill generated successfully');
    console.log('🎉 Final response data:', {
      message: 'Bill generated successfully',
      testRequestId: updated._id,
      testRequestStatus: updated.status,
      billingStatus: updated.billing?.status,
      billingAmount: updated.billing?.amount
    });

    res.status(200).json({ 
      message: 'Bill generated successfully', 
      testRequest: updated 
    });
  } catch (error) {
    console.error('❌ Error in bill generation:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
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
    console.log('🚀 markBillPaidForTestRequest called for test request:', req.params.id);
    
    const { id } = req.params;
    const { paymentMethod, transactionId, verificationNotes } = req.body;

    // Handle uploaded receipt file
    let receiptFileName = null;
    if (req.file) {
      receiptFileName = req.file.filename;
      console.log('📁 Receipt file uploaded:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }

    console.log('📋 Payment details:', {
      testRequestId: id,
      paymentMethod,
      hasTransactionId: !!transactionId,
      hasReceipt: !!receiptFileName,
      hasNotes: !!verificationNotes
    });

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

    console.log('🔍 Test request patient data (payment):', {
      testRequestId: id,
      patientName: testRequest.patientName,
      patientId: testRequest.patientId,
      patientIdName: testRequest.patientId?.name,
      patientIdType: typeof testRequest.patientId,
      testType: testRequest.testType,
      finalPatientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'
    });

    console.log('📋 Test request found:', {
      testRequestId: id,
      currentStatus: testRequest.status,
      currentBillingStatus: testRequest.billing?.status || 'not_generated',
      hasBilling: !!testRequest.billing
    });

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
    
    console.log('💰 Payment calculation:', {
      paymentAmount,
      currentPaidAmount,
      newPaidAmount,
      totalAmount,
      isFullyPaid: newPaidAmount >= totalAmount
    });
    
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
      // Fully paid - ready for lab processing
      testRequest.billing.status = 'paid';
      testRequest.status = 'Billing_Paid';
      testRequest.workflowStage = 'lab_assignment';
      console.log('✅ Bill fully paid - ready for lab processing');
    } else {
      // Partially paid - also ready for lab processing (allow lab to see and work on it)
      testRequest.billing.status = 'partially_paid';
      testRequest.status = 'Billing_Paid'; // Allow lab to see it
      testRequest.workflowStage = 'lab_assignment'; // Move to lab stage
      console.log('💰 Bill partially paid - ready for lab processing with partial payment');
    }
    
    testRequest.updatedAt = new Date();
    
    console.log('✅ Payment marked as paid - test request ready for lab processing');

    console.log('💰 Updating billing status to paid');

    // Save to database
    const updated = await testRequest.save();
    console.log('✅ Bill marked as paid successfully');

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

      console.log(`📧 Sending ${newPaidAmount >= totalAmount ? 'full payment' : 'partial payment'} notifications to ${recipients.length} recipients`);

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
            status: 'Billing_Paid', // Always Billing_Paid for lab visibility
            patientId: testRequest.patientId,
            patientName: patientName,
            testType: testRequest.testType || 'Unknown Test'
          },
          read: false
        });
        await n.save();
      }
      console.log('✅ Payment notifications sent successfully');
    } catch (notifyErr) {
      console.error('❌ Payment notification error:', notifyErr);
    }

    console.log('🎉 Payment marked successfully - test request ready for lab processing');
    res.status(200).json({ 
      message: 'Payment marked successfully. Test request is now ready for lab processing.', 
      testRequest: updated 
    });
  } catch (error) {
    console.error('❌ Error marking bill as paid:', error);
    res.status(500).json({ message: 'Failed to mark bill as paid', error: error.message });
  }
};

// Get billing information for a test request
export const getBillingInfo = async (req, res) => {
  try {
    console.log('🚀 getBillingInfo called for test request:', req.params.id);
    
    const { id } = req.params;

    const testRequest = await TestRequest.findById(id)
      .select('patientName centerId centerName centerCode _id status billing createdAt')
      .populate('centerId', 'name code');

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    console.log('📋 Billing info retrieved:', {
      testRequestId: id,
      hasBilling: !!testRequest.billing,
      billingStatus: testRequest.billing?.status || 'not_generated'
    });

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
    console.error('❌ Error getting billing info:', error);
    res.status(500).json({ message: 'Failed to get billing information', error: error.message });
  }
};

// Get all billing data for superadmin (across all centers)
export const getAllBillingData = async (req, res) => {
  try {
    console.log('🚀 getAllBillingData called by superadmin');
    
    // Get all test requests with billing information from database - only include items with actual billing status
    const billingRequests = await TestRequest.find({ 
      isActive: true,
      billing: { $exists: true, $ne: null },
      'billing.status': { $exists: true, $ne: null }
    })
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone specializations')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${billingRequests.length} billing requests for superadmin`);

    res.status(200).json({
      success: true,
      billingRequests,
      total: billingRequests.length
    });
  } catch (error) {
    console.error('❌ Error fetching billing data:', error);
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
    console.log('🚀 getBillingDataForCenter called for center:', req.user.centerId);
    
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
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone specializations')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${billingRequests.length} billing requests for center ${centerId}`);

    res.status(200).json({
      success: true,
      billingRequests,
      total: billingRequests.length
    });
  } catch (error) {
    console.error('❌ Error fetching center billing data:', error);
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
    console.log('🚀 cancelBill called for test request:', req.params.id);
    
    const { id } = req.params;
    const { cancellationReason } = req.body;

    console.log('📋 Cancellation details:', {
      testRequestId: id,
      hasReason: !!cancellationReason
    });

    const testRequest = await TestRequest.findById(id).select('patientName centerId centerName centerCode _id status billing');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    console.log('📋 Test request found:', {
      testRequestId: id,
      currentStatus: testRequest.status,
      currentBillingStatus: testRequest.billing?.status || 'not_generated'
    });

    // Check if billing exists
    if (!testRequest.billing || testRequest.billing.status === 'not_generated') {
      return res.status(400).json({ 
        message: 'Cannot cancel bill. No bill generated for this test request.',
        currentBillingStatus: testRequest.billing?.status || 'not_generated'
      });
    }

    // Check if bill is already paid
    if (testRequest.billing.status === 'paid') {
      return res.status(400).json({ 
        message: 'Cannot cancel bill. Bill has already been paid.',
        currentBillingStatus: testRequest.billing.status
      });
    }

    // Update billing status to cancelled
    testRequest.billing.status = 'cancelled';
    testRequest.billing.cancelledAt = new Date();
    testRequest.billing.cancelledBy = req.user.id || req.user._id;
    testRequest.billing.cancellationReason = cancellationReason;

    // Update main status back to pending
    testRequest.status = 'Pending';
    testRequest.updatedAt = new Date();

    console.log('❌ Cancelling bill');

    // Save to database
    const updated = await testRequest.save();
    console.log('✅ Bill cancelled successfully');

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

      console.log(`📧 Sending cancellation notifications to ${recipients.length} recipients`);

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
      console.log('✅ Cancellation notifications sent successfully');
    } catch (notifyErr) {
      console.error('❌ Cancellation notification error:', notifyErr);
    }

    console.log('🎉 Bill cancelled successfully');

    res.status(200).json({ 
      message: 'Bill cancelled successfully', 
      testRequest: updated 
    });
  } catch (error) {
    console.error('❌ Error cancelling bill:', error);
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
          console.log('🔍 Error checking center formats:', error.message);
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
    }
    
    // Debug: Show sample data for different periods
    if (billingData.length > 0) {
      console.log('🔍 Sample billing data:', billingData.slice(0, 3).map(item => ({
        patientName: item.patientName,
        amount: item.billing?.amount,
        status: item.billing?.status,
        generatedAt: item.billing?.generatedAt,
        createdAt: item.createdAt,
        centerName: item.centerName
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
          { createdAt: { $gte: start, $lte: end } }
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
    console.log('👤 User context:', {
      userId: req.user?._id || req.user?.id,
      userRole: req.user?.role,
      userType: req.user?.userType,
      centerId: req.user?.centerId
    });

    const { patientId, amount, paymentMethod, notes } = req.body;

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

    // Check if consultation fee already exists for the current doctor
    // For reassigned patients, we allow multiple consultation fees (one per doctor)
    // Reassigned patients are treated as new patients but without registration fee
    const currentDoctorId = patient.assignedDoctor?._id || patient.assignedDoctor;
    
    console.log('🔍 Patient assigned doctor info:', {
      patientId: patient._id,
      patientName: patient.name,
      assignedDoctor: patient.assignedDoctor,
      assignedDoctorId: patient.assignedDoctor?._id,
      currentDoctorId: currentDoctorId,
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
      description: notes || `Doctor consultation fee for ${patient.name}${patient.billing && patient.billing.length > 0 ? ' (reassigned patient)' : ''}`,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'cash',
      status: 'paid',
      paidBy: req.user.name,
      paidAt: new Date(),
      invoiceNumber: invoiceNumber,
      doctorId: currentDoctorId, // Track which doctor this consultation fee is for
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

    // Add billing record to patient
    if (!patient.billing) {
      patient.billing = [];
    }
    patient.billing.push(consultationFee);

    // Save patient
    await patient.save();

    console.log('✅ Consultation fee billing created successfully');
    console.log('📋 Updated patient billing:', patient.billing);
    console.log('📋 Patient ID:', patient._id);
    console.log('📋 Patient name:', patient.name);
    
    // Verify the billing was actually saved
    const savedPatient = await Patient.findById(patient._id);
    console.log('📋 Verification - Saved patient billing:', savedPatient.billing);

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
    
    const { patientId, amount, paymentMethod, notes } = req.body;

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

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'REG');

    // Create registration fee billing record
    const registrationFee = {
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
    patient.billing.push(registrationFee);

    // Save patient
    await patient.save();

    console.log('✅ Registration fee billing created successfully');

    res.status(201).json({
      success: true,
      message: 'Registration fee payment recorded successfully',
      billing: registrationFee,
      patient: patient
    });

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
    
    const { patientId, services, paymentMethod, notes } = req.body;

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
        doctorId: patient.assignedDoctor?._id || patient.assignedDoctor, // Track which doctor this service is for
        createdAt: new Date()
      };

      serviceBills.push(serviceBill);
      totalAmount += parseFloat(service.amount);
    }

    // Add billing records to patient
    if (!patient.billing) {
      patient.billing = [];
    }
    patient.billing.push(...serviceBills);

    // Save patient
    await patient.save();

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
    
    const { patientId, billingIds } = req.body;

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

    // Get billing records
    let billingRecords = patient.billing || [];
    
    console.log('🔍 Original billing records:', billingRecords.map(bill => ({
      id: bill._id,
      type: bill.type,
      description: bill.description,
      doctorId: bill.doctorId,
      amount: bill.amount
    })));
    
    // Filter by specific billing IDs if provided
    if (billingIds && Array.isArray(billingIds) && billingIds.length > 0) {
      billingRecords = billingRecords.filter(bill => billingIds.includes(bill._id.toString()));
      console.log('🔍 Filtered by specific billing IDs:', billingRecords.length);
    } else {
      // If no specific billing IDs provided, filter by current doctor for consultation fees
      // This ensures reassigned patients only get invoices for their current doctor's consultation
      const currentDoctorId = patient.assignedDoctor?._id || patient.assignedDoctor;
      console.log('🔍 Current doctor ID:', currentDoctorId);
      
    // SMART FILTERING: Ensure complete separation for reassigned patients
    // Only include billing records for the current doctor to prevent merging with old invoices
    console.log('🔍 SMART FILTERING: Ensuring complete separation for reassigned patients');
    
    billingRecords = billingRecords.filter(bill => {
      // For consultation fees, only include those for the current doctor
      if (bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')) {
        const hasDoctorId = bill.doctorId && bill.doctorId.toString();
        const matchesCurrentDoctor = hasDoctorId && currentDoctorId && bill.doctorId.toString() === currentDoctorId.toString();
        const hasNoDoctorId = !hasDoctorId; // Include old records without doctorId for backward compatibility
        
        // For reassigned patients, be strict - only current doctor
        // For regular patients, be flexible - current doctor OR old records
        const shouldInclude = matchesCurrentDoctor || hasNoDoctorId;
        
        console.log('🔍 Consultation fee check (SMART):', {
          billId: bill._id,
          billDoctorId: bill.doctorId,
          currentDoctorId: currentDoctorId,
          hasDoctorId: hasDoctorId,
          matchesCurrentDoctor: matchesCurrentDoctor,
          hasNoDoctorId: hasNoDoctorId,
          shouldInclude: shouldInclude,
          description: bill.description
        });
        
        return shouldInclude;
      }
      
      // For service charges, only include those for the current doctor
      if (bill.type === 'service') {
        const hasDoctorId = bill.doctorId && bill.doctorId.toString();
        const matchesCurrentDoctor = hasDoctorId && currentDoctorId && bill.doctorId.toString() === currentDoctorId.toString();
        const hasNoDoctorId = !hasDoctorId; // Include old records without doctorId
        
        const shouldInclude = matchesCurrentDoctor || hasNoDoctorId;
        
        console.log('🔍 Service charge check (SMART):', {
          billId: bill._id,
          billDoctorId: bill.doctorId,
          currentDoctorId: currentDoctorId,
          hasDoctorId: hasDoctorId,
          matchesCurrentDoctor: matchesCurrentDoctor,
          hasNoDoctorId: hasNoDoctorId,
          shouldInclude: shouldInclude,
          description: bill.description
        });
        
        return shouldInclude;
      }
      
      // For registration fees, include all (they're not doctor-specific)
      if (bill.type === 'registration') {
        console.log('🔍 Registration fee included:', {
          billId: bill._id,
          description: bill.description
        });
        return true;
      }
      
      // For other types, include all
      return true;
    });
      
      console.log('🔍 Filtered billing records:', billingRecords.map(bill => ({
        id: bill._id,
        type: bill.type,
        description: bill.description,
        doctorId: bill.doctorId,
        amount: bill.amount
      })));
    }

    if (billingRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No billing records found for invoice generation'
      });
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

    billingRecords.forEach(bill => {
      totals[bill.type] = (totals[bill.type] || 0) + bill.amount;
      totals.total += bill.amount;
    });

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'INV', 'INV');

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
      patient: {
        name: patient.name,
        uhId: patient.uhId,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        age: patient.age,
        gender: patient.gender
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

    console.log('✅ Payment status updated successfully');
    console.log('💰 Updated payment info:', {
      totalAmount: updated.billing.amount,
      paidAmount: updated.billing.paidAmount,
      remainingAmount: updated.billing.amount - updated.billing.paidAmount,
      status: updated.billing.status,
      paymentStatus: updated.billing.paymentStatus
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

