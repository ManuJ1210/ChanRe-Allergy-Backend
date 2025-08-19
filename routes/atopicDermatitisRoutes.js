import express from 'express';
import { createAtopicDermatitis, getAtopicDermatitisByPatient, getAtopicDermatitisById } from '../controllers/atopicDermatitisController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createAtopicDermatitis);
router.get('/', protect, getAtopicDermatitisByPatient);
router.get('/:id', protect, getAtopicDermatitisById);

export default router; 