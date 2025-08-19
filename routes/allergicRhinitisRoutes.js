import express from 'express';
import { createAllergicRhinitis, getAllergicRhinitisByPatient, getAllergicRhinitisById } from '../controllers/allergicRhinitisController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createAllergicRhinitis);
router.get('/', protect, getAllergicRhinitisByPatient);
router.get('/:id', getAllergicRhinitisById);

export default router; 