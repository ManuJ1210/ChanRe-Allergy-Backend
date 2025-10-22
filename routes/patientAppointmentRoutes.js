import express from 'express';
import {
  getAllCentersForBooking,
  getNearbyCenters,
  bookAppointment,
  getAppointmentByCode,
  cancelAppointment,
  approveAppointment,
  getCenterAppointments,
  updateAppointmentStatus,
  updateAppointmentDetails,
  searchAppointmentsByPatientName
} from '../controllers/patientAppointmentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/centers', getAllCentersForBooking);
router.get('/centers/nearby', getNearbyCenters);
router.post('/book', bookAppointment);
router.get('/confirmation/:confirmationCode', getAppointmentByCode);
router.post('/cancel/:confirmationCode', cancelAppointment);
router.post('/approve/:confirmationCode', approveAppointment);

// Protected routes (require authentication)
router.get('/center/:centerId', protect, getCenterAppointments);
router.get('/search', protect, searchAppointmentsByPatientName);
router.put('/:appointmentId/status', protect, updateAppointmentStatus);
router.put('/:appointmentId/details', protect, updateAppointmentDetails);

export default router;
