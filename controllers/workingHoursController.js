import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { checkWorkingHoursViolation, getWorkingHoursStatus } from '../utils/workingHours.js';

/**
 * Check and update patients with working hours violations
 */
export const checkWorkingHoursViolations = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    
    // Find all patients assigned today who haven't been viewed
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const patients = await Patient.find({
      centerId,
      assignedAt: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      viewedByDoctor: false,
      workingHoursViolation: { $ne: true } // Exclude already flagged patients
    }).populate('assignedDoctor', 'name email');
    
    const violations = [];
    const updates = [];
    
    for (const patient of patients) {
      const violation = checkWorkingHoursViolation(patient);
      
      if (violation.hasViolation) {
        violations.push({
          patientId: patient._id,
          patientName: patient.name,
          uhId: patient.uhId,
          assignedDoctor: patient.assignedDoctor?.name,
          assignedAt: patient.assignedAt,
          violationTime: violation.violationTime,
          reason: violation.reason
        });
        
        // Mark patient for update
        updates.push({
          updateOne: {
            filter: { _id: patient._id },
            update: {
              $set: {
                workingHoursViolation: true,
                violationDate: violation.violationTime,
                requiresReassignment: true,
                reassignmentReason: 'Working hours violation - not viewed within 7 AM to 8 PM',
                appointmentStatus: 'working_hours_violation'
              }
            }
          }
        });
      }
    }
    
    // Bulk update patients with violations
    if (updates.length > 0) {
      await Patient.bulkWrite(updates);
    }
    
    res.json({
      success: true,
      message: `Checked ${patients.length} patients, found ${violations.length} violations`,
      violations,
      workingHoursStatus: getWorkingHoursStatus()
    });
    
  } catch (error) {
    console.error('Error checking working hours violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check working hours violations',
      error: error.message
    });
  }
};

/**
 * Get working hours status
 */
export const getWorkingHoursInfo = async (req, res) => {
  try {
    const status = getWorkingHoursStatus();
    
    // Get count of patients requiring reassignment due to working hours violation
    const centerId = req.user.centerId;
    const violationCount = await Patient.countDocuments({
      centerId,
      workingHoursViolation: true,
      requiresReassignment: true
    });
    
    res.json({
      success: true,
      workingHours: status,
      violationCount
    });
    
  } catch (error) {
    console.error('Error getting working hours info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get working hours info',
      error: error.message
    });
  }
};

/**
 * Reassign patient with custom consultation date (no billing)
 */
export const reassignWithCustomDate = async (req, res) => {
  try {
    const { patientId, newDoctorId, nextConsultationDate, reason, notes } = req.body;
    const centerId = req.user.centerId;
    
    if (!patientId || !newDoctorId || !nextConsultationDate) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID, new doctor ID, and next consultation date are required'
      });
    }
    
    // Find the patient
    const patient = await Patient.findOne({
      _id: patientId,
      centerId,
      workingHoursViolation: true,
      requiresReassignment: true
    }).populate('assignedDoctor', 'name');
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or not eligible for working hours reassignment'
      });
    }
    
    // Find the new doctor
    const newDoctor = await User.findOne({
      _id: newDoctorId,
      role: 'doctor',
      centerId
    });
    
    if (!newDoctor) {
      return res.status(404).json({
        success: false,
        message: 'New doctor not found'
      });
    }
    
    // Update patient with new assignment and custom date
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          assignedDoctor: newDoctorId,
          currentDoctor: newDoctorId,
          nextConsultationDate: new Date(nextConsultationDate),
          workingHoursViolation: false,
          requiresReassignment: false,
          appointmentStatus: 'scheduled',
          viewedByDoctor: false,
          reassignedAt: new Date()
        },
        $push: {
          reassignmentHistory: {
            previousDoctor: patient.assignedDoctor._id,
            previousDoctorName: patient.assignedDoctor.name,
            newDoctor: newDoctorId,
            newDoctorName: newDoctor.name,
            reassignedAt: new Date(),
            reassignedBy: req.user.name || 'System',
            reason: reason || 'Working hours violation reassignment',
            notes: notes || 'Reassigned due to working hours violation with custom consultation date'
          }
        }
      },
      { new: true }
    ).populate('assignedDoctor', 'name email')
     .populate('currentDoctor', 'name email');
    
    res.json({
      success: true,
      message: 'Patient reassigned successfully with custom consultation date',
      patient: updatedPatient
    });
    
  } catch (error) {
    console.error('Error reassigning patient with custom date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign patient',
      error: error.message
    });
  }
};
