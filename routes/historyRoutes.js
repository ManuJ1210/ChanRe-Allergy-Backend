import express from 'express';
import multer from 'multer';
import { createHistory, getHistoryByPatient, getHistoryById } from '../controllers/historyController.js';
import { protect, ensureDoctor, ensureCenterStaffOrDoctor } from '../middleware/authMiddleware.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// POST /api/history — submit full form with optional file
router.post('/', protect, ensureCenterStaffOrDoctor, upload.single('reportFile'), createHistory);
// POST /api/history/add — alias for compatibility
router.post('/add', protect, ensureCenterStaffOrDoctor, upload.single('reportFile'), createHistory);
// GET /api/history/:patientId — fetch all history for a patient
router.get('/:patientId', protect, getHistoryByPatient);
// GET /api/history/single/:id — fetch single history record by ID
router.get('/single/:id', protect, getHistoryById);

export default router;
