import express from 'express';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(ensureCenterIsolation);

// Reassign patient to a new doctor
router.post('/reassign', async (req, res) => {
  try {
    console.log('🔄 Patient reassignment request received:', req.body);
    console.log('🔄 Request headers:', req.headers);
    console.log('🔄 User from middleware:', req.user);
    
    const { patientId, newDoctorId, reason, notes, reassignedBy, reassignedAt } = req.body;

    // Validate required fields
    if (!patientId || !newDoctorId || !reason) {
      console.log('❌ Validation failed - missing required fields:', { patientId, newDoctorId, reason });
      return res.status(400).json({
        success: false,
        message: 'Patient ID, new doctor ID, and reason are required'
      });
    }

    console.log('✅ Validation passed, proceeding with reassignment...');

    // Find the patient
    console.log('🔍 Looking for patient with ID:', patientId);
    const patient = await Patient.findById(patientId);
    if (!patient) {
      console.log('❌ Patient not found with ID:', patientId);
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    console.log('✅ Patient found:', patient.name);

    // Find the new doctor
    console.log('🔍 Looking for doctor with ID:', newDoctorId);
    const newDoctor = await User.findById(newDoctorId);
    if (!newDoctor) {
      console.log('❌ Doctor not found with ID:', newDoctorId);
      return res.status(404).json({
        success: false,
        message: 'New doctor not found'
      });
    }
    console.log('✅ Doctor found:', newDoctor.name);

    // Store the previous doctor information
    const previousDoctor = patient.assignedDoctor;
    const previousDoctorName = previousDoctor?.name || 'Not Assigned';

    // Update the patient with reassignment information (DO NOT change assignedDoctor)
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        // Keep assignedDoctor unchanged - this is the ORIGINAL doctor
        // Only update currentDoctor for reassigned patients
        currentDoctor: newDoctorId,
        isReassigned: true,
        // Clear reassigned billing when reassigning to a new doctor
        reassignedBilling: [],
        reassignmentHistory: [
          ...(patient.reassignmentHistory || []),
          {
            previousDoctor: previousDoctor,
            previousDoctorName: previousDoctorName,
            newDoctor: newDoctorId,
            newDoctorName: newDoctor.name,
            reason: reason,
            notes: notes || '',
            reassignedBy: reassignedBy,
            reassignedAt: reassignedAt || new Date(),
            createdAt: new Date()
          }
        ],
        lastReassignedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    ).populate('assignedDoctor currentDoctor');

    console.log('✅ Patient reassigned successfully:', {
      patientId: updatedPatient._id,
      patientName: updatedPatient.name,
      originalDoctor: previousDoctorName,
      currentDoctor: newDoctor.name,
      reason: reason
    });

    res.status(200).json({
      success: true,
      message: 'Patient reassigned successfully',
      data: {
        patient: updatedPatient,
        originalDoctor: previousDoctorName,
        currentDoctor: newDoctor.name,
        reassignmentInfo: {
          reason: reason,
          notes: notes,
          reassignedBy: reassignedBy,
          reassignedAt: reassignedAt || new Date()
        }
      }
    });

  } catch (error) {
    console.error('❌ Error reassigning patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign patient',
      error: error.message
    });
  }
});

// Get reassignment history for a patient
router.get('/reassignment-history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findById(patientId).populate('assignedDoctor currentDoctor');
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        patient: {
          _id: patient._id,
          name: patient.name,
          uhId: patient.uhId,
          originalDoctor: patient.assignedDoctor,
          currentDoctor: patient.currentDoctor,
          isReassigned: patient.isReassigned
        },
        reassignmentHistory: patient.reassignmentHistory || [],
        lastReassignedAt: patient.lastReassignedAt
      }
    });

  } catch (error) {
    console.error('❌ Error fetching reassignment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reassignment history',
      error: error.message
    });
  }
});

// Get all patients with reassignment history
router.get('/reassigned-patients', async (req, res) => {
  try {
    const patients = await Patient.find({
      reassignmentHistory: { $exists: true, $not: { $size: 0 } }
    })
    .populate('assignedDoctor currentDoctor')
    .sort({ lastReassignedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        patients: patients.map(patient => ({
          _id: patient._id,
          name: patient.name,
          uhId: patient.uhId,
          originalDoctor: patient.assignedDoctor,
          currentDoctor: patient.currentDoctor,
          isReassigned: patient.isReassigned,
          reassignmentHistory: patient.reassignmentHistory,
          lastReassignedAt: patient.lastReassignedAt
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching reassigned patients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reassigned patients',
      error: error.message
    });
  }
});

// Get reassignment statistics
router.get('/reassignment-stats', async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const patientsWithDoctors = await Patient.countDocuments({ assignedDoctor: { $exists: true, $ne: null } });
    const patientsWithoutDoctors = await Patient.countDocuments({ assignedDoctor: { $exists: false } });
    const reassignedPatients = await Patient.countDocuments({
      reassignmentHistory: { $exists: true, $not: { $size: 0 } }
    });

    // Get recent reassignments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReassignments = await Patient.countDocuments({
      lastReassignedAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        patientsWithDoctors,
        patientsWithoutDoctors,
        reassignedPatients,
        recentReassignments
      }
    });

  } catch (error) {
    console.error('❌ Error fetching reassignment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reassignment statistics',
      error: error.message
    });
  }
});

export default router;
