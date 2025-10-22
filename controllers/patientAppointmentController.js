import PatientAppointment from '../models/PatientAppointment.js';
import Center from '../models/Center.js';
import asyncHandler from 'express-async-handler';
import { 
  sendAppointmentConfirmation, 
  sendAppointmentNotificationToCenter,
  sendAppointmentCancellation 
} from '../utils/emailService.js';

// Get all centers for franchise selection
export const getAllCentersForBooking = asyncHandler(async (req, res) => {
  try {
    const centers = await Center.find({}, 'name location address email phone code')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: centers
    });
  } catch (error) {
    console.error('Error fetching centers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch centers',
      error: error.message
    });
  }
});

// Get nearby centers based on location
export const getNearbyCenters = asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude, radius = 50 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // For now, return all centers since we don't have exact coordinates
    // In a real implementation, you would use geospatial queries
    const centers = await Center.find({}, 'name location address email phone code')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: centers
    });
  } catch (error) {
    console.error('Error fetching nearby centers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby centers',
      error: error.message
    });
  }
});

// Book a new appointment
export const bookAppointment = asyncHandler(async (req, res) => {
  try {
    const {
      patientName,
      patientEmail,
      patientPhone,
      patientAge,
      patientGender,
      patientAddress,
      centerId,
      preferredDate,
      preferredTime,
      appointmentType,
      reasonForVisit,
      symptoms,
      previousHistory,
      contactMethod,
      preferredContactTime,
      notes,
      patientLocation
    } = req.body;

    // Validate required fields
    const requiredFields = [
      'patientName', 'patientEmail', 'patientPhone', 'patientAge', 
      'patientGender', 'patientAddress', 'centerId', 'preferredDate', 
      'preferredTime', 'reasonForVisit'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    // Verify center exists
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({
        success: false,
        message: 'Center not found'
      });
    }

    // Create appointment
    const appointment = await PatientAppointment.create({
      patientName,
      patientEmail,
      patientPhone,
      patientAge,
      patientGender,
      patientAddress,
      centerId,
      centerName: center.name,
      centerEmail: center.email,
      centerPhone: center.phone,
      centerAddress: center.address,
      preferredDate: new Date(preferredDate),
      preferredTime,
      appointmentType: appointmentType || 'consultation',
      reasonForVisit,
      symptoms,
      previousHistory,
      contactMethod: contactMethod || 'phone',
      preferredContactTime,
      notes,
      patientLocation
    });

    // Send email notifications
    try {
      // Send confirmation email to patient
      if (appointment.patientEmail) {
        console.log('Sending confirmation email to patient:', appointment.patientEmail);
        await sendAppointmentConfirmation(appointment);
        console.log('Confirmation email sent successfully');
      }
      
      // Send notification email to center
      console.log('Sending notification email to center:', appointment.centerId);
      await sendAppointmentNotificationToCenter(appointment);
      console.log('Notification email sent successfully');
    } catch (emailError) {
      console.error('Failed to send email notifications:', emailError);
      console.error('Email error details:', {
        message: emailError.message,
        stack: emailError.stack,
        code: emailError.code
      });
      // Don't fail the appointment booking if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointmentId: appointment._id,
        confirmationCode: appointment.confirmationCode,
        centerName: center.name,
        preferredDate: appointment.preferredDate,
        preferredTime: appointment.preferredTime
      }
    });

  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book appointment',
      error: error.message
    });
  }
});

