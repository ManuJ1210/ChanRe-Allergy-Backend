import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TestRequest from '../models/TestRequest.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Center from '../models/Center.js';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/chenre-allergy';

async function clearTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Clear test requests
    const deletedTestRequests = await TestRequest.deleteMany({
      $or: [
        { testType: 'Complete Blood Count (CBC)' },
        { testType: 'Allergy Panel' },
        { testType: 'Liver Function Test' },
        { testType: 'Kidney Function Test' },
        { testType: 'Thyroid Function Test' },
        { testType: 'Diabetes Screening' },
        { testType: 'Complete Metabolic Panel' },
        { testType: 'Lipid Panel' }
      ]
    });
    console.log(`✅ Deleted ${deletedTestRequests.deletedCount} test requests`);

    // Clear test doctors
    const deletedDoctors = await User.deleteMany({
      $or: [
        { email: 'doctor@test.com' },
        { email: 'sarah.johnson@test.com' },
        { email: 'michael.chen@test.com' }
      ]
    });
    console.log(`✅ Deleted ${deletedDoctors.deletedCount} test doctors`);

    // Clear test patients
    const deletedPatients = await Patient.deleteMany({
      $or: [
        { name: 'Test Patient' },
        { name: 'Emma Wilson' },
        { name: 'James Brown' }
      ]
    });
    console.log(`✅ Deleted ${deletedPatients.deletedCount} test patients`);

    // Clear test center (only if no other data exists)
    const remainingData = await Promise.all([
      TestRequest.countDocuments(),
      User.countDocuments(),
      Patient.countDocuments()
    ]);

    if (remainingData.every(count => count === 0)) {
      const deletedCenter = await Center.deleteMany({
        name: 'Test Medical Center'
      });
      console.log(`✅ Deleted ${deletedCenter.deletedCount} test center`);
    } else {
      console.log('⚠️  Keeping test center as other data exists');
    }

    console.log('✅ Test data cleared successfully!');

  } catch (error) {
    console.error('❌ Error clearing test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
clearTestData();
