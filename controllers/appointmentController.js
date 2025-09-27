import { 
  markAppointmentViewed, 
  markAppointmentMissed, 
  getAppointmentStats,
  checkMissedAppointments 
} from '../services/appointmentService.js';

// Mark appointment as viewed by doctor
export const markViewed = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId } = req.body;
    
    if (!patientId || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and Doctor ID are required'
      });
    }
    
    const result = await markAppointmentViewed(patientId, doctorId);
    
    res.json({
      success: true,
      message: 'Appointment marked as viewed',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error in markViewed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark appointment as viewed',
      error: error.message
    });
  }
};

// Mark appointment as missed
export const markMissed = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }
    
    const result = await markAppointmentMissed(patientId, reason);
    
    res.json({
      success: true,
      message: 'Appointment marked as missed',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error in markMissed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark appointment as missed',
      error: error.message
    });
  }
};

// Get appointment statistics
export const getStats = async (req, res) => {
  try {
    const stats = await getAppointmentStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error in getStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointment statistics',
      error: error.message
    });
  }
};

// Check for missed appointments (admin endpoint)
export const checkMissed = async (req, res) => {
  try {
    const result = await checkMissedAppointments();
    
    res.json({
      success: true,
      message: 'Missed appointment check completed',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error in checkMissed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check missed appointments',
      error: error.message
    });
  }
};
