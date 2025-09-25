import express from 'express';
import { 
  generateReassignedPatientInvoice,
  createReassignedConsultationFeeBilling,
  createReassignedServiceChargesBilling
} from '../controllers/reassignedInvoiceController.js';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(ensureCenterIsolation);

// Generate invoice for reassigned patients only
router.post('/generate-invoice', generateReassignedPatientInvoice);

// Create consultation fee billing for reassigned patients only
router.post('/consultation-fee', createReassignedConsultationFeeBilling);

// Create service charges billing for reassigned patients only
router.post('/service-charges', createReassignedServiceChargesBilling);

export default router;
