import express from 'express';
import {
  createReceptionist,
  getAllReceptionists,
  deleteReceptionist,
  getReceptionistById,
  updateReceptionist,
  getReceptionistStats
} from '../controllers/receptionistController.js';
import { protect, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply center isolation middleware to all routes
router.use(protect);
router.use(ensureCenterIsolation);

// Get receptionist stats
router.get('/stats', getReceptionistStats);
// Create receptionist
router.post('/', createReceptionist);
// Get all receptionists
router.get('/', getAllReceptionists);
// Get single receptionist by ID
router.get('/:id', getReceptionistById);
// Update receptionist by ID
router.put('/:id', updateReceptionist);
// Delete receptionist by ID
router.delete('/:id', deleteReceptionist);

export default router; 