import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TestRequest from '../models/TestRequest.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Center from '../models/Center.js';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/chenre-allergy';

async function createTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Check if test data already exists
    const existingTestRequests = await TestRequest.countDocuments();
    if (existingTestRequests > 0) {
      console.log(`✅ Test data already exists (${existingTestRequests} test requests found)`);
      return;
    }

    // Find or create a center
    let center = await Center.findOne();
    if (!center) {
      center = new Center({
        name: 'Test Medical Center',
        code: 'TMC001',
        address: '123 Test Street, Test City',
        phone: '+1234567890',
        email: 'test@testcenter.com'
      });
      await center.save();
      console.log('✅ Created test center');
    } else {
      console.log('✅ Using existing center:', center.name);
    }

    // Find or create a doctor
    let doctor = await User.findOne({ role: 'doctor' });
    if (!doctor) {
      doctor = new User({
        name: 'Dr. Test Doctor',
        email: 'doctor@test.com',
        phone: '+1234567891',
        role: 'doctor',
        centerId: center._id,
        password: 'test123' // This will be hashed by the model
      });
      await doctor.save();
      console.log('✅ Created test doctor');
    } else {
      console.log('✅ Using existing doctor:', doctor.name);
    }

    // Create additional doctors for testing
    const additionalDoctors = [
      {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@test.com',
        phone: '+1234567893',
        role: 'doctor',
        centerId: center._id,
        password: 'test123'
      },
      {
        name: 'Dr. Michael Chen',
        email: 'michael.chen@test.com',
        phone: '+1234567894',
        role: 'doctor',
        centerId: center._id,
        password: 'test123'
      }
    ];

    for (const doctorData of additionalDoctors) {
      const existingDoctor = await User.findOne({ email: doctorData.email });
      if (!existingDoctor) {
        const newDoctor = new User(doctorData);
        await newDoctor.save();
        console.log(`✅ Created additional doctor: ${doctorData.name}`);
      }
    }

    // Find or create a patient
    let patient = await Patient.findOne();
    if (!patient) {
      patient = new Patient({
        name: 'Test Patient',
        phone: '+1234567892',
        address: '456 Patient Street, Patient City',
        age: 30,
        gender: 'Male',
        centerId: center._id,
        assignedDoctor: doctor._id
      });
      await patient.save();
      console.log('✅ Created test patient');
    } else {
      console.log('✅ Using existing patient:', patient.name);
    }

    // Create additional patients
    const additionalPatients = [
      {
        name: 'Emma Wilson',
        phone: '+1234567895',
        address: '789 Patient Ave, Patient City',
        age: 25,
        gender: 'Female',
        centerId: center._id,
        assignedDoctor: doctor._id
      },
      {
        name: 'James Brown',
        phone: '+1234567896',
        address: '321 Patient Blvd, Patient City',
        age: 45,
        gender: 'Male',
        centerId: center._id,
        assignedDoctor: doctor._id
      }
    ];

    for (const patientData of additionalPatients) {
      const existingPatient = await Patient.findOne({ phone: patientData.phone });
      if (!existingPatient) {
        const newPatient = new Patient(patientData);
        await newPatient.save();
        console.log(`✅ Created additional patient: ${patientData.name}`);
      }
    }

    // Create test requests
    const testRequests = [
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Complete Blood Count (CBC)',
        testDescription: 'Routine blood work to check overall health',
        urgency: 'Normal',
        notes: 'Patient requested routine checkup',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Superadmin_Review',
        workflowStage: 'superadmin_review',
        superadminReview: {
          status: 'pending',
          approvedForLab: false
        }
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Allergy Panel',
        testDescription: 'Comprehensive allergy testing for common allergens',
        urgency: 'Urgent',
        notes: 'Patient experiencing severe allergic reactions',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Superadmin_Review',
        workflowStage: 'superadmin_review',
        superadminReview: {
          status: 'pending',
          approvedForLab: false
        }
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Liver Function Test',
        testDescription: 'Blood test to assess liver health',
        urgency: 'Normal',
        notes: 'Follow-up to previous abnormal results',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Pending',
        workflowStage: 'doctor_request'
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Kidney Function Test',
        testDescription: 'Blood test to assess kidney health',
        urgency: 'Normal',
        notes: 'Routine health checkup',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Assigned',
        workflowStage: 'lab_assignment'
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Thyroid Function Test',
        testDescription: 'Blood test to check thyroid hormone levels',
        urgency: 'Urgent',
        notes: 'Patient showing thyroid symptoms',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Sample_Collection_Scheduled',
        workflowStage: 'sample_collection'
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Diabetes Screening',
        testDescription: 'Blood glucose and HbA1c testing',
        urgency: 'Normal',
        notes: 'Annual diabetes screening',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'In_Lab_Testing',
        workflowStage: 'lab_testing'
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Complete Metabolic Panel',
        testDescription: 'Comprehensive blood chemistry panel',
        urgency: 'Normal',
        notes: 'Comprehensive health assessment',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Report_Generated',
        workflowStage: 'report_generation'
      },
      {
        doctorId: doctor._id,
        patientId: patient._id,
        testType: 'Lipid Panel',
        testDescription: 'Cholesterol and triglyceride testing',
        urgency: 'Normal',
        notes: 'Cardiovascular health screening',
        centerId: center._id,
        centerName: center.name,
        centerCode: center.code,
        doctorName: doctor.name,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        status: 'Completed',
        workflowStage: 'completed'
      }
    ];

    for (const testRequestData of testRequests) {
      const testRequest = new TestRequest(testRequestData);
      await testRequest.save();
      console.log(`✅ Created test request: ${testRequestData.testType}`);
    }

    console.log('✅ Test data creation completed successfully!');
    console.log(`✅ Created ${testRequests.length} test requests`);
    console.log('✅ You can now view these in the superadmin test request pages');
    console.log('');
    console.log('🔑 Test Doctor Login Credentials:');
    console.log('   Email: doctor@test.com, Password: test123');
    console.log('   Email: sarah.johnson@test.com, Password: test123');
    console.log('   Email: michael.chen@test.com, Password: test123');
    console.log('');
    console.log('📋 Test Patient Names:');
    console.log('   - Test Patient');
    console.log('   - Emma Wilson');
    console.log('   - James Brown');
    console.log('');
    console.log('💡 To see test requests in doctor pages:');
    console.log('   1. Login as one of the test doctors above');
    console.log('   2. Navigate to /dashboard/doctor/test-requests');
    console.log('   3. You should see test requests assigned to that doctor');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
createTestData();
