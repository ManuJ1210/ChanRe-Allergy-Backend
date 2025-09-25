import ReassignedPatientService from '../services/reassignedPatientService.js';
import Patient from '../models/Patient.js';

/**
 * Controller for handling reassigned patient operations
 */
class ReassignedPatientController {
  
  /**
   * Get reassigned patients for a specific doctor
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReassignedPatientsForDoctor(req, res) {
    try {
      const { doctorId } = req.params;
      
      if (!doctorId) {
        return res.status(400).json({
          success: false,
          message: 'Doctor ID is required'
        });
      }
      
      const reassignedPatients = await ReassignedPatientService.getReassignedPatientsForDoctor(doctorId);
      
      res.status(200).json({
        success: true,
        data: reassignedPatients,
        count: reassignedPatients.length
      });
      
    } catch (error) {
      console.error('Error getting reassigned patients for doctor:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting reassigned patients',
        error: error.message
      });
    }
  }
  
  /**
   * Analyze patient reassignment status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async analyzePatientReassignment(req, res) {
    try {
      const { patientId, doctorId } = req.params;
      
      if (!patientId || !doctorId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID and Doctor ID are required'
        });
      }
      
      const patient = await Patient.findById(patientId).populate('billing');
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }
      
      const analysis = await ReassignedPatientService.analyzePatientReassignment(patient, doctorId);
      
      res.status(200).json({
        success: true,
        data: analysis
      });
      
    } catch (error) {
      console.error('Error analyzing patient reassignment:', error);
      res.status(500).json({
        success: false,
        message: 'Error analyzing patient reassignment',
        error: error.message
      });
    }
  }
  
  /**
   * Get billing status for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getReassignedPatientBillingStatus(req, res) {
    try {
      const { patientId, doctorId } = req.params;
      
      if (!patientId || !doctorId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID and Doctor ID are required'
        });
      }
      
      const patient = await Patient.findById(patientId).populate('billing');
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }
      
      const billingStatus = await ReassignedPatientService.getReassignedPatientBillingStatus(patient, doctorId);
      
      res.status(200).json({
        success: true,
        data: billingStatus
      });
      
    } catch (error) {
      console.error('Error getting reassigned patient billing status:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting reassigned patient billing status',
        error: error.message
      });
    }
  }
  
  /**
   * Create consultation fee for reassigned patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createConsultationFeeForReassignedPatient(req, res) {
    try {
      const { patientId, doctorId } = req.params;
      const { amount, paymentMethod } = req.body;
      
      if (!patientId || !doctorId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID and Doctor ID are required'
        });
      }
      
      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount is required'
        });
      }
      
      const consultationFee = await ReassignedPatientService.createConsultationFeeForReassignedPatient(
        patientId,
        doctorId,
        amount,
        paymentMethod || 'cash'
      );
      
      res.status(201).json({
        success: true,
        message: 'Consultation fee created successfully for reassigned patient',
        data: consultationFee
      });
      
    } catch (error) {
      console.error('Error creating consultation fee for reassigned patient:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating consultation fee for reassigned patient',
        error: error.message
      });
    }
  }
  
  /**
   * Get all patients with reassignment analysis
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllPatientsWithReassignmentAnalysis(req, res) {
    try {
      const { doctorId } = req.query;
      
      let query = {};
      if (doctorId) {
        query.assignedDoctor = doctorId;
      }
      
      const patients = await Patient.find(query)
        .populate('assignedDoctor', 'name email')
        .populate('billing');
      
      const patientsWithAnalysis = [];
      
      for (const patient of patients) {
        const currentDoctorId = patient.assignedDoctor?._id || patient.assignedDoctor;
        const analysis = await ReassignedPatientService.analyzePatientReassignment(patient, currentDoctorId);
        
        patientsWithAnalysis.push({
          ...patient.toObject(),
          reassignmentAnalysis: analysis
        });
      }
      
      res.status(200).json({
        success: true,
        data: patientsWithAnalysis,
        count: patientsWithAnalysis.length
      });
      
    } catch (error) {
      console.error('Error getting all patients with reassignment analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting patients with reassignment analysis',
        error: error.message
      });
    }
  }
}

export default ReassignedPatientController;
