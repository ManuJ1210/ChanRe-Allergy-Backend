import Patient from '../models/Patient.js';
import Test from '../models/Test.js'; // Make sure this import is correct

const addPatient = async (req, res) => {
  try {
    const {
      name,
      gender,
      age,
      contact,
      email,
      address,
      assignedDoctor,
      centerCode,
      centerId,
      appointmentId,
      appointmentConfirmed
    } = req.body;

    // For receptionists, we'll be more flexible with centerId
    // If they have a centerId, use it; otherwise, try to get it from the request body
    let patientCenterId = req.user.centerId;
    let finalCenterCode = centerCode;
    
    if (!patientCenterId) {
      // If user doesn't have centerId, try to get it from request body
      if (centerId) {
        patientCenterId = centerId;
      } else if (centerCode) {
        // Try to find center by code if centerId is not provided
        try {
          const Center = (await import('../models/Center.js')).default;
          const center = await Center.findOne({ code: centerCode });
          if (center) {
            patientCenterId = center._id;
            finalCenterCode = center.code;
          }
        } catch (centerError) {
          console.error('Error finding center by code:', centerError);
        }
      }
    } else {
      // If we have centerId, get the center code
      try {
        const Center = (await import('../models/Center.js')).default;
        const center = await Center.findById(patientCenterId);
        if (center) {
          finalCenterCode = center.code;
        }
      } catch (centerError) {
        console.error('Error finding center by ID:', centerError);
      }
    }
    
    if (!patientCenterId) {
      return res.status(400).json({ 
        message: "Center ID is required. Please provide either centerId or centerCode in the request body, or ensure the user is assigned to a center.",
        debug: {
          userRole: req.user?.role,
          userCenterId: req.user?.centerId,
          requestCenterId: centerId,
          requestCenterCode: centerCode
        }
      });
    }

    // Generate UH ID: centerCode + serial number
    // Get the next serial number for this center
    const lastPatient = await Patient.findOne({ centerId: patientCenterId })
      .sort({ serialNumber: -1 });
    
    const nextSerialNumber = lastPatient ? (lastPatient.serialNumber || 0) + 1 : 1;
    const uhId = `${finalCenterCode}${nextSerialNumber.toString().padStart(3, '0')}`;

    const patientData = {
      name,
      gender,
      age,
      phone: contact,
      email,
      address,
      centerId: patientCenterId,
      assignedDoctor,
      assignedAt: assignedDoctor ? new Date() : undefined, // Set assignedAt if doctor is assigned
      centerCode: finalCenterCode,
      uhId,
      serialNumber: nextSerialNumber,
      registeredBy: req.user._id
    };

    // If this is from an existing appointment, add appointment reference
    if (appointmentId && appointmentConfirmed) {
      patientData.appointmentId = appointmentId;
      patientData.fromAppointment = true;
    }

    const newPatient = new Patient(patientData);
    const savedPatient = await newPatient.save();

    // If this is from an existing appointment, update the appointment status
    if (appointmentId && appointmentConfirmed) {
      try {
        const PatientAppointment = (await import('../models/PatientAppointment.js')).default;
        await PatientAppointment.findByIdAndUpdate(appointmentId, {
          status: 'completed',
          patientId: savedPatient._id,
          completedAt: new Date()
        });
      } catch (appointmentError) {
        console.error('Error updating appointment:', appointmentError);
        // Don't fail the patient creation if appointment update fails
      }
    }
    
    res.status(201).json({ 
      message: appointmentId ? "Patient created successfully from existing appointment" : "Patient created successfully", 
      patient: savedPatient 
    });
  } catch (error) {
    console.error("Create patient error:", error);
    res.status(500).json({ message: "Failed to create patient", error: error.message });
  }
};

