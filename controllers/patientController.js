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
      centerId
    } = req.body;

    const patientCenterId = req.user.centerId;
    if (!patientCenterId) {
      return res.status(400).json({ message: "Center ID is required." });
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

    const newPatient = new Patient(patientData);
    const savedPatient = await newPatient.save();
    
    res.status(201).json({ message: "Patient created successfully", patient: savedPatient });
  } catch (error) {
    console.error("Create patient error:", error);
    res.status(500).json({ message: "Failed to create patient" });
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
    const patient = await Patient.findById(req.params.id)
      .populate('centerId', 'name code')
      .populate('assignedDoctor', 'name');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    res.json(patient);
  } catch (err) {
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
    if (contact) patient.phone = contact;
    if (email) patient.email = email;
    if (address) patient.address = address;
    if (assignedDoctor) patient.assignedDoctor = assignedDoctor;
    if (centerCode) patient.centerCode = centerCode;

    await patient.save();
    
    res.json({ message: 'Patient updated successfully', patient });
  } catch (err) {
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
  getPatientsByDoctor
};
