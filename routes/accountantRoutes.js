import express from 'express';
import {
  getAccountants,
  getAccountant,
  createAccountant,
  updateAccountant,
  deleteAccountant,
  resetAccountantPassword,
  getAccountantDashboard,
  getAccountantStats,
  getAllBillsAndTransactions,
  getFinancialReports
} from '../controllers/accountantController.js';
import { protect, ensureRole, ensureCenterIsolation } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Dashboard route - accessible by accountants
router.get('/dashboard', ensureRole('accountant'), getAccountantDashboard);

// Stats route - accessible by center admins
router.get('/stats', ensureRole('centeradmin'), getAccountantStats);

// Bills and transactions - accessible by accountants
router.get('/bills-transactions', ensureRole('accountant', 'centeradmin', 'superadmin'), getAllBillsAndTransactions);

// Financial reports - accessible by accountants
router.get('/reports', ensureRole('accountant', 'centeradmin', 'superadmin'), getFinancialReports);

// Get all accountants - accessible by superadmin, centeradmin, and accountants
router.get('/', ensureRole('superadmin', 'centeradmin', 'accountant'), getAccountants);

// Get accountants by center - accessible by superadmin
router.get('/center/:centerId', ensureRole('superadmin'), getAccountants);

// Get single accountant - accessible by superadmin, centeradmin, and accountants
router.get('/:id', ensureRole('superadmin', 'centeradmin', 'accountant'), getAccountant);

// Create accountant - accessible by superadmin and centeradmin
router.post('/', ensureRole('superadmin', 'centeradmin'), ensureCenterIsolation, createAccountant);

// Update accountant - accessible by superadmin, centeradmin, and accountants (for their own profile)
router.put('/:id', ensureRole('superadmin', 'centeradmin', 'accountant'), ensureCenterIsolation, updateAccountant);

// Delete accountant - accessible by superadmin and centeradmin
router.delete('/:id', ensureRole('superadmin', 'centeradmin'), ensureCenterIsolation, deleteAccountant);

// Reset password - accessible by superadmin and centeradmin
router.put('/:id/reset-password', ensureRole('superadmin', 'centeradmin'), ensureCenterIsolation, resetAccountantPassword);

export default router;
