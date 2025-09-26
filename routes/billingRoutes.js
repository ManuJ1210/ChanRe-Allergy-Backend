import express from 'express';
import { protect, ensureCenterIsolation, checkSuperAdmin } from '../middleware/authMiddleware.js';
import uploadReceipt from '../middleware/receiptUploadMiddleware.js';
import {
  generateBillForTestRequest,
  markBillPaidForTestRequest,
  getBillingInfo,
  getAllBillingData,
  getBillingDataForCenter,
  cancelBill,
  getBillingStats,
  getBillingReports,
  getCenterBillingReports,
  testBillingData,
  fixCenterData,
  validateCenterData,
  createConsultationFeeBilling,
  createRegistrationFeeBilling,
  createServiceChargesBilling,
  generatePatientInvoice,
  updateMissingInvoiceNumbers,
  updateBillDetails,
  updatePaymentStatus,
  recordPatientPayment,
  recordPartialPayment
} from '../controllers/billingController.js';
import { generateInvoicePDF } from '../controllers/invoiceController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Create consultation fee billing (Receptionist action)
router.post('/consultation-fee', ensureCenterIsolation, createConsultationFeeBilling);

// Create registration fee billing (for new patients only)
router.post('/registration-fee', ensureCenterIsolation, createRegistrationFeeBilling);

// Create service charges billing
router.post('/service-charges', ensureCenterIsolation, createServiceChargesBilling);

// Generate patient invoice
router.post('/generate-invoice', ensureCenterIsolation, generatePatientInvoice);

// Record payment for patients (NEW WORKFLOW)
router.post('/record-payment', ensureCenterIsolation, recordPatientPayment);

// Record partial payment for patients (NEW WORKFLOW)
router.post('/record-partial-payment', ensureCenterIsolation, recordPartialPayment);

// Update missing invoice numbers for existing billing records
router.post('/update-missing-invoice-numbers', checkSuperAdmin, updateMissingInvoiceNumbers);

// Generate bill for a test request (Receptionist action)
router.put('/test-requests/:id/generate', ensureCenterIsolation, generateBillForTestRequest);

// Mark bill as paid (Receptionist action) - with file upload support
router.put('/test-requests/:id/mark-paid', ensureCenterIsolation, uploadReceipt.single('receiptFile'), markBillPaidForTestRequest);

// Update bill details (Center Admin action)
router.put('/test-requests/:id/update-bill', ensureCenterIsolation, updateBillDetails);

// Update payment status (Center Admin action)
router.put('/test-requests/:id/update-payment', ensureCenterIsolation, updatePaymentStatus);

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

// Get billing statistics for superadmin
router.get('/stats', checkSuperAdmin, getBillingStats);

// Test billing data endpoint
router.get('/test-data', checkSuperAdmin, testBillingData);

// Fix center data inconsistencies in billing records
router.post('/fix-center-data', checkSuperAdmin, fixCenterData);

// Validate center data consistency
router.get('/validate-center-data', checkSuperAdmin, validateCenterData);

// Get billing reports for superadmin (daily, weekly, monthly, yearly)
router.get('/reports', checkSuperAdmin, getBillingReports);

// Get billing reports for center admin
router.get('/center/reports', ensureCenterIsolation, getCenterBillingReports);

// Download invoice PDF (alternative route for frontend compatibility) - must be last
router.get('/:billingId/download-invoice', checkSuperAdmin, generateInvoicePDF);

export default router;

