import express from 'express';
import { createAllergicBronchitis, getAllergicBronchitisByPatient, getAllergicBronchitisById } from '../controllers/allergicBronchitisController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createAllergicBronchitis);
router.get('/', protect, getAllergicBronchitisByPatient);
router.get('/:id', protect, getAllergicBronchitisById);

export default router; 