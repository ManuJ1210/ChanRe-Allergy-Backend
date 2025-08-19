import express from 'express';
import { createAllergicConjunctivitis, getAllergicConjunctivitisByPatient, getAllergicConjunctivitisById } from '../controllers/allergicConjunctivitisController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createAllergicConjunctivitis);
router.get('/', protect, getAllergicConjunctivitisByPatient);
router.get('/:id', protect, getAllergicConjunctivitisById);

export default router; 