const getPatients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', centerId, includeReassigned } = req.query;
    
    let query = {};
    
    // For superadmin users, allow filtering by centerId query parameter
    if (req.user.role === 'superadmin' && centerId) {
      query.centerId = centerId;
    } else {
      // For other users, use their assigned centerId
      if (includeReassigned === 'true') {
        // Include reassigned patients - patients that were originally from this center
        // or are currently assigned to this center
        query.$or = [
          { centerId: req.user.centerId }, // Current center patients
          { originalCenterId: req.user.centerId }, // Originally from this center
          { 'reassignmentHistory.centerId': req.user.centerId } // Reassigned to/from this center
        ];
      } else {
        // Default behavior - only current center patients
        query.centerId = req.user.centerId;
      }
    }
    
    if (search) {
      const searchQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { uhId: { $regex: search, $options: 'i' } }
        ]
      };
      
      if (query.$or) {
        // If we already have $or for center filtering, combine them
        query = {
          $and: [
            query,
            searchQuery
          ]
        };
      } else {
        query.$or = searchQuery.$or;
      }
    }
    
    if (status) {
      query.status = status;
    }

    const patients = await Patient.find(query)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Manually populate assignedDoctor if it's still a string
    const User = (await import('../models/User.js')).default;
    for (let patient of patients) {
      if (patient.assignedDoctor && typeof patient.assignedDoctor === 'string') {
        try {
          const doctor = await User.findById(patient.assignedDoctor).select('name specializations specialization');
          if (doctor) {
            patient.assignedDoctor = doctor;
          }
        } catch (userError) {
          console.log('❌ Error finding doctor for patient:', patient._id, userError.message);
        }
      }
    }

    const total = await Patient.countDocuments(query);

    // Calculate today's patients
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPatients = await Patient.countDocuments({
      ...query,
      createdAt: { $gte: today }
    });

    // Get test counts
    const patientIds = patients.map(p => p._id);
    const [pendingTests, completedTests] = await Promise.all([
      Test.countDocuments({ 
        patient: { $in: patientIds },
        status: { $in: ['pending', 'in_progress'] }
      }),
      Test.countDocuments({ 
        patient: { $in: patientIds },
        status: 'completed'
      })
    ]);

    res.json({
      patients,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      stats: {
        totalPatients: total,
        todayPatients,
        pendingTests,
        completedTests
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Failed to fetch patients' });
  }
};

// Get all patients for superadmin (for consultation fee billing)
const getAllPatients = async (req, res) => {
  try {
    // Only allow superadmin to access this endpoint
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only superadmin can access all patients.' 
      });
    }

    const { page = 1, limit = 100, search = '', status = '' } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { uhId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const patients = await Patient.find(query)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Manually populate assignedDoctor if it's still a string
    const User = (await import('../models/User.js')).default;
    for (let patient of patients) {
      if (patient.assignedDoctor && typeof patient.assignedDoctor === 'string') {
        try {
          const doctor = await User.findById(patient.assignedDoctor).select('name specializations specialization');
          if (doctor) {
            patient.assignedDoctor = doctor;
          }
        } catch (userError) {
          console.log('❌ Error finding doctor for patient:', patient._id, userError.message);
        }
      }
    }

    const total = await Patient.countDocuments(query);

    res.json({
      success: true,
      patients,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all patients:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch patients',
      error: error.message 
    });
  }
};

