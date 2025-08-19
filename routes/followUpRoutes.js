import express from 'express';
import { createFollowUp, getFollowUpsByPatient, getAllPatientsWithFollowUps, getAllDetailedFollowUps, getFollowUpsByCenter } from '../controllers/followUpController.js';
import { protect, checkSuperAdmin, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, ensureCenterIsolation, createFollowUp);
router.get('/', protect, ensureCenterIsolation, getFollowUpsByPatient);
router.get('/center', protect, ensureCenterIsolation, getFollowUpsByCenter);
router.get('/patients', protect, checkSuperAdmin, getAllPatientsWithFollowUps);
router.get('/detailed', protect, checkSuperAdmin, getAllDetailedFollowUps);

export default router; 