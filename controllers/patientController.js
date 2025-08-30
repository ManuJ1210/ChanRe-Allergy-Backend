import Patient from '../models/Patient.js';
import Test from '../models/Test.js'; // Make sure this import is correct

const addPatient = async (req, res) => {
  try {
    console.log('🔍 addPatient called by user:', {
      role: req.user?.role,
      userId: req.user?._id,
      userCenterId: req.user?.centerId
    });
    
    const {
      name,
      gender,
      age,
      contact,
      email,
      address,
      assignedDoctor,
      centerCode,
      centerId
    } = req.body;
    
    console.log('🔍 Request body:', { name, gender, age, contact, email, address, assignedDoctor, centerCode, centerId });

    // For receptionists, we'll be more flexible with centerId
    // If they have a centerId, use it; otherwise, try to get it from the request body
    let patientCenterId = req.user.centerId;
    console.log('🔍 Initial patientCenterId from user:', patientCenterId);
    
    if (!patientCenterId) {
      console.log('🔍 User has no centerId, trying alternatives...');
      // If user doesn't have centerId, try to get it from request body
      if (centerId) {
        patientCenterId = centerId;
        console.log('🔍 Using centerId from request body:', patientCenterId);
      } else if (centerCode) {
        console.log('🔍 Trying to find center by code:', centerCode);
        // Try to find center by code if centerId is not provided
        try {
          const Center = (await import('../models/Center.js')).default;
          const center = await Center.findOne({ code: centerCode });
          if (center) {
            patientCenterId = center._id;
            console.log('🔍 Found center by code:', center._id);
          } else {
            console.log('❌ No center found with code:', centerCode);
          }
        } catch (centerError) {
          console.error('❌ Error finding center by code:', centerError);
        }
      }
    }
    
    console.log('🔍 Final patientCenterId:', patientCenterId);
    
    if (!patientCenterId) {
      console.log('❌ No centerId available, returning error');
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

    const patientData = {
      name,
      gender,
      age,
      phone: contact,
      email,
      address,
      centerId: patientCenterId,
      assignedDoctor,
      centerCode,
      registeredBy: req.user._id
    };

    console.log('🔍 Creating patient with data:', patientData);
    const newPatient = new Patient(patientData);
    const savedPatient = await newPatient.save();
    
    console.log('✅ Patient created successfully:', savedPatient._id);
    res.status(201).json({ message: "Patient created successfully", patient: savedPatient });
  } catch (error) {
    console.error("❌ Create patient error:", error);
    res.status(500).json({ message: "Failed to create patient", error: error.message });
  }
};

const getPatients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    
    let query = { centerId: req.user.centerId };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const patients = await Patient.find(query)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

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

const getPatientById = async (req, res) => {
  try {
    console.log('🔍 getPatientById called with ID:', req.params.id);
    
    const patient = await Patient.findById(req.params.id)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name');
    
    if (!patient) {
      console.log('❌ Patient not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    console.log('✅ Patient found:', {
      id: patient._id,
      name: patient.name,
      centerId: patient.centerId?._id,
      centerName: patient.centerId?.name
    });
    
    // Return the expected structure that the frontend expects
    const response = {
      patient,
      history: [],
      medications: [],
      tests: []
    };
    
    console.log('📤 Sending response structure:', Object.keys(response));
    res.json(response);
  } catch (err) {
    console.error('❌ Error in getPatientById:', err);
    res.status(500).json({ message: 'Failed to fetch patient', error: err.message });
  }
};

const updatePatient = async (req, res) => {
  try {
    console.log('🔍 updatePatient called by user:', {
      role: req.user?.role,
      userId: req.user?._id,
      userName: req.user?.name,
      userCenterId: req.user?.centerId
    });
    
    console.log('🔍 updatePatient request body:', req.body);
    console.log('🔍 updatePatient patient ID:', req.params.id);
    
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
    if (assignedDoctor) patient.assignedDoctor = assignedDoctor;
    if (centerCode) patient.centerCode = centerCode;

    await patient.save();
    
    console.log('✅ Patient updated successfully by:', req.user?.role);
    res.json({ message: 'Patient updated successfully', patient });
  } catch (err) {
    console.error('❌ Update patient error:', err);
    res.status(500).json({ message: 'Failed to update patient', error: err.message });
  }
};

const deletePatient = async (req, res) => {
  try {
    console.log('🔍 deletePatient called by user:', {
      role: req.user?.role,
      userId: req.user?._id,
      userName: req.user?.name,
      userCenterId: req.user?.centerId
    });
    
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    await patient.deleteOne();
    
    console.log('✅ Patient deleted successfully by:', req.user?.role);
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

    const newTest = {
      testType,
      testDate: new Date(testDate),
      results,
      status: status || 'pending'
    };

    patient.tests.push(newTest);
    await patient.save();

    res.status(201).json({ message: 'Test added successfully', test: newTest });
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
    console.log('getPatientAndTests called with patient ID:', req.params.id);
    
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      console.log('Patient not found with ID:', req.params.id);
      return res.status(404).json({ message: "Patient not found" });
    }

    console.log('Patient found:', patient._id);

    // First try to get tests from Test collection
    let tests = [];
    try {
      tests = await Test.find({ patient: patient._id });
      console.log('Found tests from Test collection:', tests.length);
    } catch (error) {
      console.log('No tests found in Test collection, checking embedded tests');
    }

    // If no tests in Test collection, use embedded tests from patient
    if (tests.length === 0 && patient.tests && patient.tests.length > 0) {
      tests = patient.tests;
      console.log('Using embedded tests from patient:', tests.length);
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
      .populate('assignedDoctor', 'name');
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
      .populate('assignedDoctor', 'name')
      .select('name age gender phone email address centerId assignedDoctor');
    
    res.json(patients);
  } catch (err) {
    console.error('Get patients by doctor error:', err);
    res.status(500).json({ message: 'Failed to fetch patients by doctor', error: err.message });
  }
};

// Get patient history
const getPatientHistory = async (req, res) => {
  try {
    console.log('🔍 getPatientHistory called with ID:', req.params.id);
    const { id } = req.params;
    
    // First verify patient exists
    const patient = await Patient.findById(id);
    if (!patient) {
      console.log('❌ Patient not found with ID:', id);
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Import History model
    const History = (await import('../models/historyModel.js')).default;
    
    // Get comprehensive history records from standalone History model
    // Try multiple patientId formats to ensure we find the data
    let histories = await History.find({ patientId: id }).sort({ createdAt: -1 });
    
    // If no results, try with ObjectId
    if (histories.length === 0) {
      console.log('No histories found with string patientId, trying ObjectId...');
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(id)) {
        histories = await History.find({ 
          patientId: new mongoose.Types.ObjectId(id) 
        }).sort({ createdAt: -1 });
      }
    }
    
    console.log('✅ Found standalone history records:', histories.length);
    console.log('History records:', histories.map(h => ({ 
      id: h._id, 
      patientId: h.patientId, 
      hayFever: h.hayFever,
      asthma: h.asthma,
      createdAt: h.createdAt 
    })));
    
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
    console.log('🔍 getPatientMedications called with ID:', req.params.id);
    const { id } = req.params;
    const patient = await Patient.findById(id);

    if (!patient) {
      console.log('❌ Patient not found with ID:', id);
      return res.status(404).json({ message: 'Patient not found' });
    }

    console.log('✅ Patient found, medications:', patient.medications);
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
    console.log('🧪 Test endpoint called');
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
    console.log('🔍 addSampleData called with ID:', req.params.id);
    const { id } = req.params;
    const patient = await Patient.findById(id);

    if (!patient) {
      console.log('❌ Patient not found with ID:', id);
      return res.status(404).json({ message: 'Patient not found' });
    }

    console.log('✅ Patient found, current data:', {
      history: patient.history,
      medications: patient.medications,
      followUps: patient.followUps
    });

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
      console.log('✅ Added sample history');
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
      console.log('✅ Added sample medications');
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
      console.log('✅ Added sample follow-ups');
    }

    await patient.save();
    console.log('✅ Patient saved with new data');
    res.json({ message: 'Sample data added successfully', patient });
  } catch (error) {
    console.error('❌ Add sample data error:', error);
    res.status(500).json({ message: 'Failed to add sample data' });
  }
};

// ✅ Named exports (required for ESM import)
export {
  addPatient,
  getPatients,
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
  testEndpoint
};
