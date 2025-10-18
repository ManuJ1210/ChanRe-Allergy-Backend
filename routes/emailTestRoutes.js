import express from 'express';
import { sendTestEmail, sendTestEmailToCenter } from '../utils/emailService.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();

// Check email configuration
router.get('/check-config', asyncHandler(async (req, res) => {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    const config = {
      emailUser: emailUser || 'NOT_SET',
      emailPass: emailPass ? 'CONFIGURED' : 'NOT_SET',
      hasConfig: !!(emailUser && emailPass)
    };
    
    res.json({
      success: true,
      message: 'Email configuration check',
      config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking email configuration',
      error: error.message
    });
  }
}));

// Test email endpoint
router.post('/test-email', asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    await sendTestEmail(email);
    
    res.json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
}));

// Test email to center (center, admin, and receptionists)
router.post('/test-center-email', asyncHandler(async (req, res) => {
  try {
    const { centerId, testEmail } = req.body;
    
    if (!centerId) {
      return res.status(400).json({
        success: false,
        message: 'Center ID is required'
      });
    }

    const result = await sendTestEmailToCenter(centerId, testEmail);
    
    res.json({
      success: true,
      message: 'Test email sent to center successfully',
      recipients: result.recipients
    });
  } catch (error) {
    console.error('Error sending test email to center:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email to center',
      error: error.message
    });
  }
}));

export default router;
