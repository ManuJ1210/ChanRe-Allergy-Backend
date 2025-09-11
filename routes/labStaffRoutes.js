import express from 'express';
import {
  getAllLabStaff,
  getLabStaffById,
  createLabStaff,
  updateLabStaff,
  deleteLabStaff,
  getLabStaffByLabId
} from '../controllers/labStaffController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all lab staff
router.get('/', protect, getAllLabStaff);

// Get lab staff by ID
router.get('/:id', protect, getLabStaffById);

// Create new lab staff
router.post('/', protect, createLabStaff);

// Update lab staff
router.put('/:id', protect, updateLabStaff);

// Delete lab staff
router.delete('/:id', protect, deleteLabStaff);

// Get lab staff by lab ID
router.get('/lab/:labId', protect, getLabStaffByLabId);

export default router; 