import User from '../models/User.js';
import Patient from '../models/Patient.js';
import TestRequest from '../models/TestRequest.js';
import History from '../models/historyModel.js';
import AllergicRhinitis from '../models/AllergicRhinitis.js';
import AllergicConjunctivitis from '../models/AllergicConjunctivitis.js';
import AllergicBronchitis from '../models/AllergicBronchitis.js';
import AtopicDermatitis from '../models/AtopicDermatitis.js';
import GPE from '../models/GPE.js';
import Prescription from '../models/Prescription.js';
import Medication from '../models/Medication.js';
import Test from '../models/Test.js';

export const getAllDoctors = async (req, res) => {
  try {
    const { centerId } = req.query;
    
    let query = { 
      role: 'doctor',
      $or: [
        { isSuperAdminStaff: { $exists: false } }, // No isSuperAdminStaff field
        { isSuperAdminStaff: false }, // Or explicitly set to false
        { isSuperAdminStaff: { $ne: true } } // Or not true
      ]
    };

    // For superadmin users, allow filtering by centerId query parameter
    if (req.user.role === 'superadmin' && centerId) {
      query.centerId = centerId;
    } else if (req.user.role !== 'superadmin') {
      // For other users, use their assigned centerId
      query.centerId = req.user.centerId;
    }

    // Handle status filtering
    if (req.query.status !== undefined && req.query.status !== '') {
      if (req.query.status === 'true') {
        query.isDeleted = true;
      } else if (req.query.status === 'false') {
        query.isDeleted = { $ne: true };
      }
    }

    // Handle search functionality
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$and = [
        {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { username: searchRegex }
          ]
        },
        {
          $or: [
            { isSuperAdminStaff: { $exists: false } }, // No isSuperAdminStaff field
            { isSuperAdminStaff: false }, // Or explicitly set to false
            { isSuperAdminStaff: { $ne: true } } // Or not true
          ]
        }
      ];
      // Remove the original $or since we're now using $and
      delete query.$or;
    }
    
    console.log('🔍 getAllDoctors - User info:', {
      userId: req.user._id,
      userRole: req.user.role,
      userCenterId: req.user.centerId,
      userCenterIdType: typeof req.user.centerId
    });
    
    // Superadmin can see all doctors (except superadmin staff)
    if (req.user.role === 'superadmin') {
      console.log('🔍 Superadmin - showing all doctors (excluding superadmin staff)');
    } else {
      // Center admin and other users can only see doctors from their center
      if (req.user.centerId) {
        query.centerId = req.user.centerId;
        console.log('🔍 Filtering by centerId:', req.user.centerId);
      } else {
        console.log('❌ User has no centerId, cannot fetch doctors');
        return res.status(403).json({ message: 'Access denied. Center-specific access required.' });
      }
    }

    const doctors = await User.find(query).select('-password');
    
    console.log('🔍 Found doctors:', doctors.length);
    if (doctors.length > 0) {
      console.log('🔍 Sample doctor data:', {
        doctorId: doctors[0]._id,
        doctorName: doctors[0].name,
        doctorRole: doctors[0].role,
        doctorCenterId: doctors[0].centerId,
        doctorCenterIdType: typeof doctors[0].centerId
      });
    }
    
    res.json(doctors);
  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
    res.status(500).json({ message: 'Failed to fetch doctors' });
  }
};

