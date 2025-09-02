import TestRequest from '../models/TestRequest.js';
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

    // Check if bill is already paid
    if (testRequest.billing.status === 'paid') {
      return res.status(400).json({ 
        message: 'Bill is already marked as paid.',
        currentBillingStatus: testRequest.billing.status
      });
    }

    // Check if this is a receptionist marking payment received or center admin verifying
    const isReceptionist = req.user.role === 'receptionist';
    const isCenterAdmin = req.user.role === 'centeradmin';
    
    if (isReceptionist) {
      // Receptionist marks payment as received (needs center admin verification)
      testRequest.billing.status = 'payment_received';
      testRequest.billing.paidAt = new Date();
      testRequest.billing.paidBy = req.user.id || req.user._id;
      testRequest.billing.paymentMethod = paymentMethod;
      testRequest.billing.transactionId = transactionId;
      testRequest.billing.receiptUpload = receiptFileName;
      
      // Update main status to indicate payment received but needs verification
      testRequest.status = 'Billing_Generated'; // Keep as generated until verified
      testRequest.updatedAt = new Date();
      
      console.log('💰 Receptionist marked payment as received - awaiting center admin verification');
    } else if (isCenterAdmin) {
      // Center admin verifies the payment
      testRequest.billing.status = 'paid';
      testRequest.billing.verifiedBy = req.user.id || req.user._id;
      testRequest.billing.verifiedAt = new Date();
      testRequest.billing.verificationNotes = verificationNotes;
      
      // Update main status to paid and verified
      testRequest.status = 'Billing_Paid';
      testRequest.updatedAt = new Date();
      
      console.log('✅ Center admin verified payment - ready for lab processing');
    } else {
      return res.status(403).json({ 
        message: 'Only receptionists can mark payments as received and center admins can verify payments',
        userRole: req.user.role
      });
    }

    console.log('💰 Updating billing status to paid');

    // Save to database
    const updated = await testRequest.save();
    console.log('✅ Bill marked as paid successfully');

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

      console.log(`📧 Sending payment notifications to ${recipients.length} recipients`);

      for (const r of recipients) {
        let notificationTitle, notificationMessage, notificationStatus;
        
        if (isReceptionist) {
          notificationTitle = 'Payment Received - Awaiting Verification';
          notificationMessage = `Payment received for ${patientName} - ${testRequest.testType || 'Unknown Test'}. Amount: ${testRequest.billing.currency} ${testRequest.billing.amount}. Awaiting center admin verification.`;
          notificationStatus = 'payment_received';
        } else if (isCenterAdmin) {
          notificationTitle = 'Payment Verified - Ready for Lab';
          notificationMessage = `Payment verified for ${patientName} - ${testRequest.testType || 'Unknown Test'}. Amount: ${testRequest.billing.currency} ${testRequest.billing.amount}. Ready for lab processing.`;
          notificationStatus = 'Billing_Paid';
        }
        
        // Ensure we have a proper patient name
        const patientName = testRequest.patientName || 
                           (testRequest.patientId && typeof testRequest.patientId === 'object' ? testRequest.patientId.name : null) ||
                           (testRequest.patientId && typeof testRequest.patientId === 'string' ? testRequest.patientId : null) ||
                           'Unknown Patient';
        
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: notificationTitle,
          message: notificationMessage,
          data: { 
            testRequestId: testRequest._id, 
            amount: testRequest.billing.amount, 
            status: notificationStatus,
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

    if (isReceptionist) {
      console.log('🎉 Payment marked as received - awaiting center admin verification');
      res.status(200).json({ 
        message: 'Payment recorded successfully. Awaiting center admin verification.', 
        testRequest: updated 
      });
    } else if (isCenterAdmin) {
      console.log('🎉 Payment verified successfully - ready for lab processing');
      res.status(200).json({ 
        message: 'Payment verified successfully. Test request ready for lab processing.', 
        testRequest: updated 
      });
    }
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
    
    // Get all test requests with billing information from database
    const billingRequests = await TestRequest.find({ 
      isActive: true,
      $or: [
        { billing: { $exists: true, $ne: null } },
        { status: { $in: ['Billing_Pending', 'Billing_Generated', 'Billing_Paid'] } }
      ]
    })
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone')
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

    // Get all test requests with billing information for this center
    const billingRequests = await TestRequest.find({ 
      centerId,
      isActive: true,
      $or: [
        { billing: { $exists: true, $ne: null } },
        { status: { $in: ['Billing_Pending', 'Billing_Generated', 'Billing_Paid'] } }
      ]
    })
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone')
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
