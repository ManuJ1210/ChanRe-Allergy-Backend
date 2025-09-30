import axios from 'axios';

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token
const TEST_CENTER_ID = 'your-center-id-here'; // Replace with actual center ID

// Test data
const testPatientId = 'test-patient-id';
const testDoctorId = 'test-doctor-id';

// Create axios instance with auth headers
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test functions
async function testCreateInvoice() {
  console.log('🧪 Testing Create Invoice...');
  
  try {
    const invoiceData = {
      patientId: testPatientId,
      doctorId: testDoctorId,
      centerId: TEST_CENTER_ID,
      consultationType: 'OP',
      consultationFee: 0, // Free for first reassignment
      serviceCharges: [
        {
          name: 'Injection',
          amount: 100,
          description: 'Test injection'
        }
      ],
      taxPercentage: 0,
      discountPercentage: 0,
      notes: 'Test invoice for reassigned patient',
      isReassignedEntry: true
    };

    const response = await api.post('/billing/create-invoice', invoiceData);
    
    if (response.data.success) {
      console.log('✅ Create Invoice Test Passed');
      console.log('Invoice:', response.data.invoice);
      return response.data.invoice;
    } else {
      console.log('❌ Create Invoice Test Failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Create Invoice Test Error:', error.response?.data?.message || error.message);
  }
}

async function testProcessPayment(invoiceId) {
  console.log('🧪 Testing Process Payment...');
  
  try {
    const paymentData = {
      invoiceId: invoiceId,
      patientId: testPatientId,
      amount: 100,
      paymentMethod: 'cash',
      notes: 'Test payment',
      appointmentTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      centerId: TEST_CENTER_ID
    };

    const response = await api.post('/billing/process-payment', paymentData);
    
    if (response.data.success) {
      console.log('✅ Process Payment Test Passed');
      console.log('Payment:', response.data.payment);
      return response.data.payment;
    } else {
      console.log('❌ Process Payment Test Failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Process Payment Test Error:', error.response?.data?.message || error.message);
  }
}

async function testGetBillingStatus() {
  console.log('🧪 Testing Get Billing Status...');
  
  try {
    const response = await api.get(`/billing/reassignment-status/${testPatientId}`);
    
    if (response.data.success) {
      console.log('✅ Get Billing Status Test Passed');
      console.log('Billing Status:', response.data.data);
      return response.data.data;
    } else {
      console.log('❌ Get Billing Status Test Failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Get Billing Status Test Error:', error.response?.data?.message || error.message);
  }
}

async function testCancelBill() {
  console.log('🧪 Testing Cancel Bill...');
  
  try {
    const cancelData = {
      patientId: testPatientId,
      reason: 'Test cancellation - patient requested',
      centerId: TEST_CENTER_ID
    };

    const response = await api.post('/billing/cancel-bill', cancelData);
    
    if (response.data.success) {
      console.log('✅ Cancel Bill Test Passed');
      console.log('Cancelled Bill:', response.data.cancelledBill);
      return response.data.cancelledBill;
    } else {
      console.log('❌ Cancel Bill Test Failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Cancel Bill Test Error:', error.response?.data?.message || error.message);
  }
}

async function testProcessRefund() {
  console.log('🧪 Testing Process Refund...');
  
  try {
    const refundData = {
      patientId: testPatientId,
      amount: 50,
      method: 'cash',
      reason: 'Test refund - service not provided',
      notes: 'Test refund processing',
      centerId: TEST_CENTER_ID
    };

    const response = await api.post('/billing/process-refund', refundData);
    
    if (response.data.success) {
      console.log('✅ Process Refund Test Passed');
      console.log('Refund:', response.data.refund);
      return response.data.refund;
    } else {
      console.log('❌ Process Refund Test Failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Process Refund Test Error:', error.response?.data?.message || error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Reassignment Billing System Tests...\n');
  
  // Test 1: Create Invoice
  const invoice = await testCreateInvoice();
  console.log('');
  
  if (invoice) {
    // Test 2: Process Payment
    await testProcessPayment(invoice._id);
    console.log('');
    
    // Test 3: Get Billing Status
    await testGetBillingStatus();
    console.log('');
    
    // Test 4: Process Refund
    await testProcessRefund();
    console.log('');
    
    // Test 5: Cancel Bill
    await testCancelBill();
    console.log('');
  }
  
  console.log('🏁 All tests completed!');
}

// Helper function to test free reassignment eligibility
function testFreeReassignmentLogic() {
  console.log('🧪 Testing Free Reassignment Logic...');
  
  // Mock patient data
  const patientWithFirstConsultation = {
    billing: [{
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    }],
    isReassigned: false,
    reassignmentHistory: []
  };
  
  const patientWithOldConsultation = {
    billing: [{
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    }],
    isReassigned: false,
    reassignmentHistory: []
  };
  
  const patientAlreadyReassigned = {
    billing: [{
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }],
    isReassigned: true,
    reassignmentHistory: [{}]
  };
  
  // Test cases
  const testCases = [
    { patient: patientWithFirstConsultation, expected: true, description: 'First consultation within 7 days' },
    { patient: patientWithOldConsultation, expected: false, description: 'First consultation older than 7 days' },
    { patient: patientAlreadyReassigned, expected: false, description: 'Already reassigned' }
  ];
  
  testCases.forEach(({ patient, expected, description }) => {
    const isEligible = isEligibleForFreeReassignment(patient);
    const result = isEligible === expected ? '✅' : '❌';
    console.log(`${result} ${description}: ${isEligible} (expected: ${expected})`);
  });
}

// Free reassignment eligibility function (copied from controller)
function isEligibleForFreeReassignment(patient) {
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

// Export for use in other files
export {
  testCreateInvoice,
  testProcessPayment,
  testGetBillingStatus,
  testCancelBill,
  testProcessRefund,
  runAllTests,
  testFreeReassignmentLogic
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('📋 Note: Update TEST_TOKEN and TEST_CENTER_ID before running tests\n');
  testFreeReassignmentLogic();
  console.log('');
  // Uncomment the line below to run API tests (requires valid tokens)
  // runAllTests();
}
