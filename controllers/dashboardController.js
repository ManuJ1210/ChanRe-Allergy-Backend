import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Center from '../models/Center.js';
import TestRequest from '../models/TestRequest.js';

// Get Super Admin Dashboard Stats
export const getSuperAdminStats = async (req, res) => {
  try {
    const [totalCenters, totalAdmins, totalPatients, totalTests] = await Promise.all([
      Center.countDocuments(),
      User.countDocuments({ role: 'centeradmin' }),
      Patient.countDocuments(),
      TestRequest.countDocuments()
    ]);

    res.json({
      totalCenters,
      totalAdmins,
      totalPatients,
      totalTests
    });
  } catch (error) {
    console.error('Error fetching super admin stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
};

// Get Center Admin Dashboard Stats
export const getCenterAdminStats = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    
    if (!centerId) {
      return res.status(400).json({ message: 'Center ID not found' });
    }

    // Get patient IDs for this center
    const patientIds = await Patient.find({ centerId }).select('_id');
    const patientIdArray = patientIds.map(p => p._id);
    
    const [totalPatients, totalDoctors, totalReceptionists, totalTests] = await Promise.all([
      Patient.countDocuments({ centerId }),
      User.countDocuments({ centerId, role: 'doctor' }),
      User.countDocuments({ centerId, role: 'receptionist' }),
      TestRequest.countDocuments({ patientId: { $in: patientIdArray } })
    ]);

    res.json({
      totalPatients,
      totalDoctors,
      totalReceptionists,
      totalTests
    });
  } catch (error) {
    console.error('Error fetching center admin stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
};

// Get Doctor Dashboard Stats
export const getDoctorStats = async (req, res) => {
  try {
    const doctorId = req.user._id;
    
    // Get patients assigned to this doctor
    const assignedPatients = await Patient.find({ assignedDoctor: doctorId });
    const totalPatients = assignedPatients.length;
    
    // Count test requests for assigned patients
    const patientIds = assignedPatients.map(p => p._id);
    const [pendingTests, completedTests] = await Promise.all([
      TestRequest.countDocuments({ 
        patientId: { $in: patientIds },
        status: { $in: ['Pending', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing'] }
      }),
      TestRequest.countDocuments({ 
        patientId: { $in: patientIds },
        status: { $in: ['Completed', 'Report_Generated', 'Report_Sent', 'feedback_sent'] }
      })
    ]);

    res.json({
      totalPatients,
      pendingTests,
      completedTests
    });
  } catch (error) {
    console.error('Error fetching doctor stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
};

// Get Receptionist Dashboard Stats
export const getReceptionistStats = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    if (!centerId) {
      return res.status(400).json({ message: 'Center ID is required' });
    }

    const patientIds = await Patient.find({ centerId }).distinct('_id');
    
    const [totalPatients, pendingTests, completedTests] = await Promise.all([
      Patient.countDocuments({ centerId }),
      TestRequest.countDocuments({
        patientId: { $in: patientIds },
        status: { $in: ['Pending', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing'] }
      }),
      TestRequest.countDocuments({
        patientId: { $in: patientIds },
        status: { $in: ['Completed', 'Report_Generated', 'Report_Sent', 'feedback_sent'] }
      })
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPatients = await Patient.countDocuments({ 
      centerId, 
      createdAt: { $gte: today } 
    });

    res.json({ totalPatients, todayPatients, pendingTests, completedTests });
  } catch (error) {
    console.error('Error fetching receptionist stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
};

// Get Lab Staff Dashboard Stats
export const getLabStats = async (req, res) => {
  try {
    const [totalRequests, pendingRequests, completedRequests, urgentRequests] = await Promise.all([
      TestRequest.countDocuments(),
      TestRequest.countDocuments({
        status: { $in: ['Pending', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing'] }
      }),
      TestRequest.countDocuments({
        status: { $in: ['Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'] }
      }),
      TestRequest.countDocuments({
        priority: 'urgent',
        status: { $in: ['Pending', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing'] }
      })
    ]);

    res.json({
      totalRequests,
      pendingRequests,
      completedRequests,
      urgentRequests
    });
  } catch (error) {
    console.error('Error fetching lab stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
}; 