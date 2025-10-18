import nodemailer from 'nodemailer';
import Center from '../models/Center.js';
import User from '../models/User.js';

// Email configuration
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER || 'your-email@gmail.com';
  const emailPass = process.env.EMAIL_PASS || 'your-app-password';
  
  console.log('Email configuration:', {
    user: emailUser,
    pass: emailPass ? '***configured***' : 'NOT_SET'
  });
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('EMAIL_USER or EMAIL_PASS not configured in environment variables');
    throw new Error('Email configuration missing. Please set EMAIL_USER and EMAIL_PASS in .env file');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

// Email templates
const emailTemplates = {
  appointmentConfirmation: (appointment) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Appointment Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2490eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #2490eb; }
        .confirmation-code { font-size: 24px; font-weight: bold; color: #2490eb; text-align: center; padding: 10px; background: #e0f2fe; border-radius: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Confirmed!</h1>
          <p>ChanRe Allergy Center</p>
        </div>
        <div class="content">
          <p>Dear ${appointment.patientName},</p>
          <p>Your appointment has been successfully booked. Please find the details below:</p>
          
          <div class="confirmation-code">
            Confirmation Code: ${appointment.confirmationCode}
          </div>
          
          <div class="info-box">
            <h3>Appointment Details</h3>
            <p><strong>Center:</strong> ${appointment.centerName}</p>
            <p><strong>Date:</strong> ${new Date(appointment.preferredDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.preferredTime}</p>
            <p><strong>Type:</strong> ${appointment.appointmentType}</p>
          </div>
          
          <div class="info-box">
            <h3>Center Information</h3>
            <p><strong>Address:</strong> ${appointment.centerAddress}</p>
            <p><strong>Phone:</strong> ${appointment.centerPhone}</p>
            <p><strong>Email:</strong> ${appointment.centerEmail}</p>
          </div>
          
          <p><strong>Important Notes:</strong></p>
          <ul>
            <li>Please arrive 15 minutes before your appointment time</li>
            <li>Bring a valid ID and any relevant medical documents</li>
            <li>Keep your confirmation code safe for future reference</li>
            <li>A receptionist will contact you shortly to confirm details</li>
          </ul>
          
          <p>If you need to cancel or reschedule, please contact the center directly or use your confirmation code.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© 2024 ChanRe Allergy Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  appointmentNotificationToCenter: (appointment, centerAdminName = '') => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Appointment Booking</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2490eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #2490eb; }
        .urgent { border-left-color: #e74c3c; background: #fdf2f2; }
        .confirmation-code { font-size: 20px; font-weight: bold; color: #2490eb; text-align: center; padding: 10px; background: #e0f2fe; border-radius: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Appointment Booking</h1>
          <p>ChanRe Allergy Center - ${appointment.centerName}</p>
          ${centerAdminName ? `<p>Center Admin: ${centerAdminName}</p>` : ''}
        </div>
        <div class="content">
          <p>A new appointment has been booked for your center. This email has been sent to the center, center admin, and all receptionists.</p>
          <p>Please review the details below:</p>
          
          <div class="confirmation-code">
            Confirmation Code: ${appointment.confirmationCode}
          </div>
          
          <div class="info-box">
            <h3>Patient Information</h3>
            <p><strong>Name:</strong> ${appointment.patientName}</p>
            <p><strong>Email:</strong> ${appointment.patientEmail}</p>
            <p><strong>Phone:</strong> ${appointment.patientPhone}</p>
            <p><strong>Age:</strong> ${appointment.patientAge}</p>
            <p><strong>Gender:</strong> ${appointment.patientGender}</p>
            <p><strong>Address:</strong> ${appointment.patientAddress}</p>
          </div>
          
          <div class="info-box">
            <h3>Appointment Details</h3>
            <p><strong>Preferred Date:</strong> ${new Date(appointment.preferredDate).toLocaleDateString()}</p>
            <p><strong>Preferred Time:</strong> ${appointment.preferredTime}</p>
            <p><strong>Type:</strong> ${appointment.appointmentType}</p>
            <p><strong>Reason for Visit:</strong> ${appointment.reasonForVisit}</p>
            <p><strong>Contact Method:</strong> ${appointment.contactMethod}</p>
            ${appointment.preferredContactTime ? `<p><strong>Preferred Contact Time:</strong> ${appointment.preferredContactTime}</p>` : ''}
          </div>
          
          ${appointment.symptoms ? `
          <div class="info-box">
            <h3>Symptoms</h3>
            <p>${appointment.symptoms}</p>
          </div>
          ` : ''}
          
          ${appointment.previousHistory ? `
          <div class="info-box">
            <h3>Previous Medical History</h3>
            <p>${appointment.previousHistory}</p>
          </div>
          ` : ''}
          
          ${appointment.notes ? `
          <div class="info-box">
            <h3>Additional Notes</h3>
            <p>${appointment.notes}</p>
          </div>
          ` : ''}
          
          <div class="info-box urgent">
            <h3>Action Required</h3>
            <p><strong>Please contact the patient to confirm the appointment details.</strong></p>
            <p>Preferred contact method: ${appointment.contactMethod}</p>
            <p>Patient phone: ${appointment.patientPhone}</p>
            <p>Patient email: ${appointment.patientEmail}</p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated notification. Please contact the patient as soon as possible.</p>
          <p>© 2024 ChanRe Allergy Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  appointmentCancellation: (appointment) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Appointment Cancelled</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #e74c3c; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Cancelled</h1>
          <p>ChanRe Allergy Center</p>
        </div>
        <div class="content">
          <p>Dear ${appointment.patientName},</p>
          <p>Your appointment has been cancelled as requested.</p>
          
          <div class="info-box">
            <h3>Cancelled Appointment Details</h3>
            <p><strong>Center:</strong> ${appointment.centerName}</p>
            <p><strong>Date:</strong> ${new Date(appointment.preferredDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.preferredTime}</p>
            <p><strong>Confirmation Code:</strong> ${appointment.confirmationCode}</p>
            <p><strong>Cancellation Reason:</strong> ${appointment.cancellationReason}</p>
          </div>
          
          <p>If you need to book a new appointment, please visit our website or contact the center directly.</p>
          <p>Thank you for choosing ChanRe Allergy Center.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© 2024 ChanRe Allergy Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
};

// Email sending functions
export const sendAppointmentConfirmation = async (appointment) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: appointment.patientEmail,
      subject: `Appointment Confirmed - ${appointment.centerName}`,
      html: emailTemplates.appointmentConfirmation(appointment)
    };

    await transporter.sendMail(mailOptions);
    console.log('Appointment confirmation email sent to:', appointment.patientEmail);
    return true;
  } catch (error) {
    console.error('Error sending appointment confirmation email:', error);
    throw error;
  }
};

export const sendAppointmentNotificationToCenter = async (appointment) => {
  try {
    const transporter = createTransporter();
    
    // Fetch center details with admin information
    const center = await Center.findById(appointment.centerId).populate('centerAdminId', 'email name');
    
    if (!center) {
      throw new Error('Center not found');
    }

    // Fetch all receptionists for this center
    const receptionists = await User.find({ 
      centerId: appointment.centerId, 
      role: 'receptionist',
      status: 'active',
      isDeleted: false 
    }).select('email name');

    // Prepare recipient list
    let recipients = [center.email]; // Center's main email
    
    // Add center admin email if available
    if (center.centerAdminId && center.centerAdminId.email) {
      recipients.push(center.centerAdminId.email);
    }
    
    // Add all receptionist emails
    receptionists.forEach(receptionist => {
      if (receptionist.email) {
        recipients.push(receptionist.email);
      }
    });
    
    // Remove duplicates
    recipients = [...new Set(recipients)];
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: recipients.join(', '), // Send to center, admin, and all receptionists
      subject: `New Appointment Booking - ${appointment.patientName}`,
      html: emailTemplates.appointmentNotificationToCenter(appointment, center.centerAdminId?.name || '')
    };

    await transporter.sendMail(mailOptions);
    console.log('Appointment notification email sent to:', recipients);
    return true;
  } catch (error) {
    console.error('Error sending appointment notification email:', error);
    throw error;
  }
};

export const sendAppointmentCancellation = async (appointment) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: appointment.patientEmail,
      subject: `Appointment Cancelled - ${appointment.centerName}`,
      html: emailTemplates.appointmentCancellation(appointment)
    };

    await transporter.sendMail(mailOptions);
    console.log('Appointment cancellation email sent to:', appointment.patientEmail);
    return true;
  } catch (error) {
    console.error('Error sending appointment cancellation email:', error);
    throw error;
  }
};

