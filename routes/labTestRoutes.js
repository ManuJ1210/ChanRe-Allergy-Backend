import express from 'express';
import {
  getAllLabTests,
  getLabTestById,
  getLabTestByCode,
  getTestCategories,
  searchLabTests,
  getTestStatistics,
  createLabTest,
  updateLabTest,
  deactivateLabTest
} from '../controllers/labTestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (or routes that require authentication)
router.get('/search', protect, searchLabTests); // Quick search for autocomplete
router.get('/categories', protect, getTestCategories); // Get all categories
router.get('/statistics', protect, getTestStatistics); // Get test statistics
router.get('/all', protect, getAllLabTests); // Get all tests with pagination
router.get('/code/:code', protect, getLabTestByCode); // Get test by code
router.get('/:id', protect, getLabTestById); // Get test by ID

// Admin only routes (you might want to add role-based middleware)
router.post('/', protect, createLabTest); // Create new test
router.put('/:id', protect, updateLabTest); // Update test
router.delete('/:id', protect, deactivateLabTest); // Deactivate test

export default router;