const getPatientById = async (req, res) => {
  try {
    console.log('🔍 getPatientById called for patient ID:', req.params.id);
    
    const patient = await Patient.findById(req.params.id)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization')
      .populate('registeredBy', 'name');
    
    if (!patient) {
      console.log('❌ Patient not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    console.log('✅ Patient found:', patient.name);
    console.log('🔍 assignedDoctor before populate:', patient.assignedDoctor);
    console.log('🔍 registeredBy before populate:', patient.registeredBy);
    
    // Check if assignedDoctor is populated correctly
    if (patient.assignedDoctor) {
      console.log('🔍 assignedDoctor type:', typeof patient.assignedDoctor);
      console.log('🔍 assignedDoctor keys:', Object.keys(patient.assignedDoctor));
      console.log('🔍 assignedDoctor name:', patient.assignedDoctor.name);
      console.log('🔍 assignedDoctor _id:', patient.assignedDoctor._id);
    } else {
      console.log('🔍 No assignedDoctor found');
    }
    
    // Check if registeredBy is populated correctly
    if (patient.registeredBy) {
      console.log('🔍 registeredBy type:', typeof patient.registeredBy);
      console.log('🔍 registeredBy keys:', Object.keys(patient.registeredBy));
      console.log('🔍 registeredBy name:', patient.registeredBy.name);
      console.log('🔍 registeredBy _id:', patient.registeredBy._id);
    } else {
      console.log('🔍 No registeredBy found');
    }
    
    // Return the expected structure that the frontend expects
    const response = {
      patient,
      history: [],
      medications: [],
      tests: []
    };
    
    console.log('🔍 Final response patient.assignedDoctor:', response.patient.assignedDoctor);
    console.log('🔍 Final response patient.registeredBy:', response.patient.registeredBy);
    
    // Verify if the assignedDoctor User exists
    if (patient.assignedDoctor && typeof patient.assignedDoctor === 'string') {
      try {
        const User = (await import('../models/User.js')).default;
        const doctor = await User.findById(patient.assignedDoctor).select('name specializations specialization');
        console.log('🔍 Found doctor in User collection:', doctor);
        if (doctor) {
          // Manually populate the assignedDoctor field
          response.patient.assignedDoctor = doctor;
          console.log('🔍 Manually populated assignedDoctor:', response.patient.assignedDoctor);
        }
      } catch (userError) {
        console.log('❌ Error finding doctor in User collection:', userError.message);
      }
    }
    
    // Verify if the registeredBy User exists
    if (patient.registeredBy && typeof patient.registeredBy === 'string') {
      try {
        const User = (await import('../models/User.js')).default;
        const registeredByUser = await User.findById(patient.registeredBy).select('name');
        console.log('🔍 Found registeredBy user in User collection:', registeredByUser);
        if (registeredByUser) {
          // Manually populate the registeredBy field
          response.patient.registeredBy = registeredByUser;
          console.log('🔍 Manually populated registeredBy:', response.patient.registeredBy);
        }
      } catch (userError) {
        console.log('❌ Error finding registeredBy user in User collection:', userError.message);
      }
    }
    
    res.json(response);
  } catch (err) {
    console.error('❌ Error in getPatientById:', err);
    res.status(500).json({ message: 'Failed to fetch patient', error: err.message });
  }
};

const updatePatient = async (req, res) => {
  try {
    
    const {
      name,
      gender,
      age,
      contact,
      phone,
      email,
      address,
      assignedDoctor,
      centerCode
    } = req.body;

    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Update fields
    if (name) patient.name = name;
    if (gender) patient.gender = gender;
    if (age) patient.age = age;
    if (phone || contact) patient.phone = phone || contact; // Handle both phone and contact fields
    if (email) patient.email = email;
    if (address) patient.address = address;
    if (assignedDoctor) {
      patient.assignedDoctor = assignedDoctor;
      // Set assignedAt when a doctor is assigned
      patient.assignedAt = new Date();
    }
    if (centerCode) patient.centerCode = centerCode;

    await patient.save();
    

    res.json({ message: 'Patient updated successfully', patient });
  } catch (err) {
    console.error('❌ Update patient error:', err);
    res.status(500).json({ message: 'Failed to update patient', error: err.message });
  }
};

const deletePatient = async (req, res) => {
  try {
    
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    await patient.deleteOne();
    

    res.json({ message: 'Patient deleted successfully' });
  } catch (err) {
    console.error('❌ Delete patient error:', err);
    res.status(500).json({ message: 'Failed to delete patient', error: err.message });
  }
};

const addTestToPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { testType, testDate, results, status } = req.body;

    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }



    // Check if a test record for this date already exists
    const testDateOnly = new Date(testDate).toDateString();
    let existingTest = patient.tests.find(test => 
      new Date(test.date).toDateString() === testDateOnly
    );

    if (!existingTest) {
      // Create new test record for this date
      existingTest = { date: new Date(testDate) };
      patient.tests.push(existingTest);
    }

    // Map testType to the correct field in the embedded schema
    const fieldMap = {
      'CBC': 'CBC',
      'Hb': 'Hb', 
      'TC': 'TC',
      'DC': 'DC',
      'Neutrophils': 'Neutrophils',
      'Eosinophil': 'Eosinophil',
      'Lymphocytes': 'Lymphocytes',
      'Monocytes': 'Monocytes',
      'Platelets': 'Platelets',
      'ESR': 'ESR',
      'Serum Creatinine': 'SerumCreatinine',
      'Serum IgE Levels': 'SerumIgELevels',
      'C3, C4 Levels': 'C3C4Levels',
      'ANA (IF)': 'ANA_IF',
      'Urine Routine': 'UrineRoutine',
      'Allergy Panel': 'AllergyPanel'
    };

    const mappedField = fieldMap[testType] || testType;
    
    // Set the test result on the correct field
    if (mappedField && results) {
      existingTest[mappedField] = results;
              // Test mapped successfully
      } else {
        // Could not map testType
      }

    await patient.save();


    res.status(201).json({ message: 'Test added successfully', test: existingTest });
  } catch (error) {
    console.error('Add test error:', error);
    res.status(500).json({ message: 'Failed to add test' });
  }
};

