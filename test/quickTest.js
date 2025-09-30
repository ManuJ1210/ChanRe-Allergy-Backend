// Quick test to verify the reassignment billing system is working
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Test if the endpoints are accessible
async function testEndpoints() {
  console.log('🧪 Testing Reassignment Billing Endpoints...\n');
  
  const endpoints = [
    '/reassignment-billing/create-invoice',
    '/reassignment-billing/process-payment', 
    '/reassignment-billing/cancel-bill',
    '/reassignment-billing/process-refund',
    '/patients/reassign'
  ];
  
  for (const endpoint of endpoints) {
    try {
      // Just test if the endpoint exists (will get 401/403 without auth, but that's expected)
      const response = await axios.post(`${BASE_URL}${endpoint}`, {}, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      
      if (response.status === 401 || response.status === 403) {
        console.log(`✅ ${endpoint} - Endpoint exists (auth required)`);
      } else if (response.status === 400) {
        console.log(`✅ ${endpoint} - Endpoint exists (validation working)`);
      } else {
        console.log(`⚠️  ${endpoint} - Status: ${response.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint} - Server not running`);
      } else {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n🏁 Endpoint test completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Start the backend server: npm start');
  console.log('2. Test with valid authentication tokens');
  console.log('3. Verify patient reassignment functionality');
}

// Test the free reassignment logic
function testFreeReassignmentLogic() {
  console.log('\n🧪 Testing Free Reassignment Logic...\n');
  
  // Mock patient data
  const testCases = [
    {
      name: 'First consultation within 7 days',
      patient: {
        billing: [{ createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }],
        isReassigned: false,
        reassignmentHistory: []
      },
      expected: true
    },
    {
      name: 'First consultation older than 7 days',
      patient: {
        billing: [{ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }],
        isReassigned: false,
        reassignmentHistory: []
      },
      expected: false
    },
    {
      name: 'Already reassigned',
      patient: {
        billing: [{ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }],
        isReassigned: true,
        reassignmentHistory: [{}]
      },
      expected: false
    },
    {
      name: 'No billing records',
      patient: {
        billing: [],
        isReassigned: false,
        reassignmentHistory: []
      },
      expected: false
    }
  ];
  
  testCases.forEach(({ name, patient, expected }) => {
    const isEligible = isEligibleForFreeReassignment(patient);
    const result = isEligible === expected ? '✅' : '❌';
    console.log(`${result} ${name}: ${isEligible} (expected: ${expected})`);
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

// Run tests
async function runTests() {
  console.log('🚀 Starting Quick Tests for Reassignment Billing System\n');
  
  testFreeReassignmentLogic();
  await testEndpoints();
  
  console.log('\n📚 Documentation:');
  console.log('- Backend routes: /api/reassignment-billing/*');
  console.log('- Frontend component: ReassignPatient.jsx');
  console.log('- Patient model field: reassignedBilling[]');
  console.log('- Free consultation: First reassignment within 7 days');
}

// Export for use in other files
export { testEndpoints, testFreeReassignmentLogic, runTests };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
