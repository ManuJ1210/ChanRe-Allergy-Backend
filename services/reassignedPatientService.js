import Patient from '../models/Patient.js';

/**
 * Service to handle reassigned patient logic
 */
class ReassignedPatientService {
  
  /**
   * Check if a patient is reassigned based on billing history
   * @param {Object} patient - Patient object with billing records
   * @param {String} currentDoctorId - Current assigned doctor ID
   * @returns {Object} - Reassignment analysis
   */
  static async analyzePatientReassignment(patient, currentDoctorId) {
    try {
      const billingRecords = patient.billing || [];
      
      // Check if patient has billing records for different doctors
      const hasBillingForDifferentDoctor = billingRecords.some(bill => {
        const hasDoctorId = bill.doctorId && bill.doctorId.toString();
        return hasDoctorId && bill.doctorId.toString() !== currentDoctorId?.toString();
      });
      
      // Check if patient has multiple consultation fees
      const consultationFees = billingRecords.filter(bill => 
        bill.type === 'consultation' || bill.description?.toLowerCase().includes('consultation')
      );
      const hasMultipleConsultationFees = consultationFees.length > 1;
      
      // Check if patient has consultation fee for current doctor
      const hasConsultationForCurrentDoctor = consultationFees.some(fee => {
        const hasDoctorId = fee.doctorId && fee.doctorId.toString();
        return hasDoctorId && fee.doctorId.toString() === currentDoctorId?.toString();
      });
      
      // Check if patient has service charges for current doctor
      const serviceCharges = billingRecords.filter(bill => bill.type === 'service');
      const hasServiceChargesForCurrentDoctor = serviceCharges.some(charge => {
        const hasDoctorId = charge.doctorId && charge.doctorId.toString();
        return hasDoctorId && charge.doctorId.toString() === currentDoctorId?.toString();
      });
      
      const isReassigned = hasBillingForDifferentDoctor || hasMultipleConsultationFees;
      
      return {
        isReassigned,
        hasBillingForDifferentDoctor,
        hasMultipleConsultationFees,
        hasConsultationForCurrentDoctor,
        hasServiceChargesForCurrentDoctor,
        consultationFeesCount: consultationFees.length,
        totalBillingRecords: billingRecords.length,
        currentDoctorId,
        previousDoctors: this.getPreviousDoctors(billingRecords, currentDoctorId)
      };
      
    } catch (error) {
      console.error('Error analyzing patient reassignment:', error);
      return {
        isReassigned: false,
        hasBillingForDifferentDoctor: false,
        hasMultipleConsultationFees: false,
        hasConsultationForCurrentDoctor: false,
        hasServiceChargesForCurrentDoctor: false,
        consultationFeesCount: 0,
        totalBillingRecords: 0,
        currentDoctorId,
        previousDoctors: [],
        error: error.message
      };
    }
  }
  
  /**
   * Get list of previous doctors from billing records
   * @param {Array} billingRecords - Array of billing records
   * @param {String} currentDoctorId - Current doctor ID to exclude
   * @returns {Array} - Array of previous doctor IDs
   */
  static getPreviousDoctors(billingRecords, currentDoctorId) {
    const doctorIds = new Set();
    
    billingRecords.forEach(bill => {
      if (bill.doctorId && bill.doctorId.toString() !== currentDoctorId?.toString()) {
        doctorIds.add(bill.doctorId.toString());
      }
    });
    
    return Array.from(doctorIds);
  }
  