// ✅ Get Tests by Patient
const getTestsByPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Return embedded tests from patient
    res.status(200).json({ tests: patient.tests || [] });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ message: 'Failed to fetch tests' });
  }
};

const getPatientAndTests = async (req, res) => {
  try {
    console.log('🔬 getPatientAndTests called for patient ID:', req.params.id);
    
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      console.log('❌ Patient not found for ID:', req.params.id);
      return res.status(404).json({ message: "Patient not found" });
    }

    console.log('✅ Patient found:', patient.name, 'Patient ID:', patient._id);

    // First try to get tests from Test collection
    let tests = [];
    try {
      tests = await Test.find({ patient: patient._id });
      console.log('🔬 Tests found in Test collection:', tests.length);
    } catch (error) {
      console.log('❌ Error fetching from Test collection:', error.message);
    }

    // If no tests in Test collection, use embedded tests from patient
    if (tests.length === 0 && patient.tests && patient.tests.length > 0) {
      console.log('🔬 Using embedded tests from patient:', patient.tests.length);
      tests = patient.tests;
    }

    console.log('🔬 Final tests array length:', tests.length);
    console.log('🔬 Tests data:', tests);
    
    // Debug individual test structure
    if (tests.length > 0) {
      console.log('🔬 First test structure:', tests[0]);
      console.log('🔬 First test date:', tests[0].date);
      console.log('🔬 First test CBC:', tests[0].CBC);
      console.log('🔬 First test keys:', Object.keys(tests[0]));
    }

    // Return just the tests array to match frontend expectations
    res.json(tests);
  } catch (err) {
    console.error('Error in getPatientAndTests:', err);
    res.status(500).json({ message: "Failed to fetch patient tests", error: err.message });
  }
};

// Get patients registered by the logged-in receptionist
const getPatientsByReceptionist = async (req, res) => {
  try {
    const patients = await Patient.find({ registeredBy: req.user._id })
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization');
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch patients', error: err.message });
  }
};

// Get patients assigned to a specific doctor
const getPatientsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const patients = await Patient.find({ assignedDoctor: doctorId })
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization')
      .select('name age gender phone email address centerId assignedDoctor');
    
    // Manually populate assignedDoctor if it's still a string
    const User = (await import('../models/User.js')).default;
    for (let patient of patients) {
      if (patient.assignedDoctor && typeof patient.assignedDoctor === 'string') {
        try {
          const doctor = await User.findById(patient.assignedDoctor).select('name specializations specialization');
          if (doctor) {
            patient.assignedDoctor = doctor;
          }
        } catch (userError) {
          console.log('❌ Error finding doctor for patient:', patient._id, userError.message);
        }
      }
    }
    
    res.json(patients);
  } catch (err) {
    console.error('Get patients by doctor error:', err);
    res.status(500).json({ message: 'Failed to fetch patients by doctor', error: err.message });
  }
};

