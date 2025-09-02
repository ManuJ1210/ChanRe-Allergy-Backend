import express from 'express';
import {
  getDoctorNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getTestRequestFeedback,
  getDoctorTestRequestsWithFeedback
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get doctor's notifications
router.get('/doctor', getDoctorNotifications);

// Mark notification as read
router.patch('/:notificationId/read', markNotificationAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', markAllNotificationsAsRead);

// Delete a single notification
router.delete('/:notificationId', deleteNotification);

// Delete all notifications for the user
router.delete('/all', deleteAllNotifications);

// Get feedback for a specific test request
router.get('/test-request/:testRequestId/feedback', getTestRequestFeedback);

// Get all test requests with feedback for a doctor
router.get('/doctor/test-requests-with-feedback', getDoctorTestRequestsWithFeedback);

export default router;