export const sendTestEmail = async (toEmail) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: toEmail,
      subject: 'Test Email - ChanRe Allergy Center',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from ChanRe Allergy Center.</p>
        <p>If you receive this email, the email service is working correctly.</p>
        <p>Time: ${new Date().toLocaleString()}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Test email sent to:', toEmail);
    return true;
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};

export const sendTestEmailToCenter = async (centerId, testEmail) => {
  try {
    const transporter = createTransporter();
    
    // Fetch center details with admin information
    const center = await Center.findById(centerId).populate('centerAdminId', 'email name');
    
    if (!center) {
      throw new Error('Center not found');
    }

    // Fetch all receptionists for this center
    const receptionists = await User.find({ 
      centerId: centerId, 
      role: 'receptionist',
      status: 'active',
      isDeleted: false 
    }).select('email name');

    // Prepare recipient list
    let recipients = [center.email]; // Center's main email
    
    // Add center admin email if available
    if (center.centerAdminId && center.centerAdminId.email) {
      recipients.push(center.centerAdminId.email);
    }
    
    // Add all receptionist emails
    receptionists.forEach(receptionist => {
      if (receptionist.email) {
        recipients.push(receptionist.email);
      }
    });
    
    // Add test email if provided
    if (testEmail) {
      recipients.push(testEmail);
    }
    
    // Remove duplicates
    recipients = [...new Set(recipients)];
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: recipients.join(', '),
      subject: `Test Email - ChanRe Allergy Center (${center.name})`,
      html: `
        <h2>Test Email for Center: ${center.name}</h2>
        <p>This is a test email to verify email functionality.</p>
        <p><strong>Recipients:</strong></p>
        <ul>
          <li>Center Email: ${center.email}</li>
          ${center.centerAdminId ? `<li>Center Admin: ${center.centerAdminId.email} (${center.centerAdminId.name})</li>` : ''}
          ${receptionists.length > 0 ? '<li>Receptionists:</li>' : ''}
          ${receptionists.map(r => `<li>- ${r.email} (${r.name})</li>`).join('')}
          ${testEmail ? `<li>Test Email: ${testEmail}</li>` : ''}
        </ul>
        <p>Time: ${new Date().toLocaleString()}</p>
        <p>If you receive this email, the email service is working correctly for this center.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Test email sent to center recipients:', recipients);
    return { success: true, recipients };
  } catch (error) {
    console.error('Error sending test email to center:', error);
    throw error;
  }
};

export default {
  sendAppointmentConfirmation,
  sendAppointmentNotificationToCenter,
  sendAppointmentCancellation,
  sendTestEmail,
  sendTestEmailToCenter
};
