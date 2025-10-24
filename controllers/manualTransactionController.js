import TransactionService from '../services/transactionService.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

/**
 * Manual transaction controller for testing and backfilling missing transactions
 */
class ManualTransactionController {
  
  /**
   * Create a consultation transaction manually
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createConsultationTransaction(req, res) {
    try {
      console.log('🚀 Creating manual consultation transaction:', req.body);
      
      const {
        patientId,
        doctorId,
        centerId,
        amount,
        paymentMethod = 'cash',
        invoiceNumber,
        notes = 'Manual transaction creation'
      } = req.body;

      // Validate required fields
      if (!patientId || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID and amount are required'
        });
      }

      // Find patient
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      const transactionData = {
        patientId: patientId,
        doctorId: doctorId || patient.assignedDoctor?._id || patient.assignedDoctor,
        centerId: centerId || patient.centerId,
        consultationType: 'OP',
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        paymentType: 'full',
        invoiceNumber: invoiceNumber || `INV-${Date.now()}-${patient._id.toString().slice(-6)}`,
        paymentBreakdown: {
          registrationFee: 0,
          consultationFee: parseFloat(amount),
          serviceCharges: [],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        notes: notes
      };

      const transaction = await TransactionService.createConsultationTransaction(transactionData, req.user);

      res.status(201).json({
        success: true,
        message: 'Manual consultation transaction created successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error creating manual consultation transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create manual consultation transaction',
        error: error.message
      });
    }
  }

  /**
   * Create a receipt transaction manually
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createReceiptTransaction(req, res) {
    try {
      console.log('🚀 Creating manual receipt transaction:', req.body);
      
      const {
        testRequestId,
        patientId,
        centerId,
        amount,
        paymentMethod = 'cash',
        receiptNumber,
        invoiceNumber,
        notes = 'Manual transaction creation'
      } = req.body;

      // Validate required fields
      if (!testRequestId || !patientId || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Test Request ID, Patient ID, and amount are required'
        });
      }

      const transactionData = {
        testRequestId: testRequestId,
        patientId: patientId,
        centerId: centerId,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        paymentType: 'full',
        receiptNumber: receiptNumber || `REC-${Date.now()}-${patientId.slice(-6)}`,
        invoiceNumber: invoiceNumber || `INV-${Date.now()}-${patientId.slice(-6)}`,
        paymentBreakdown: {
          items: [{ name: 'Test Payment', amount: parseFloat(amount), quantity: 1 }],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        notes: notes
      };

      const transaction = await TransactionService.createReceiptTransaction(transactionData, req.user);

      res.status(201).json({
        success: true,
        message: 'Manual receipt transaction created successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error creating manual receipt transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create manual receipt transaction',
        error: error.message
      });
    }
  }

  /**
   * Create a reassignment transaction manually
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createReassignmentTransaction(req, res) {
    try {
      console.log('🚀 Creating manual reassignment transaction:', req.body);
      
      const {
        patientId,
        assignedDoctorId,
        currentDoctorId,
        centerId,
        amount,
        paymentMethod = 'cash',
        reassignmentReason = 'Manual reassignment',
        invoiceNumber,
        notes = 'Manual transaction creation'
      } = req.body;

      // Validate required fields
      if (!patientId || !assignedDoctorId || !currentDoctorId || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID, assigned doctor ID, current doctor ID, and amount are required'
        });
      }

      const transactionData = {
        patientId: patientId,
        assignedDoctorId: assignedDoctorId,
        currentDoctorId: currentDoctorId,
        centerId: centerId,
        reassignmentType: 'regular',
        consultationType: 'OP',
        reassignmentReason: reassignmentReason,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        paymentType: 'full',
        invoiceNumber: invoiceNumber || `INV-${Date.now()}-${patientId.slice(-6)}`,
        paymentBreakdown: {
          consultationFee: parseFloat(amount),
          serviceCharges: [],
          subtotal: parseFloat(amount),
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: parseFloat(amount)
        },
        isEligibleForFreeReassignment: false,
        notes: notes
      };

      const transaction = await TransactionService.createReassignmentTransaction(transactionData, req.user);

      res.status(201).json({
        success: true,
        message: 'Manual reassignment transaction created successfully',
        transaction
      });

    } catch (error) {
      console.error('❌ Error creating manual reassignment transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create manual reassignment transaction',
        error: error.message
      });
    }
  }

  /**
   * Get all transactions for a specific patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPatientTransactions(req, res) {
    try {
      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID is required'
        });
      }

      // Get transactions from all collections
      const filters = { patientId: patientId };
      const result = await TransactionService.getAllTransactions(filters, { page: 1, limit: 100 });

      res.json({
        success: true,
        patientId: patientId,
        transactions: result.transactions,
        total: result.pagination.total
      });

    } catch (error) {
      console.error('❌ Error fetching patient transactions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch patient transactions',
        error: error.message
      });
    }
  }
}

export default ManualTransactionController;
