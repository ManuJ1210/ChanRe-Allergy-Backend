import express from 'express';
import { createPrescription, getPrescriptionsByPatient, getPrescriptionById, deletePrescription } from '../controllers/prescriptionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createPrescription);
router.get('/', protect, getPrescriptionsByPatient);
router.get('/:id', protect, getPrescriptionById);
router.delete('/:id', protect, deletePrescription);

export default router; 