export const addDoctor = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      mobile,
      role,
      username,
      centerId,
      status,
      ...otherFields
    } = req.body;

    if (!name || !email || !password || !username) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already in use' });
    }

    let doctorCenterId;
    if (req.user.role !== 'superadmin') {
      doctorCenterId = req.user.centerId;
    } else {
      doctorCenterId = centerId;
    }

    const doctor = new User({
      name,
      email,
      password,
      phone: phone || mobile,
      mobile,
      role: role || 'doctor',
      username,
      centerId: doctorCenterId,
      status: status || 'active',
      ...otherFields // Include other fields like qualification, designation, etc.
    });

    await doctor.save();
    
    console.log(`✅ Doctor added successfully`);
    res.status(201).json({ message: 'Doctor added successfully', doctor });
  } catch (err) {
    console.error('❌ Error adding doctor:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const deleteDoctor = async (req, res) => {
  try {
    const doctor = await User.findById(req.params.id);

    console.log('🔍 deleteDoctor - Request info:', {
      doctorId: req.params.id,
      userId: req.user._id,
      userRole: req.user.role,
      userCenterId: req.user.centerId,
      userCenterIdType: typeof req.user.centerId
    });

    if (!doctor) {
      console.log('❌ Doctor not found');
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if it's a superadmin staff consultant (should not be deleted through this endpoint)
    if (doctor.isSuperAdminStaff) {
      console.log('❌ Cannot delete superadmin staff consultant through this endpoint');
      return res.status(403).json({ message: 'Access denied. You can only delete regular doctors.' });
    }

    console.log('🔍 Doctor found:', {
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorRole: doctor.role,
      doctorCenterId: doctor.centerId,
      doctorCenterIdType: typeof doctor.centerId
    });

    // Allow superadmin to delete any doctor (except superadmin staff)
    if (req.user.role === 'superadmin') {
      await doctor.deleteOne();
      console.log(`✅ Doctor deleted successfully by superadmin`);
      return res.status(200).json({ message: 'Doctor deleted successfully' });
    }

    // Allow center admin to delete doctors from their center only (except superadmin staff)
    if (req.user.role === 'centeradmin') {
      if (doctor.centerId?.toString() !== req.user.centerId?.toString()) {
        return res.status(403).json({ message: 'Access denied. You can only delete doctors from your own center.' });
      }
      await doctor.deleteOne();
      console.log(`✅ Doctor deleted successfully by center admin`);
      return res.status(200).json({ message: 'Doctor deleted successfully' });
    }

    // Allow regular doctors to delete themselves (if needed)
    if (req.user.role === 'doctor' && req.user._id.toString() === doctor._id.toString()) {
      await doctor.deleteOne();
      console.log(`✅ Doctor deleted themselves`);
      return res.status(200).json({ message: 'Doctor deleted successfully' });
    }

    console.log('❌ Access denied - User cannot delete this doctor');
    return res.status(403).json({ message: 'Access denied. You can only delete doctors from your own center.' });
  } catch (error) {
    console.error('❌ Error deleting doctor:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    let doctor;
    
    // Superadmin can view any doctor (except superadmin staff)
    if (req.user.role === 'superadmin') {
      doctor = await User.findOne({ 
        _id: req.params.id,
        role: 'doctor', // Only get doctors
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      }).select('-password');
    } else {
      // Center admin and other users can only view doctors from their center
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      doctor = await User.findOne({ 
        _id: req.params.id,
        role: 'doctor', // Only get doctors
        centerId: req.user.centerId,
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      }).select('-password');
    }
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found or access denied' });
    }

    res.json(doctor);
  } catch (error) {
    console.error('❌ Error fetching doctor:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    let doctor;
    
    // Superadmin can update any doctor (except superadmin staff)
    if (req.user.role === 'superadmin') {
      doctor = await User.findOne({ 
        _id: req.params.id,
        role: 'doctor', // Only update doctors
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
      }
    } else {
      // Center admin and other users can only update doctors from their center
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      doctor = await User.findOne({ 
        _id: req.params.id,
        role: 'doctor', // Only update doctors
        centerId: req.user.centerId,
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found or access denied' });
      }
    }

    const {
      name,
      email,
      phone,
      mobile,
      username,
      status,
      qualification,
      designation,
      kmcNumber,
      specializations,
      experience,
      bio,
      hospitalName,
      isDeleted
    } = req.body;

    if (name) doctor.name = name;
    if (email) doctor.email = email;
    if (phone) doctor.phone = phone;
    if (mobile) doctor.mobile = mobile;
    if (username) doctor.username = username;
    if (status) doctor.status = status;
    if (qualification) doctor.qualification = qualification;
    if (designation) doctor.designation = designation;
    if (kmcNumber) doctor.kmcNumber = kmcNumber;
    if (specializations) doctor.specializations = specializations;
    if (experience) doctor.experience = experience;
    if (bio) doctor.bio = bio;
    if (hospitalName) doctor.hospitalName = hospitalName;
    if (isDeleted !== undefined) doctor.isDeleted = isDeleted;

    await doctor.save();
    
    console.log(`✅ Doctor updated successfully`);
    res.status(200).json({ message: 'Doctor updated successfully', doctor });
  } catch (error) {
    console.error('❌ Error updating doctor:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ New: Get Patients Assigned to Doctor
export const getAssignedPatients = async (req, res) => {
  try {
    const doctorId = req.user._id;
    console.log('🔍 Fetching patients for doctor:', doctorId);
    console.log('🔍 User centerId:', req.user.centerId);
    console.log('🔍 User role:', req.user.role);
    console.log('🔍 User type:', req.user.userType);
    
    // Basic validation
    if (!req.user.centerId) {
      console.log('❌ User has no centerId');
      return res.status(400).json({ 
        message: 'User not assigned to a center',
        debug: {
          userId: req.user._id,
          userRole: req.user.role,
          userType: req.user.userType,
          hasCenterId: !!req.user.centerId
        }
      });
    }
    
    // Ensure doctor can only see patients from their center
    // Include both currently assigned patients AND previously assigned patients (reassigned patients)
    const patients = await Patient.find({ 
      $or: [
        { assignedDoctor: doctorId }, // Currently assigned patients
        { 
          reassignmentHistory: { 
            $elemMatch: { 
              previousDoctor: doctorId 
            } 
          } 
        } // Previously assigned patients (reassigned)
      ],
      centerId: req.user.centerId // Only patients from same center
    })
      .populate({
        path: 'centerId',
        select: 'name code',
        model: 'Center'
      })
      .populate({
        path: 'assignedDoctor',
        select: 'name email',
        model: 'User'
      })
      .populate({
        path: 'currentDoctor',
        select: 'name email',
        model: 'User'
      })
      .select('-tests'); // Exclude tests array for performance

    console.log(`📋 Found ${patients.length} patients for doctor in center: ${req.user.centerId}`);
    console.log('🔍 Patient types breakdown:', {
      total: patients.length,
      currentlyAssigned: patients.filter(p => p.assignedDoctor?._id?.toString() === doctorId.toString()).length,
      reassigned: patients.filter(p => p.reassignmentHistory?.some(r => r.previousDoctor?.toString() === doctorId.toString())).length
    });
    
    // ✅ NEW: Check billing status for each patient
    const patientsWithBillingStatus = await Promise.all(
      patients.map(async (patient) => {
        try {
          // Check if patient has any test requests with pending billing
          const pendingBillingTestRequest = await TestRequest.findOne({
            patientId: patient._id,
            status: { $in: ['Billing_Pending', 'Billing_Generated'] },
            'billing.status': { $in: ['generated', 'payment_received'] } // Include payment_received status
          }).select('status billing.status billing.amount');

          const patientObj = patient.toObject();
          
          if (pendingBillingTestRequest) {
            patientObj.billingStatus = 'pending';
            patientObj.pendingTestRequest = {
              status: pendingBillingTestRequest.status,
              billingStatus: pendingBillingTestRequest.billing?.status || 'not_generated',
              amount: pendingBillingTestRequest.billing?.amount || 0
            };
          } else {
            patientObj.billingStatus = 'clear';
            patientObj.pendingTestRequest = null;
          }

          return patientObj;
        } catch (patientError) {
          console.error(`❌ Error processing patient ${patient._id}:`, patientError);
          // Return patient without billing status if there's an error
          const patientObj = patient.toObject();
          patientObj.billingStatus = 'error';
          patientObj.pendingTestRequest = null;
          return patientObj;
        }
      })
    );

    // Log sample patient data for debugging
    if (patientsWithBillingStatus.length > 0) {
      console.log('🏥 Sample patient data with billing status:', {
        patientId: patientsWithBillingStatus[0]._id,
        centerId: patientsWithBillingStatus[0].centerId,
        centerName: patientsWithBillingStatus[0].centerId?.name,
        centerCode: patientsWithBillingStatus[0].centerId?.code,
        billingStatus: patientsWithBillingStatus[0].billingStatus,
        pendingTestRequest: patientsWithBillingStatus[0].pendingTestRequest
      });
    }

    res.status(200).json(patientsWithBillingStatus);
  } catch (error) {
    console.error('❌ Error fetching assigned patients:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ New: Get Single Patient Details for Doctor
export const getPatientDetails = async (req, res) => {
  try {
    const { patientId } = req.params;
    console.log('Backend getPatientDetails: received patientId:', patientId, typeof patientId);
    const doctorId = req.user._id;

    // Verify the patient is assigned to this doctor AND belongs to same center
    const patient = await Patient.findOne({ 
      _id: patientId, 
      assignedDoctor: doctorId,
      centerId: req.user.centerId // Only patients from same center
    }).populate('centerId', 'name code')
      .populate('assignedDoctor', 'name email');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or not assigned to you' });
    }

    // Get patient history - try both ObjectId and string formats
    console.log('Doctor fetching history for patient:', patient._id, 'Type:', typeof patient._id);
    let histories = await History.find({ patientId: patient._id }).sort({ createdAt: -1 });
    console.log('Histories found with ObjectId:', histories.length);
    
    // If not found with ObjectId, try with string
    if (histories.length === 0) {
      histories = await History.find({ patientId: patient._id.toString() }).sort({ createdAt: -1 });
      console.log('Histories found with string:', histories.length);
    }
    
    // If still not found, try with the original patientId from params
    if (histories.length === 0) {
      histories = await History.find({ patientId: patientId }).sort({ createdAt: -1 });
      console.log('Histories found with original patientId:', histories.length);
    }
    
    // Get patient medications
    const medications = await Medication.find({ patientId: patient._id });
    
    // Get patient tests
    const tests = await Test.find({ patient: patient._id }).sort({ date: -1 });
    console.log('✅ Found tests for patient:', tests.length);
    console.log('Test records:', tests.map(t => ({ 
      id: t._id, 
      patient: t.patient, 
      CBC: t.CBC,
      Hb: t.Hb,
      date: t.date,
      createdAt: t.createdAt 
    })));

    const response = {
      patient,
      history: histories,
      medications,
      tests
    };
    
    console.log('📤 Doctor getPatientDetails response structure:', {
      patient: !!response.patient,
      historyCount: response.history?.length || 0,
      medicationsCount: response.medications?.length || 0,
      testsCount: response.tests?.length || 0
    });
    
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error fetching patient details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ New: Add Test Request by Doctor
export const addTestRequest = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user._id;
    const { testType, notes, priority } = req.body;

    // Verify the patient is assigned to this doctor AND belongs to same center
    const patient = await Patient.findOne({ 
      _id: patientId, 
      assignedDoctor: doctorId,
      centerId: req.user.centerId // Only patients from same center
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or not assigned to you' });
    }

    // Create test request
    const testRequest = new Test({
      patient: patientId,
      testType,
      notes,
      priority: priority || 'normal',
      requestedBy: doctorId,
      status: 'pending',
      date: new Date()
    });

    await testRequest.save();

    console.log(`✅ Test request added successfully for patient in center: ${req.user.centerId}`);
    res.status(201).json({ 
      message: 'Test request added successfully', 
      testRequest 
    });
  } catch (error) {
    console.error('❌ Error adding test request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ New: Get Test Requests by Doctor
export const getTestRequests = async (req, res) => {
  console.log('🚀 getTestRequests function started');
  console.log('📋 Request details:', {
    method: req.method,
    url: req.url,
    user: req.user ? { id: req.user._id, role: req.user.role } : 'No user'
  });
  
  try {
    if (!req.user || !req.user._id) {
      console.log('❌ No user found in request');
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const doctorId = req.user._id;
    console.log('🔍 getTestRequests called for doctor:', doctorId);
    console.log('🔍 TestRequest model available:', !!TestRequest);
    
    // Simple test without complex query first
    console.log('🔍 Testing simple TestRequest.find()...');
    const simpleTest = await TestRequest.find({}).limit(1);
    console.log('🔍 Simple test result:', simpleTest.length);
    
    // Find all test requests created by this doctor
    console.log('🔍 Performing main query...');
    const testRequests = await TestRequest.find({ 
      doctorId: doctorId,
      isActive: true 
    })
      .populate('patientId', 'name phone address')
      .populate('assignedLabStaffId', 'staffName')
      .populate('reportGeneratedBy', 'staffName')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${testRequests.length} test requests for doctor ${doctorId}`);
    
    res.status(200).json(testRequests);
  } catch (error) {
    console.error('❌ Error in getTestRequests:', error.message);
    console.error('❌ Full error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    res.status(500).json({ message: 'Failed to fetch test requests', error: error.message });
  }
};

// ✅ New: Get Doctor Stats for Center Admin
// @route   GET /api/doctors/stats
// @desc    Get doctor statistics for center admin
// @access  Private (Center Admin)
export const getDoctorStats = async (req, res) => {
  try {
    let query = { 
      role: 'doctor',
      centerId: { $exists: true, $ne: null } // Only doctors with centerId (center-specific)
    };

    // If user is not superadmin, filter by their center
    if (req.user.role !== 'superadmin') {
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      query.centerId = req.user.centerId;
    }

    // Get total doctors
    const total = await User.countDocuments(query);

    // Get active doctors (not deleted)
    const active = await User.countDocuments({ ...query, isDeleted: { $ne: true } });

    // Get inactive doctors (deleted)
    const inactive = await User.countDocuments({ ...query, isDeleted: true });

    const stats = {
      total,
      active,
      inactive
    };

    console.log(`📊 Doctor stats for center: ${req.user.centerId || 'all centers'}`);
    res.status(200).json(stats);
  } catch (error) {
    console.error('❌ Error fetching doctor stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};