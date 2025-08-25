import express from 'express';
import {
  getAllLabStaff,
  getLabStaffById,
  createLabStaff,
  updateLabStaff,
  deleteLabStaff,
  getLabStaffByLabId
} from '../controllers/labStaffController.js';

const router = express.Router();

// Get all lab staff
router.get('/', getAllLabStaff);

// Get lab staff by ID
router.get('/:id', getLabStaffById);

// Create new lab staff
router.post('/', createLabStaff);

// Update lab staff
router.put('/:id', updateLabStaff);

// Delete lab staff
router.delete('/:id', deleteLabStaff);

// Get lab staff by lab ID
router.get('/lab/:labId', getLabStaffByLabId);

export default router; 