// Get patient history
const getPatientHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify patient exists
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Import History model
    const History = (await import('../models/historyModel.js')).default;
    
    // Get comprehensive history records from standalone History model
    // Try multiple patientId formats to ensure we find the data
    let histories = await History.find({ patientId: id }).sort({ createdAt: -1 });
    
    // If no results, try with ObjectId
    if (histories.length === 0) {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(id)) {
        histories = await History.find({ 
          patientId: new mongoose.Types.ObjectId(id) 
        }).sort({ createdAt: -1 });
      }
    }
    

    
    // Return the comprehensive history records (not the embedded patient.history)
    res.status(200).json(histories);
  } catch (error) {
    console.error('❌ Get patient history error:', error);
    res.status(500).json({ message: 'Failed to fetch patient history' });
  }
};

// Get patient medications
const getPatientMedications = async (req, res) => {
  try {

    const { id } = req.params;
    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    // Return just the medications array to match frontend expectations
    res.status(200).json(patient.medications || []);
  } catch (error) {
    console.error('❌ Get patient medications error:', error);
    res.status(500).json({ message: 'Failed to fetch patient medications' });
  }
};

// Get patient follow-ups
const getPatientFollowUps = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Return just the follow-ups array to match frontend expectations
    res.status(200).json(patient.followUps || []);
  } catch (error) {
    console.error('Get patient follow-ups error:', error);
    res.status(500).json({ message: 'Failed to fetch patient follow-ups' });
  }
};

// Test endpoint to verify backend is working
const testEndpoint = async (req, res) => {
  try {

    res.json({ 
      message: 'Backend is working!', 
      timestamp: new Date().toISOString(),
      testData: {
        history: ['Sample history item'],
        medications: ['Sample medication'],
        followUps: ['Sample follow-up']
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ message: 'Test endpoint failed' });
  }
};

// Add sample data for testing (temporary function)
const addSampleData = async (req, res) => {
  try {

    const { id } = req.params;
    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Add sample history
    if (!patient.history || patient.history.length === 0) {
      patient.history = [
        {
          hayFever: 'Yes',
          asthma: 'No',
          breathingProblems: 'Sometimes',
          hivesSwelling: 'No',
          sinusTrouble: 'Yes',
          eczemaRashes: 'No',
          foodAllergies: 'Peanuts',
          drugAllergy: 'Penicillin'
        }
      ];

    }

    // Add sample medications
    if (!patient.medications || patient.medications.length === 0) {
      patient.medications = [
        {
          drugName: 'Cetirizine',
          dose: '10mg',
          duration: '7 days',
          frequency: 'Once daily',
          prescribedBy: 'Dr. Smith',
          adverseEvent: 'None'
        }
      ];

    }

    // Add sample follow-ups
    if (!patient.followUps || patient.followUps.length === 0) {
      patient.followUps = [
        {
          type: 'Allergic Rhinitis',
          status: 'active',
          notes: 'Patient responding well to treatment'
        }
      ];

    }

    // Add sample tests
    const sampleTest = new Test({
      patient: patient._id,
      CBC: 'Normal',
      Hb: '14.2 g/dL',
      TC: '7,500 cells/μL',
      DC: 'Normal',
      Neutrophils: '65%',
      Eosinophil: '3%',
      Lymphocytes: '25%',
      Monocytes: '5%',
      Platelets: '250,000/μL',
      ESR: '15 mm/hr',
      SerumCreatinine: '0.9 mg/dL',
      SerumIgELevels: '150 IU/mL',
      C3C4Levels: 'Normal',
      ANA_IF: 'Negative',
      UrineRoutine: 'Normal',
      AllergyPanel: 'Positive for dust mites',
      testType: 'Complete Blood Count',
      status: 'completed',
      date: new Date('2024-01-15'), // Explicit date for testing
      requestedBy: req.user._id
    });

    console.log('🔬 Sample test object before save:', sampleTest);

    await sampleTest.save();
    console.log('✅ Sample test added for patient:', patient.name);
    console.log('🔬 Sample test after save:', sampleTest);
    console.log('🔬 Sample test date after save:', sampleTest.date);
    console.log('🔬 Sample test CBC after save:', sampleTest.CBC);

    await patient.save();

    res.json({ message: 'Sample data added successfully', patient });
  } catch (error) {
    console.error('❌ Add sample data error:', error);
    res.status(500).json({ message: 'Failed to add sample data' });
  }
};

// Mark patient as viewed by doctor
const markPatientAsViewed = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user._id;

    // Check if patient exists
    const patient = await Patient.findById(patientId)
      .populate('assignedDoctor')
      .populate('currentDoctor');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if doctor has access to this patient (either currently assigned or previously assigned)
    const isCurrentlyAssigned = patient.assignedDoctor && 
      patient.assignedDoctor._id.toString() === doctorId.toString();
    
    const wasPreviouslyAssigned = patient.reassignmentHistory && 
      patient.reassignmentHistory.some(reassignment => 
        reassignment.previousDoctor && 
        reassignment.previousDoctor.toString() === doctorId.toString()
      );

    if (!isCurrentlyAssigned && !wasPreviouslyAssigned) {
      return res.status(403).json({ message: 'Patient is not assigned to you' });
    }

    // Mark as viewed if not already viewed
    if (!patient.viewedByDoctor) {
      patient.viewedByDoctor = true;
      patient.viewedAt = new Date();
      patient.appointmentStatus = 'viewed'; // Update appointment status for receptionist view
      await patient.save();
      
      console.log(`✅ Patient ${patient.name} marked as viewed by doctor ${req.user.name}`);
    } else {
      console.log(`ℹ️ Patient ${patient.name} was already marked as viewed`);
    }

    res.json({ 
      message: 'Patient marked as viewed',
      patient: {
        _id: patient._id,
        name: patient.name,
        viewedByDoctor: patient.viewedByDoctor,
        viewedAt: patient.viewedAt,
        appointmentStatus: patient.appointmentStatus
      }
    });
  } catch (error) {
    console.error('❌ Mark patient as viewed error:', error);
    res.status(500).json({ message: 'Failed to mark patient as viewed' });
  }
};