  /**
   * Get billing status for reassigned patient
   * @param {Object} patient - Patient object
   * @param {String} currentDoctorId - Current assigned doctor ID
   * @returns {Object} - Billing status analysis
   */
  static async getReassignedPatientBillingStatus(patient, currentDoctorId) {
    try {
      const reassignmentAnalysis = await this.analyzePatientReassignment(patient, currentDoctorId);
      
      if (!reassignmentAnalysis.isReassigned) {
        return {
          needsConsultationFee: !reassignmentAnalysis.hasConsultationForCurrentDoctor,
          needsRegistrationFee: false, // Reassigned patients don't need registration fee
          needsServiceCharges: false, // Will be determined based on test requests
          status: reassignmentAnalysis.hasConsultationForCurrentDoctor ? 'All Fees Paid' : 'Consultation Fee Required',
          isReassigned: false
        };
      }
      
      // For reassigned patients, check if they have consultation fee for current doctor
      const needsConsultationFee = !reassignmentAnalysis.hasConsultationForCurrentDoctor;
      
      // Reassigned patients don't need registration fee
      const needsRegistrationFee = false;
      
      // Service charges will be determined based on test requests
      const needsServiceCharges = false;
      
      let status = 'All Fees Paid';
      if (needsConsultationFee) {
        status = 'Consultation Fee Required';
      }
      
      return {
        needsConsultationFee,
        needsRegistrationFee,
        needsServiceCharges,
        status,
        isReassigned: true,
        reassignmentAnalysis
      };
      
    } catch (error) {
      console.error('Error getting reassigned patient billing status:', error);
      return {
        needsConsultationFee: true,
        needsRegistrationFee: false,
        needsServiceCharges: false,
        status: 'Consultation Fee Required',
        isReassigned: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create consultation fee for reassigned patient
   * @param {String} patientId - Patient ID
   * @param {String} doctorId - Doctor ID
   * @param {Number} amount - Consultation fee amount
   * @param {String} paymentMethod - Payment method
   * @returns {Object} - Created billing record
   */
  static async createConsultationFeeForReassignedPatient(patientId, doctorId, amount, paymentMethod = 'cash') {
    try {
      const consultationFee = {
        type: 'consultation',
        description: `Doctor consultation fee for reassigned patient`,
        amount,
        paymentMethod,
        status: 'paid',
        doctorId: doctorId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Update patient's billing records by adding the new consultation fee
      const updatedPatient = await Patient.findByIdAndUpdate(
        patientId,
        { $push: { billing: consultationFee } },
        { new: true }
      );
      
      return updatedPatient.billing[updatedPatient.billing.length - 1]; // Return the last added billing record
      
    } catch (error) {
      console.error('Error creating consultation fee for reassigned patient:', error);
      throw error;
    }
  }
  
  /**
   * Get reassigned patients for a specific doctor
   * @param {String} doctorId - Doctor ID
   * @returns {Array} - Array of reassigned patients
   */
  static async getReassignedPatientsForDoctor(doctorId) {
    try {
      const patients = await Patient.find({ assignedDoctor: doctorId })
        .populate('assignedDoctor', 'name email')
        .populate('billing');
      
      const reassignedPatients = [];
      
      for (const patient of patients) {
        const analysis = await this.analyzePatientReassignment(patient, doctorId);
        if (analysis.isReassigned) {
          reassignedPatients.push({
            ...patient.toObject(),
            reassignmentAnalysis: analysis
          });
        }
      }
      
      return reassignedPatients;
      
    } catch (error) {
      console.error('Error getting reassigned patients for doctor:', error);
      throw error;
    }
  }
  
  /**
   * Mark patient as reassigned in localStorage (frontend helper)
   * @param {String} patientId - Patient ID
   * @param {Object} reassignmentInfo - Reassignment information
   */
  static markPatientAsReassigned(patientId, reassignmentInfo) {
    const reassignmentKey = `reassigned_${patientId}`;
    localStorage.setItem(reassignmentKey, JSON.stringify({
      reassigned: true,
      patientId,
      timestamp: new Date().toISOString(),
      ...reassignmentInfo
    }));
  }
  
  /**
   * Check if patient is marked as reassigned in localStorage (frontend helper)
   * @param {String} patientId - Patient ID
   * @returns {Object|null} - Reassignment info or null
   */
  static getPatientReassignmentInfo(patientId) {
    const reassignmentKey = `reassigned_${patientId}`;
    const info = localStorage.getItem(reassignmentKey);
    
    if (info) {
      try {
        return JSON.parse(info);
      } catch (error) {
        console.error('Error parsing reassignment info:', error);
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Clear reassignment marker for patient (frontend helper)
   * @param {String} patientId - Patient ID
   */
  static clearPatientReassignmentMarker(patientId) {
    const reassignmentKey = `reassigned_${patientId}`;
    localStorage.removeItem(reassignmentKey);
  }
}

export default ReassignedPatientService;
