import Patient from '../models/Patient.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Generate invoice number helper function
const generateInvoiceNumber = (centerCode, type) => {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${centerCode}-REASSIGN-${timestamp}-${random}`;
};

// Generate invoice for reassigned patients only
export const generateReassignedPatientInvoice = async (req, res) => {
  try {
    console.log('🚀 generateReassignedPatientInvoice called');
    
    const { patientId, billingIds, reassignedEntryId, currentDoctorId } = req.body;

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
      .populate('assignedDoctor', 'name')
      .populate('currentDoctor', 'name');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Verify this is a reassigned patient
    if (!patient.isReassigned) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for reassigned patients'
      });
    }

    console.log('🔍 Reassigned patient found:', {
      patientId: patient._id,
      patientName: patient.name,
      isReassigned: patient.isReassigned,
      currentDoctor: patient.currentDoctor?.name,
      reassignedEntryId: reassignedEntryId
    });

    // Get reassigned billing records (separate from main billing)
    let billingRecords = patient.reassignedBilling || [];
    console.log('🔍 Reassigned billing records:', billingRecords.length);

    // Filter by specific billing IDs if provided
    if (billingIds && Array.isArray(billingIds) && billingIds.length > 0) {
      billingRecords = billingRecords.filter(bill => billingIds.includes(bill._id.toString()));
      console.log('🔍 Filtered by specific billing IDs:', billingRecords.length);
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

    // Generate special invoice number for reassigned patients
    const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'REASSIGN', 'REASSIGN');

    // Get the original creator from the first billing record
    const originalCreator = billingRecords.length > 0 ? billingRecords[0].paidBy : req.user.name;

    // Get the doctor name from the consultation fee (for reassigned patients)
    const consultationFee = billingRecords.find(bill => 
      bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')
    );
    const doctorName = consultationFee?.doctorId ? 
      (await User.findById(consultationFee.doctorId))?.name || patient.currentDoctor?.name || 'Not Assigned' :
      patient.currentDoctor?.name || 'Not Assigned';

    // Create reassigned patient invoice data
    const invoice = {
      invoiceNumber: invoiceNumber,
      isReassignedEntry: true,
      reassignedEntryId: reassignedEntryId,
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

    console.log('✅ Reassigned patient invoice generated successfully');

    res.status(200).json({
      success: true,
      message: 'Reassigned patient invoice generated successfully',
      invoice: invoice
    });

  } catch (error) {
    console.error('❌ Error generating reassigned patient invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate reassigned patient invoice',
      error: error.message
    });
  }
};

// Create consultation fee billing for reassigned patients
export const createReassignedConsultationFeeBilling = async (req, res) => {
  try {
    console.log('🚀 createReassignedConsultationFeeBilling called');
    console.log('📋 Request body:', req.body);

    const { patientId, doctorId, amount, paymentMethod, notes, reassignedEntryId } = req.body;

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

    // Verify this is a reassigned patient
    if (!patient.isReassigned) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for reassigned patients'
      });
    }

    const currentDoctorId = doctorId || patient.currentDoctor?._id || patient.currentDoctor;
    
    console.log('🔍 Reassigned patient consultation fee info:', {
      patientId: patient._id,
      patientName: patient.name,
      isReassigned: patient.isReassigned,
      currentDoctorId: currentDoctorId,
      reassignedEntryId: reassignedEntryId
    });
    
    // Check if consultation fee already exists for this reassigned entry
    const existingConsultationFee = patient.billing && patient.billing.find(bill => 
      (bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')) &&
      bill.isReassignedEntry &&
      bill.reassignedEntryId === reassignedEntryId &&
      bill.doctorId && bill.doctorId.toString() === currentDoctorId?.toString()
    );

    if (existingConsultationFee) {
      return res.status(400).json({
        success: false,
        message: 'Consultation fee already exists for this reassigned patient with the current doctor'
      });
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'REASSIGN', 'CON');

    // Create consultation fee billing record for reassigned patient
    const consultationFee = {
      type: 'consultation',
      description: notes || `Doctor consultation fee for ${patient.name} (reassigned patient)`,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'cash',
      status: 'paid',
      paidBy: req.user.name,
      paidAt: new Date(),
      invoiceNumber: invoiceNumber,
      doctorId: currentDoctorId,
      isReassignedEntry: true,
      reassignedEntryId: reassignedEntryId,
      createdAt: new Date()
    };
    
    console.log('🔍 Created reassigned consultation fee:', {
      type: consultationFee.type,
      description: consultationFee.description,
      amount: consultationFee.amount,
      doctorId: consultationFee.doctorId,
      isReassignedEntry: consultationFee.isReassignedEntry,
      reassignedEntryId: consultationFee.reassignedEntryId,
      invoiceNumber: consultationFee.invoiceNumber
    });

    // Add billing record to reassigned billing array (separate from main billing)
    if (!patient.reassignedBilling) {
      patient.reassignedBilling = [];
    }
    patient.reassignedBilling.push(consultationFee);

    // Save patient
    await patient.save();

    console.log('✅ Reassigned consultation fee billing created successfully');
    console.log('📋 Updated patient reassigned billing:', patient.reassignedBilling);
    
    // Verify the billing was actually saved and get fresh patient data
    const savedPatient = await Patient.findById(patient._id);
    console.log('📋 Verification - Saved patient reassigned billing:', savedPatient.reassignedBilling);

    res.status(201).json({
      success: true,
      message: 'Reassigned consultation fee payment recorded successfully',
      billing: consultationFee,
      patient: savedPatient // Return the fresh patient data
    });

  } catch (error) {
    console.error('❌ Error creating reassigned consultation fee billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record reassigned consultation fee payment',
      error: error.message
    });
  }
};

// Create service charges billing for reassigned patients
export const createReassignedServiceChargesBilling = async (req, res) => {
  try {
    console.log('🚀 createReassignedServiceChargesBilling called');
    console.log('📋 Request body:', req.body);

    const { patientId, services, paymentMethod, notes, doctorId, reassignedEntryId } = req.body;

    // Validate required fields
    if (!patientId || !services || !Array.isArray(services)) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and services are required'
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

    // Verify this is a reassigned patient
    if (!patient.isReassigned) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for reassigned patients'
      });
    }

    const currentDoctorId = doctorId || patient.currentDoctor?._id || patient.currentDoctor;
    
    console.log('🔍 Reassigned patient service charges info:', {
      patientId: patient._id,
      patientName: patient.name,
      isReassigned: patient.isReassigned,
      currentDoctorId: currentDoctorId,
      reassignedEntryId: reassignedEntryId,
      servicesCount: services.length
    });

    // Create service billing records for reassigned patient
    const serviceBills = services.map(service => {
      const invoiceNumber = generateInvoiceNumber(patient.centerCode || 'REASSIGN', 'SRV');
      
      return {
        type: 'service',
        description: service.description || service.name,
        amount: parseFloat(service.amount),
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        paidBy: req.user.name,
        paidAt: new Date(),
        invoiceNumber: invoiceNumber,
        serviceDetails: service.details || '',
        doctorId: currentDoctorId,
        isReassignedEntry: true,
        reassignedEntryId: reassignedEntryId,
        createdAt: new Date()
      };
    });

    console.log('🔍 Created reassigned service bills:', serviceBills.length);

    // Add billing records to reassigned billing array (separate from main billing)
    if (!patient.reassignedBilling) {
      patient.reassignedBilling = [];
    }
    patient.reassignedBilling.push(...serviceBills);

    // Save patient
    await patient.save();

    console.log('✅ Reassigned service charges billing created successfully');
    console.log('📋 Updated patient reassigned billing:', patient.reassignedBilling);
    
    // Verify the billing was actually saved and get fresh patient data
    const savedPatient = await Patient.findById(patient._id);
    console.log('📋 Verification - Saved patient reassigned billing:', savedPatient.reassignedBilling);

    res.status(201).json({
      success: true,
      message: 'Reassigned service charges payment recorded successfully',
      billing: serviceBills,
      patient: savedPatient // Return the fresh patient data
    });

  } catch (error) {
    console.error('❌ Error creating reassigned service charges billing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record reassigned service charges payment',
      error: error.message
    });
  }
};
