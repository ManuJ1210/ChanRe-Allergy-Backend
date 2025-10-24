import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TransactionService from './services/transactionService.js';
import Patient from './models/Patient.js';
import User from './models/User.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chanre-allergy', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixMissingTransaction() {
  try {
    console.log('🔍 Looking for Naidu\'s transaction...');
    
    // Find the patient
    const patient = await Patient.findOne({ 
      $or: [
        { email: 'naidu@gmail.com' },
        { phone: '7878470474' },
        { name: /naidu/i }
      ]
    });
    
    if (!patient) {
      console.log('❌ Patient not found');
      return;
    }
    
    console.log('✅ Found patient:', patient.name, patient.email);
    console.log('🔍 Patient billing:', patient.billing);
    
    // Find a user to use as the processedBy user
    const user = await User.findOne({ role: 'receptionist' });
    if (!user) {
      console.log('❌ No receptionist user found');
      return;
    }
    
    // Check if transaction already exists
    const existingTransaction = await mongoose.connection.db.collection('consultationtransactions').findOne({
      patientId: patient._id,
      amount: 1000
    });
    
    if (existingTransaction) {
      console.log('✅ Transaction already exists:', existingTransaction.transactionId);
      return;
    }
    
    // Create the missing transaction
    const transactionData = {
      patientId: patient._id,
      doctorId: patient.assignedDoctor?._id || patient.assignedDoctor,
      centerId: patient.centerId,
      consultationType: 'OP',
      amount: 1000,
      paymentMethod: 'cash',
      paymentType: 'full',
      invoiceNumber: 'INV-1761288765989-70MJV',
      paymentBreakdown: {
        registrationFee: 0,
        consultationFee: 1000,
        serviceCharges: [],
        subtotal: 1000,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 1000
      },
      notes: 'Backfilled missing transaction for Naidu - Consultation payment'
    };
    
    const transaction = await TransactionService.createConsultationTransaction(transactionData, user);
    console.log('✅ Transaction created successfully:', transaction.transactionId);
    
  } catch (error) {
    console.error('❌ Error fixing missing transaction:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixMissingTransaction();
