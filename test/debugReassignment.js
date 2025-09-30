// Debug script to test reassignment functionality
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Test the reassignment endpoint
async function testReassignment() {
  console.log('🧪 Testing Reassignment Endpoint...\n');
  
  try {
    // Test 1: Check if endpoint exists (should get 401/403 without auth)
    console.log('1. Testing endpoint accessibility...');
    const response = await axios.post(`${BASE_URL}/patients/reassign`, {}, {
      timeout: 5000,
      validateStatus: () => true // Accept any status code
    });
    
    if (response.status === 401 || response.status === 403) {
      console.log('✅ Endpoint exists and requires authentication');
    } else if (response.status === 400) {
      console.log('✅ Endpoint exists and validation is working');
    } else {
      console.log(`⚠️ Unexpected status: ${response.status}`);
    }
    
    // Test 2: Test with invalid data (should get 400)
    console.log('\n2. Testing with invalid data...');
    const invalidResponse = await axios.post(`${BASE_URL}/patients/reassign`, {
      patientId: 'invalid-id',
      newDoctorId: 'invalid-id',
      reason: ''
    }, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (invalidResponse.status === 400) {
      console.log('✅ Validation is working correctly');
    } else {
      console.log(`⚠️ Unexpected validation response: ${invalidResponse.status}`);
    }
    
    // Test 3: Test with valid data structure (should get 401/403)
    console.log('\n3. Testing with valid data structure...');
    const validResponse = await axios.post(`${BASE_URL}/patients/reassign`, {
      patientId: '507f1f77bcf86cd799439011', // Valid ObjectId format
      newDoctorId: '507f1f77bcf86cd799439012', // Valid ObjectId format
      reason: 'Test reassignment',
      notes: 'Test notes',
      centerId: '507f1f77bcf86cd799439013'
    }, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (validResponse.status === 401 || validResponse.status === 403) {
      console.log('✅ Endpoint accepts valid data structure');
    } else if (validResponse.status === 404) {
      console.log('✅ Endpoint accepts valid data but patient/doctor not found (expected)');
    } else {
      console.log(`⚠️ Unexpected response: ${validResponse.status}`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running - start the backend server');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Test the doctors endpoint
async function testDoctorsEndpoint() {
  console.log('\n🧪 Testing Doctors Endpoint...\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/doctors`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 401 || response.status === 403) {
      console.log('✅ Doctors endpoint exists and requires authentication');
    } else if (response.status === 200) {
      console.log('✅ Doctors endpoint accessible');
      console.log('Doctors data:', response.data);
    } else {
      console.log(`⚠️ Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Test the patients endpoint
async function testPatientsEndpoint() {
  console.log('\n🧪 Testing Patients Endpoint...\n');
  
  try {
    const response = await axios.get(`${BASE_URL}/patients`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 401 || response.status === 403) {
      console.log('✅ Patients endpoint exists and requires authentication');
    } else if (response.status === 200) {
      console.log('✅ Patients endpoint accessible');
      console.log('Patients count:', response.data?.length || 0);
    } else {
      console.log(`⚠️ Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Run all tests
async function runDebugTests() {
  console.log('🚀 Starting Debug Tests for Reassignment System\n');
  
  await testReassignment();
  await testDoctorsEndpoint();
  await testPatientsEndpoint();
  
  console.log('\n📋 Debug Instructions:');
  console.log('1. Open browser console (F12)');
  console.log('2. Go to Reassign Patient page');
  console.log('3. Click "Reassign" button on any patient');
  console.log('4. Check console logs for:');
  console.log('   - "🔄 Opening reassignment modal for patient"');
  console.log('   - "🔄 Fetching available doctors"');
  console.log('   - "Doctors API response"');
  console.log('   - "Filtered doctors"');
  console.log('5. Fill the form and submit');
  console.log('6. Check console logs for:');
  console.log('   - "🔄 Starting reassignment process"');
  console.log('   - "Sending request to /patients/reassign"');
  console.log('   - "Reassignment response"');
  console.log('7. Check backend console for:');
  console.log('   - "🔄 Patient reassignment request received"');
  console.log('   - "✅ Validation passed"');
  console.log('   - "✅ Patient found"');
  console.log('   - "✅ Doctor found"');
  
  console.log('\n🔧 Common Issues:');
  console.log('- Authentication: Make sure you\'re logged in');
  console.log('- Network: Check if backend server is running');
  console.log('- CORS: Check browser network tab for CORS errors');
  console.log('- Data: Verify patient and doctor IDs are valid');
}

// Export for use in other files
export { testReassignment, testDoctorsEndpoint, testPatientsEndpoint, runDebugTests };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDebugTests();
}