// Reassign doctor for existing patient
const reassignDoctor = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId, reason } = req.body;

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' });
    }

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify the doctor exists
    const User = (await import('../models/User.js')).default;
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Store previous assignment info
    const previousDoctor = patient.assignedDoctor;
    const previousAssignmentDate = patient.assignedAt;

    // Update the patient with new doctor assignment
    patient.assignedDoctor = doctorId;
    patient.assignedAt = new Date();
    patient.viewedByDoctor = false; // Reset viewed status
    patient.viewedAt = null; // Reset viewed date
    patient.isReassigned = true; // Mark patient as reassigned

    // Add reassignment history
    if (!patient.reassignmentHistory) {
      patient.reassignmentHistory = [];
    }
    
    patient.reassignmentHistory.push({
      previousDoctor: previousDoctor,
      newDoctor: doctorId,
      reassignedAt: new Date(),
      reassignedBy: req.user._id,
      reason: reason || 'No reason provided'
    });

    await patient.save();

    // Populate the response with doctor names
    const updatedPatient = await Patient.findById(patientId)
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization')
      .populate('reassignmentHistory.previousDoctor', 'name')
      .populate('reassignmentHistory.newDoctor', 'name')
      .populate('reassignmentHistory.reassignedBy', 'name');

    res.json({ 
      message: 'Doctor reassigned successfully',
      patient: updatedPatient
    });
  } catch (error) {
    console.error('❌ Reassign doctor error:', error);
    res.status(500).json({ message: 'Failed to reassign doctor' });
  }
};

