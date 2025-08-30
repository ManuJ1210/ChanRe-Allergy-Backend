import express from 'express';
import { createMedication, getMedicationsByPatient } from '../controllers/medicationController.js';
import { protect, ensureDoctor } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/medications - add a medication
router.post('/', protect, ensureDoctor, createMedication);
// Add this GET route:
router.get('/', protect, getMedicationsByPatient);

export default router; 