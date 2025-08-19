import express from 'express';
import { register, login, forgotPassword, getCurrentUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// ✅ Forgot password route
router.post('/forgot-password', forgotPassword);

// ✅ Get current user route
router.get('/me', protect, getCurrentUser);

export default router;
