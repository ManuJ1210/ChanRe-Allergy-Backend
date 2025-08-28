import express from 'express';
import { protect, ensureCenterIsolation, checkSuperAdmin } from '../middleware/authMiddleware.js';
import { pdfAuth } from '../middleware/pdfAuthMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import {
  getAllTestRequests,
  getPendingTestRequests,
  getCompletedTestRequests,
  getTestRequestsByDoctor,
  getTestRequestsForCurrentDoctor,
  getCompletedTestRequestsForCurrentDoctor,
  getTestRequestsByCenter,
  getTestRequestsByLabStaff,
  getTestRequestsForCurrentLabStaff,
  getTestRequestsByPatient,
  getTestRequestById,
  createTestRequest,
  assignLabStaff,
  scheduleSampleCollection,
  updateSampleCollectionStatus,
  startLabTesting,
  completeLabTesting,
  generateTestReport,
  sendReportToDoctor,
  updateTestRequestStatus,
  cancelTestRequest,
  deleteTestRequest,
  getTestRequestStats,
  downloadTestReport,
  checkReportStatus,
  getAllBillingData,
  getBillingDataForCenter
} from '../controllers/testRequestController.js';
import {
  getBillingRequestsForCurrentReceptionist,
  generateBillForTestRequest,
  markBillPaidForTestRequest,
  verifyPaymentAndApproveForLab
} from '../controllers/testRequestController.js';

const router = express.Router();

// Get all test requests (for superadmin)
router.get('/', protect, getAllTestRequests);

// Get pending test requests
router.get('/pending', protect, getPendingTestRequests);

// Get completed test requests
router.get('/completed', protect, getCompletedTestRequests);

// Get test request statistics
router.get('/stats', protect, getTestRequestStats);

// Get test requests for current doctor (authenticated)
router.get('/doctor', protect, ensureCenterIsolation, getTestRequestsForCurrentDoctor);

// Get completed test requests for current doctor (authenticated)
router.get('/doctor/completed', protect, ensureCenterIsolation, getCompletedTestRequestsForCurrentDoctor);

// Get test requests for current lab staff (authenticated)
router.get('/lab-staff', protect, ensureCenterIsolation, getTestRequestsForCurrentLabStaff);

// Get test requests by doctor
router.get('/doctor/:doctorId', protect, getTestRequestsByDoctor);

// Get test requests by center
router.get('/center/:centerId', protect, getTestRequestsByCenter);

// Get test requests by patient
router.get('/patient/:patientId', protect, getTestRequestsByPatient);

// Get test requests by lab staff
router.get('/lab-staff/:labStaffId', protect, getTestRequestsByLabStaff);

// Check if report is available for download
router.get('/report-status/:id', protect, checkReportStatus);

// Download test report (PDF) - Use regular protect middleware instead of pdfAuth
router.get('/download-report/:id', protect, downloadTestReport);

// Get test request by ID
router.get('/:id', protect, getTestRequestById);

// Receptionist billing endpoints (moved to end to avoid route conflicts)
router.get('/billing/mine', protect, ensureCenterIsolation, getBillingRequestsForCurrentReceptionist);
router.put('/:id/billing/generate', protect, ensureCenterIsolation, generateBillForTestRequest);
router.put('/:id/billing/paid', protect, ensureCenterIsolation, markBillPaidForTestRequest);

// Center admin payment verification endpoint
router.put('/:id/billing/verify', protect, ensureCenterIsolation, verifyPaymentAndApproveForLab);

// Create new test request
router.post('/', protect, ensureCenterIsolation, createTestRequest);

// Assign lab staff to test request
router.put('/:id/assign', protect, assignLabStaff);

// Schedule sample collection
router.put('/:id/schedule-collection', protect, scheduleSampleCollection);

// Update sample collection status
router.put('/:id/collection-status', protect, updateSampleCollectionStatus);

// Start lab testing
router.put('/:id/start-testing', protect, startLabTesting);

// Complete lab testing
router.put('/:id/complete-testing', protect, completeLabTesting);

// Generate test report (PDF)
router.put('/:id/generate-report', protect, generateTestReport);

// Send report to doctor
router.put('/:id/send-report', protect, sendReportToDoctor);

// Update test request status
router.put('/:id/status', protect, updateTestRequestStatus);

// Cancel test request
router.put('/:id/cancel', protect, cancelTestRequest);

// Delete test request
router.delete('/:id', protect, deleteTestRequest);

// ✅ NEW: Billing data endpoints for superadmin and center admin
router.get('/billing/all', protect, checkSuperAdmin, getAllBillingData);
router.get('/billing/center/:centerId', protect, ensureCenterIsolation, getBillingDataForCenter);

export default router;