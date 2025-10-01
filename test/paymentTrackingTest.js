/**
 * Test script for enhanced payment tracking system
 * Tests all payment transactions from ConsultationBilling and ReassignPatient pages
 */

import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import PaymentLog from '../models/PaymentLog.js';
import { 
  logPatientBillingPayment,
  logPatientBillingRefund,
  logPatientBillingCancellation
} from '../services/paymentLogService.js';

// Test configuration
const TEST_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/chanre-allergy-test',
  TEST_PATIENT_ID: null, // Will be set during test
  TEST_USER_ID: null, // Will be set during test
  TEST_CENTER_ID: null // Will be set during test
};

/**
 * Initialize test environment
 */
async function initializeTest() {
  try {
    console.log('🔧 Initializing payment tracking test...');
    
    // Connect to MongoDB
    await mongoose.connect(TEST_CONFIG.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find or create test patient
    let testPatient = await Patient.findOne({ name: 'Test Patient Payment Tracking' });
    if (!testPatient) {
      testPatient = new Patient({
        name: 'Test Patient Payment Tracking',
        gender: 'male',
        age: 30,
        phone: '9876543210',
        email: 'test@example.com',
        address: 'Test Address',
        centerId: TEST_CONFIG.TEST_CENTER_ID || new mongoose.Types.ObjectId(),
        assignedDoctor: TEST_CONFIG.TEST_USER_ID || new mongoose.Types.ObjectId(),
        uhId: 'TEST001',
        billing: []
      });
      await testPatient.save();
      console.log('✅ Test patient created:', testPatient._id);
    } else {
      console.log('✅ Test patient found:', testPatient._id);
    }
    
    TEST_CONFIG.TEST_PATIENT_ID = testPatient._id;
    TEST_CONFIG.TEST_USER_ID = testPatient.assignedDoctor;
    TEST_CONFIG.TEST_CENTER_ID = testPatient.centerId;
    
    return testPatient;
  } catch (error) {
    console.error('❌ Error initializing test:', error);
    throw error;
  }
}

/**
 * Test consultation billing payment logging
 */
async function testConsultationBillingPayment() {
  try {
    console.log('\n🧪 Testing consultation billing payment logging...');
    
    const paymentData = {
      amount: 850,
      paymentMethod: 'cash',
      paymentType: 'consultation',
      notes: 'OP Consultation fee payment',
      invoiceNumber: `INV-${Date.now()}-TEST`,
      consultationType: 'OP',
      appointmentTime: new Date(),
      status: 'completed'
    };

    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      source: 'web',
      verified: true,
      verifiedBy: TEST_CONFIG.TEST_USER_ID,
      verifiedAt: new Date()
    };

    const paymentLog = await logPatientBillingPayment(
      TEST_CONFIG.TEST_PATIENT_ID,
      paymentData,
      TEST_CONFIG.TEST_USER_ID,
      metadata
    );

    console.log('✅ Consultation billing payment logged:', {
      transactionId: paymentLog.transactionId,
      amount: paymentLog.amount,
      status: paymentLog.status,
      paymentType: paymentLog.paymentType
    });

    return paymentLog;
  } catch (error) {
    console.error('❌ Error testing consultation billing payment:', error);
    throw error;
  }
}

/**
 * Test reassignment billing payment logging
 */
async function testReassignmentBillingPayment() {
  try {
    console.log('\n🧪 Testing reassignment billing payment logging...');
    
    const paymentData = {
      amount: 850,
      paymentMethod: 'card',
      paymentType: 'reassignment_consultation',
      notes: 'Reassignment consultation payment',
      invoiceNumber: `INV-${Date.now()}-REASSIGN`,
      consultationType: 'OP',
      appointmentTime: new Date(),
      status: 'completed',
      isReassignedEntry: true,
      reassignedEntryId: new mongoose.Types.ObjectId()
    };

    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      source: 'web',
      verified: true,
      verifiedBy: TEST_CONFIG.TEST_USER_ID,
      verifiedAt: new Date()
    };

    const paymentLog = await logPatientBillingPayment(
      TEST_CONFIG.TEST_PATIENT_ID,
      paymentData,
      TEST_CONFIG.TEST_USER_ID,
      metadata
    );

    console.log('✅ Reassignment billing payment logged:', {
      transactionId: paymentLog.transactionId,
      amount: paymentLog.amount,
      status: paymentLog.status,
      paymentType: paymentLog.paymentType,
      isReassignedEntry: paymentLog.metadata.isReassignedEntry
    });

    return paymentLog;
  } catch (error) {
    console.error('❌ Error testing reassignment billing payment:', error);
    throw error;
  }
}

/**
 * Test partial payment logging
 */
async function testPartialPayment() {
  try {
    console.log('\n🧪 Testing partial payment logging...');
    
    const paymentData = {
      amount: 400,
      paymentMethod: 'upi',
      paymentType: 'consultation',
      notes: 'Partial payment for consultation',
      invoiceNumber: `INV-${Date.now()}-PARTIAL`,
      consultationType: 'OP',
      status: 'completed'
    };

    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      source: 'web',
      verified: true,
      verifiedBy: TEST_CONFIG.TEST_USER_ID,
      verifiedAt: new Date()
    };

    const paymentLog = await logPatientBillingPayment(
      TEST_CONFIG.TEST_PATIENT_ID,
      paymentData,
      TEST_CONFIG.TEST_USER_ID,
      metadata
    );

    console.log('✅ Partial payment logged:', {
      transactionId: paymentLog.transactionId,
      amount: paymentLog.amount,
      status: paymentLog.status,
      paymentMethod: paymentLog.paymentMethod
    });

    return paymentLog;
  } catch (error) {
    console.error('❌ Error testing partial payment:', error);
    throw error;
  }
}

