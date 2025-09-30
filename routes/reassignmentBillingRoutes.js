import express from 'express';
import ReassignmentBillingController from '../controllers/reassignmentBillingController.js';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(ensureCenterIsolation);

/**
 * @route POST /api/billing/create-invoice
 * @desc Create invoice for reassigned patient
 * @access Private (Receptionist)
 */
router.post('/create-invoice', ReassignmentBillingController.createInvoice);

/**
 * @route POST /api/billing/process-payment
 * @desc Process payment for reassigned patient
 * @access Private (Receptionist)
 */
router.post('/process-payment', ReassignmentBillingController.processPayment);

/**
 * @route POST /api/billing/cancel-bill
 * @desc Cancel bill for reassigned patient
 * @access Private (Receptionist)
 */
router.post('/cancel-bill', ReassignmentBillingController.cancelBill);

/**
 * @route POST /api/billing/process-refund
 * @desc Process refund for reassigned patient
 * @access Private (Receptionist)
 */
router.post('/process-refund', ReassignmentBillingController.processRefund);

/**
 * @route GET /api/billing/reassignment-status/:patientId
 * @desc Get billing status for reassigned patient
 * @access Private (Receptionist)
 */
router.get('/reassignment-status/:patientId', ReassignmentBillingController.getBillingStatus);

export default router;
