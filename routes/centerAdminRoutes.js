import express from 'express';
import {
  getAllCenterAdmins,
  getCenterAdminById,
  updateCenterAdmin,
  deleteCenterAdmin,
  createCenterAdmin
} from '../controllers/centerAdminController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ Existing route
router.get('/', protect, getAllCenterAdmins);

// ✅ New routes
router.get('/:id', protect, getCenterAdminById);
router.put('/:id', protect, updateCenterAdmin);
router.delete('/:id', protect, deleteCenterAdmin);
router.post('/', protect, createCenterAdmin);

export default router;