/**
 * Test payment refund logging
 */
async function testPaymentRefund() {
  try {
    console.log('\n🧪 Testing payment refund logging...');
    
    const refundAmount = 200;
    const refundMethod = 'cash';
    const refundReason = 'Patient requested refund for overpayment';
    
    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      source: 'web',
      externalRefundId: `REF-${Date.now()}-TEST`
    };

    const paymentLog = await logPatientBillingRefund(
      TEST_CONFIG.TEST_PATIENT_ID,
      refundAmount,
      refundMethod,
      refundReason,
      TEST_CONFIG.TEST_USER_ID,
      metadata
    );

    console.log('✅ Payment refund logged:', {
      transactionId: paymentLog.transactionId,
      refundAmount: paymentLog.refund.refundedAmount,
      refundMethod: paymentLog.refund.refundMethod,
      refundReason: paymentLog.refund.refundReason,
      status: paymentLog.status
    });

    return paymentLog;
  } catch (error) {
    console.error('❌ Error testing payment refund:', error);
    throw error;
  }
}

/**
 * Test payment cancellation logging
 */
async function testPaymentCancellation() {
  try {
    console.log('\n🧪 Testing payment cancellation logging...');
    
    const cancellationReason = 'Patient cancelled appointment';
    
    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      source: 'web'
    };

    const paymentLogs = await logPatientBillingCancellation(
      TEST_CONFIG.TEST_PATIENT_ID,
      cancellationReason,
      TEST_CONFIG.TEST_USER_ID,
      metadata
    );

    console.log('✅ Payment cancellation logged:', {
      cancelledLogs: paymentLogs.length,
      reason: cancellationReason
    });

    return paymentLogs;
  } catch (error) {
    console.error('❌ Error testing payment cancellation:', error);
    throw error;
  }
}

/**
 * Test payment log retrieval and statistics
 */
async function testPaymentLogRetrieval() {
  try {
    console.log('\n🧪 Testing payment log retrieval...');
    
    // Get all payment logs for the test patient
    const paymentLogs = await PaymentLog.find({ 
      patientId: TEST_CONFIG.TEST_PATIENT_ID 
    }).sort({ createdAt: -1 });

    console.log('✅ Payment logs retrieved:', {
      totalLogs: paymentLogs.length,
      logs: paymentLogs.map(log => ({
        transactionId: log.transactionId,
        amount: log.amount,
        status: log.status,
        paymentType: log.paymentType,
        createdAt: log.createdAt
      }))
    });

    // Test payment statistics
    const stats = await PaymentLog.aggregate([
      { $match: { patientId: TEST_CONFIG.TEST_PATIENT_ID } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          refundedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] }
          }
        }
      }
    ]);

    console.log('✅ Payment statistics:', stats[0] || {});

    return paymentLogs;
  } catch (error) {
    console.error('❌ Error testing payment log retrieval:', error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanupTest() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Remove test payment logs
    const deletedLogs = await PaymentLog.deleteMany({ 
      patientId: TEST_CONFIG.TEST_PATIENT_ID 
    });
    console.log('✅ Deleted payment logs:', deletedLogs.deletedCount);
    
    // Remove test patient
    const deletedPatient = await Patient.deleteOne({ 
      _id: TEST_CONFIG.TEST_PATIENT_ID 
    });
    console.log('✅ Deleted test patient:', deletedPatient.deletedCount);
    
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runPaymentTrackingTests() {
  try {
    console.log('🚀 Starting Payment Tracking System Tests\n');
    
    // Initialize test environment
    await initializeTest();
    
    // Run all tests
    await testConsultationBillingPayment();
    await testReassignmentBillingPayment();
    await testPartialPayment();
    await testPaymentRefund();
    await testPaymentCancellation();
    await testPaymentLogRetrieval();
    
    console.log('\n✅ All payment tracking tests completed successfully!');
    
    // Ask user if they want to clean up test data
    console.log('\n📋 Test Summary:');
    console.log('- Consultation billing payment logging: ✅');
    console.log('- Reassignment billing payment logging: ✅');
    console.log('- Partial payment logging: ✅');
    console.log('- Payment refund logging: ✅');
    console.log('- Payment cancellation logging: ✅');
    console.log('- Payment log retrieval: ✅');
    
    console.log('\n💡 Test data has been created. You can:');
    console.log('1. Check the PaymentLog collection in MongoDB');
    console.log('2. Run cleanupTest() to remove test data');
    console.log('3. Use the test data for further testing');
    
  } catch (error) {
    console.error('❌ Payment tracking tests failed:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  }
}

// Export functions for manual testing
export {
  runPaymentTrackingTests,
  initializeTest,
  testConsultationBillingPayment,
  testReassignmentBillingPayment,
  testPartialPayment,
  testPaymentRefund,
  testPaymentCancellation,
  testPaymentLogRetrieval,
  cleanupTest
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPaymentTrackingTests().catch(console.error);
}



