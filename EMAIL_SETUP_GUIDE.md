# Email Configuration Guide

## Setting up Email Service without EmailJS

This guide will help you set up email functionality using Nodemailer with Gmail SMTP.

### 1. Environment Variables

Add these variables to your `.env` file in the backend:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 2. Gmail Setup

#### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Factor Authentication

#### Step 2: Generate App Password
1. Go to Google Account settings
2. Navigate to Security > 2-Step Verification
3. Scroll down to "App passwords"
4. Select "Mail" and "Other (Custom name)"
5. Enter "ChanRe Allergy Backend" as the name
6. Copy the generated 16-character password
7. Use this password as `EMAIL_PASS` in your `.env` file

### 3. Alternative Email Providers

You can also use other email providers by modifying the transporter configuration in `utils/emailService.js`:

#### Outlook/Hotmail
```javascript
const transporter = nodemailer.createTransporter({
  service: 'hotmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

#### Custom SMTP
```javascript
const transporter = nodemailer.createTransporter({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

### 4. Testing Email Functionality

Use the test endpoints to verify email setup:

#### Basic Test Email
```bash
POST /api/email-test/test-email
Content-Type: application/json

{
  "email": "test@example.com"
}
```

#### Center Test Email (Tests all recipients)
```bash
POST /api/email-test/test-center-email
Content-Type: application/json

{
  "centerId": "center_id_here",
  "testEmail": "test@example.com" // Optional
}
```

### 5. Email Templates

The system includes three email templates:

1. **Appointment Confirmation** - Sent to patients when they book an appointment
2. **Appointment Notification** - Sent to centers when a new appointment is booked
3. **Appointment Cancellation** - Sent to patients when they cancel an appointment

### 6. Features

- ✅ Professional HTML email templates
- ✅ Responsive design
- ✅ Automatic email sending on appointment events
- ✅ **Dynamic recipient management** - Emails sent to:
  - Center's main email
  - Center admin email (from User model)
  - All active receptionists for the center
- ✅ Error handling (emails won't break appointment booking)
- ✅ Test email functionality for individual and center-wide testing
- ✅ Support for multiple email providers
- ✅ Duplicate email prevention

### 7. Troubleshooting

#### Common Issues:

1. **Authentication Error**: Make sure you're using an App Password, not your regular Gmail password
2. **Connection Timeout**: Check your internet connection and firewall settings
3. **Email Not Received**: Check spam folder, verify email address is correct

#### Debug Mode:
Set `NODE_ENV=development` to see detailed error messages in the console.

### 8. Security Notes

- Never commit your `.env` file to version control
- Use App Passwords instead of regular passwords
- Consider using environment-specific email accounts for production
- Monitor email sending limits to avoid being flagged as spam

### 9. Production Considerations

For production use, consider:
- Using a dedicated email service like SendGrid, Mailgun, or AWS SES
- Implementing email queuing for high volume
- Adding email templates management
- Setting up email analytics and tracking
