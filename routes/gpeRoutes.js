import express from 'express';
import { createGPE, getGPEByPatient, getGPEById } from '../controllers/gpeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createGPE);
router.get('/', protect, getGPEByPatient);
router.get('/:id', protect, getGPEById);

export default router; 