// Get appointment by confirmation code
export const getAppointmentByCode = asyncHandler(async (req, res) => {
  try {
    const { confirmationCode } = req.params;
    
    const appointment = await PatientAppointment.findOne({ confirmationCode })
      .populate('centerId', 'name location address email phone');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
});

// Cancel appointment
export const cancelAppointment = asyncHandler(async (req, res) => {
  try {
    const { confirmationCode } = req.params;
    const { cancellationReason } = req.body;

    const appointment = await PatientAppointment.findOne({ confirmationCode });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = cancellationReason;
    await appointment.save();

    // Send cancellation email to patient
    try {
      if (appointment.patientEmail) {
        await sendAppointmentCancellation(appointment);
      }
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
      // Don't fail the cancellation if email fails
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
});

// Get appointments for a center (for receptionist/admin)
export const getCenterAppointments = asyncHandler(async (req, res) => {
  try {
    const { centerId } = req.params;
    const { status, date } = req.query;

    let query = { centerId };
    
    if (status) {
      query.status = status;
    }
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.preferredDate = { $gte: startDate, $lt: endDate };
    }

    const appointments = await PatientAppointment.find(query)
      .sort({ preferredDate: 1, preferredTime: 1 });

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error fetching center appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
});

// Approve appointment using confirmation code
export const approveAppointment = asyncHandler(async (req, res) => {
  try {
    const { confirmationCode } = req.params;

    const appointment = await PatientAppointment.findOne({ confirmationCode });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found with this confirmation code'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve a cancelled appointment'
      });
    }

    if (appointment.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already confirmed'
      });
    }

    // Update status to confirmed
    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment approved successfully',
      data: {
        appointmentId: appointment._id,
        confirmationCode: appointment.confirmationCode,
        status: appointment.status,
        confirmedAt: appointment.confirmedAt,
        centerName: appointment.centerName,
        patientName: appointment.patientName,
        preferredDate: appointment.preferredDate,
        preferredTime: appointment.preferredTime
      }
    });
  } catch (error) {
    console.error('Error approving appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve appointment',
      error: error.message
    });
  }
});

// Update appointment status (for receptionist/admin)
export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, notes } = req.body;

    const appointment = await PatientAppointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    appointment.status = status;
    if (notes) {
      appointment.notes = notes;
    }
    
    if (status === 'confirmed') {
      appointment.confirmedAt = new Date();
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment status',
      error: error.message
    });
  }
});

// Update appointment details (date, time, notes)
export const updateAppointmentDetails = asyncHandler(async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { confirmedDate, confirmedTime, notes, status } = req.body;

    const appointment = await PatientAppointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Update appointment details
    if (confirmedDate) {
      appointment.confirmedDate = new Date(confirmedDate);
    }
    if (confirmedTime) {
      appointment.confirmedTime = confirmedTime;
    }
    if (notes !== undefined) {
      appointment.notes = notes;
    }
    if (status) {
      appointment.status = status;
    }
    
    if (status === 'confirmed') {
      appointment.confirmedAt = new Date();
    }

    await appointment.save();

    // Send confirmation email to patient if appointment is confirmed
    if (status === 'confirmed') {
      try {
        await sendAppointmentConfirmation(appointment);
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'Appointment details updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error updating appointment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment details',
      error: error.message
    });
  }
});

// Search appointments by patient name (for autocomplete)
export const searchAppointmentsByPatientName = asyncHandler(async (req, res) => {
  try {
    const { name, phone, centerId } = req.query;
    
    if ((!name || name.length < 2) && (!phone || phone.length < 2)) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Build search query
    const searchQuery = {
      status: { $in: ['pending', 'confirmed'] } // Only show active appointments
    };

    // Add name or phone search
    if (name && name.length >= 2) {
      searchQuery.patientName = { $regex: name, $options: 'i' };
    }
    
    if (phone && phone.length >= 2) {
      searchQuery.patientPhone = { $regex: phone, $options: 'i' };
    }

    // If centerId is provided, filter by center
    if (centerId) {
      searchQuery.centerId = centerId;
    }

    console.log('Search query:', searchQuery);

    const appointments = await PatientAppointment.find(searchQuery)
      .select('patientName patientPhone patientEmail patientAge patientGender patientAddress preferredDate preferredTime confirmedDate confirmedTime status confirmationCode centerName')
      .sort({ preferredDate: -1 })
      .limit(10); // Limit to 10 suggestions

    console.log('Found appointments:', appointments.length);

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error searching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search appointments',
      error: error.message
    });
  }
});

