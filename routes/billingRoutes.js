import express from 'express';
import { protect, ensureCenterIsolation, checkSuperAdmin } from '../middleware/authMiddleware.js';
import uploadReceipt from '../middleware/receiptUploadMiddleware.js';
import {
  generateBillForTestRequest,
  markBillPaidForTestRequest,
  getBillingInfo,
  getAllBillingData,
  getBillingDataForCenter,
  cancelBill
} from '../controllers/billingController.js';
import { generateInvoicePDF } from '../controllers/invoiceController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Generate bill for a test request (Receptionist action)
router.put('/test-requests/:id/generate', ensureCenterIsolation, generateBillForTestRequest);

// Mark bill as paid (Receptionist action) - with file upload support
router.put('/test-requests/:id/mark-paid', ensureCenterIsolation, uploadReceipt.single('receiptFile'), markBillPaidForTestRequest);

// Get billing information for a test request
router.get('/test-requests/:id/billing', ensureCenterIsolation, getBillingInfo);

// Cancel a bill (Receptionist action)
router.put('/test-requests/:id/cancel', ensureCenterIsolation, cancelBill);

// Download invoice PDF
router.get('/test-requests/:id/invoice', ensureCenterIsolation, generateInvoicePDF);

// Get billing data for a specific center (Center Admin/Receptionist)
router.get('/center', ensureCenterIsolation, getBillingDataForCenter);

// Get all billing data for superadmin (across all centers)
router.get('/all', checkSuperAdmin, getAllBillingData);

// Download invoice PDF (alternative route for frontend compatibility) - must be last
router.get('/:billingId/download-invoice', checkSuperAdmin, generateInvoicePDF);

export default router;

