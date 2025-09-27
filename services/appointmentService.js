import Patient from '../models/Patient.js';
import User from '../models/User.js';

// Check for missed appointments and auto-reassign after 24 hours
export const checkMissedAppointments = async () => {
  try {
    console.log('🔍 Checking for missed appointments...');
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Find patients with missed appointments that haven't been reassigned yet
    const missedAppointments = await Patient.find({
      appointmentStatus: 'missed',
      missedAt: { $lte: twentyFourHoursAgo },
      appointmentStatus: { $ne: 'reassigned' }
    }).populate('assignedDoctor currentDoctor');
    
    console.log(`📋 Found ${missedAppointments.length} missed appointments to process`);
    
    for (const patient of missedAppointments) {
      try {
        // Get available doctors (excluding the current assigned doctor)
        const availableDoctors = await User.find({
          role: 'doctor',
          status: 'active',
          _id: { $ne: patient.assignedDoctor?._id }
        }).limit(5);
        
        if (availableDoctors.length === 0) {
          console.log(`⚠️ No available doctors for patient ${patient.name}`);
          continue;
        }
        
        // Select a random available doctor
        const newDoctor = availableDoctors[Math.floor(Math.random() * availableDoctors.length)];
        
        // Update patient with new doctor assignment
        patient.currentDoctor = newDoctor._id;
        patient.appointmentStatus = 'reassigned';
        patient.reassignedAt = new Date();
        
        // Add to reassignment history
        if (!patient.reassignmentHistory) {
          patient.reassignmentHistory = [];
        }
        
        patient.reassignmentHistory.push({
          previousDoctor: patient.assignedDoctor?._id,
          previousDoctorName: patient.assignedDoctor?.name,
          newDoctor: newDoctor._id,
          newDoctorName: newDoctor.name,
          reason: 'Missed appointment - Auto reassignment after 24 hours',
          reassignedBy: 'System - Auto Reassignment',
          reassignedAt: new Date(),
          notes: 'Patient missed appointment and was automatically reassigned after 24 hours'
        });
        
        // Mark as reassigned
        patient.isReassigned = true;
        
        await patient.save();
        
        console.log(`✅ Patient ${patient.name} reassigned from ${patient.assignedDoctor?.name} to ${newDoctor.name} due to missed appointment`);
        
      } catch (error) {
        console.error(`❌ Error processing missed appointment for patient ${patient.name}:`, error);
      }
    }
    
    console.log('✅ Missed appointment check completed');
    return { processed: missedAppointments.length };
    
  } catch (error) {
    console.error('❌ Error in checkMissedAppointments:', error);
    throw error;
  }
};

// Mark appointment as viewed by doctor
export const markAppointmentViewed = async (patientId, doctorId) => {
  try {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Update appointment status
    patient.appointmentStatus = 'viewed';
    patient.lastVisitDate = new Date();
    patient.visitCount = (patient.visitCount || 0) + 1;
    
    await patient.save();
    
    console.log(`✅ Appointment marked as viewed for patient ${patient.name} by doctor ${doctorId}`);
    return { success: true, message: 'Appointment marked as viewed' };
    
  } catch (error) {
    console.error('❌ Error marking appointment as viewed:', error);
    throw error;
  }
};

// Mark appointment as missed
export const markAppointmentMissed = async (patientId, reason = 'Patient did not show up') => {
  try {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Update appointment status
    patient.appointmentStatus = 'missed';
    patient.missedAt = new Date();
    patient.appointmentNotes = reason;
    
    await patient.save();
    
    console.log(`⚠️ Appointment marked as missed for patient ${patient.name}: ${reason}`);
    return { success: true, message: 'Appointment marked as missed' };
    
  } catch (error) {
    console.error('❌ Error marking appointment as missed:', error);
    throw error;
  }
};

// Get appointment statistics
export const getAppointmentStats = async () => {
  try {
    const stats = await Patient.aggregate([
      {
        $group: {
          _id: '$appointmentStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      scheduled: 0,
      viewed: 0,
      missed: 0,
      reassigned: 0
    };
    
    stats.forEach(stat => {
      result[stat._id] = stat.count;
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Error getting appointment stats:', error);
    throw error;
  }
};