// Auto-reassign patients not viewed by doctor
const autoReassignUnviewedPatients = async (req, res) => {
  try {
    const { reassignDate } = req.body; // Optional: specific date to reassign to
    
    // Find patients assigned today but not viewed by doctor
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const unviewedPatients = await Patient.find({
      assignedAt: { $gte: today, $lt: tomorrow },
      viewedByDoctor: false,
      appointmentStatus: { $ne: 'viewed' }
    }).populate('assignedDoctor');
    
    if (unviewedPatients.length === 0) {
      return res.json({ 
        message: 'No unviewed patients found for today',
        reassignedCount: 0 
      });
    }
    
    const reassignedPatients = [];
    const targetDate = reassignDate ? new Date(reassignDate) : new Date(today.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow
    
    for (const patient of unviewedPatients) {
      // Update patient status
      patient.appointmentStatus = 'reassigned';
      patient.reassignedAt = new Date();
      patient.reassignedDate = targetDate;
      
      // Add reassignment history
      if (!patient.reassignmentHistory) {
        patient.reassignmentHistory = [];
      }
      
      patient.reassignmentHistory.push({
        previousDoctor: patient.assignedDoctor._id,
        newDoctor: patient.assignedDoctor._id, // Same doctor
        reassignedAt: new Date(),
        reassignedBy: req.user._id,
        reason: 'Auto-reassignment - Patient not viewed by doctor on scheduled date',
        autoReassigned: true
      });
      
      await patient.save();
      reassignedPatients.push({
        patientId: patient._id,
        patientName: patient.name,
        uhId: patient.uhId,
        reassignedDate: targetDate
      });
    }
    
    res.json({
      message: `Successfully auto-reassigned ${reassignedPatients.length} patients`,
      reassignedCount: reassignedPatients.length,
      reassignedPatients,
      targetDate
    });
    
  } catch (error) {
    console.error('❌ Auto-reassign unviewed patients error:', error);
    res.status(500).json({ message: 'Failed to auto-reassign unviewed patients' });
  }
};

// Record patient revisit
const recordPatientRevisit = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { revisitReason, assignedDoctor } = req.body;

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Create revisit record
    const revisitRecord = {
      revisitDate: new Date(),
      reason: revisitReason || 'Follow-up consultation',
      assignedDoctor: assignedDoctor || patient.assignedDoctor,
      recordedBy: req.user._id
    };

    // Add to patient's revisit history
    if (!patient.revisitHistory) {
      patient.revisitHistory = [];
    }
    patient.revisitHistory.push(revisitRecord);

    // Update last visit date
    patient.lastVisitDate = new Date();
    patient.visitCount = (patient.visitCount || 0) + 1;

    await patient.save();

    // Populate the response
    const updatedPatient = await Patient.findById(patientId)
      .populate('assignedDoctor', 'name specializations specialization')
      .populate('currentDoctor', 'name specializations specialization')
      .populate('revisitHistory.assignedDoctor', 'name')
      .populate('revisitHistory.recordedBy', 'name');

    res.json({ 
      message: 'Patient revisit recorded successfully',
      patient: updatedPatient,
      revisitRecord: revisitRecord
    });
  } catch (error) {
    console.error('❌ Record patient revisit error:', error);
    res.status(500).json({ message: 'Failed to record patient revisit' });
  }
};

// Get patient appointment data
const getPatientAppointment = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const patient = await Patient.findById(patientId)
      .populate('appointmentId', 'patientName patientEmail patientPhone preferredDate preferredTime confirmedDate confirmedTime appointmentType reasonForVisit symptoms status confirmationCode');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    res.json({
      success: true,
      data: {
        patientId: patient._id,
        appointmentId: patient.appointmentId,
        fromAppointment: patient.fromAppointment,
        appointmentTime: patient.appointmentTime,
        appointmentStatus: patient.appointmentStatus
      }
    });
  } catch (error) {
    console.error('Error fetching patient appointment:', error);
    res.status(500).json({ message: 'Failed to fetch patient appointment data' });
  }
};

// ✅ Named exports (required for ESM import)
export {
  addPatient,
  getPatients,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  addTestToPatient,
  getTestsByPatient,
  getPatientAndTests,
  getPatientsByReceptionist,
  getPatientsByDoctor,
  getPatientHistory,
  getPatientMedications,
  getPatientFollowUps,
  addSampleData,
  testEndpoint,
  markPatientAsViewed,
  reassignDoctor,
  autoReassignUnviewedPatients,
  recordPatientRevisit,
  getPatientAppointment
};
