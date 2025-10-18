import mongoose from 'mongoose';

const patientAppointmentSchema = new mongoose.Schema({
  // Patient Information
  patientName: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  patientAge: {
    type: Number,
    required: true
  },
  patientGender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  patientAddress: {
    type: String,
    required: true
  },
  
  // Center/Franchise Information
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  centerName: {
    type: String,
    required: true
  },
  centerEmail: {
    type: String,
    required: true
  },
  centerPhone: {
    type: String
  },
  centerAddress: {
    type: String,
    required: true
  },
  
  // Appointment Details
  preferredDate: {
    type: Date,
    required: true
  },
  preferredTime: {
    type: String,
    required: true
  },
  appointmentType: {
    type: String,
    enum: ['consultation', 'followup', 'emergency'],
    default: 'consultation'
  },
  reasonForVisit: {
    type: String,
    required: true
  },
  symptoms: {
    type: String
  },
  previousHistory: {
    type: String
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'pending'
  },
  confirmationCode: {
    type: String,
    unique: true
  },
  
  // Contact and Communication
  contactMethod: {
    type: String,
    enum: ['phone', 'email', 'both'],
    default: 'phone'
  },
  preferredContactTime: {
    type: String
  },
  notes: {
    type: String
  },
  
  // Timestamps
  bookedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  
  // Location tracking for nearby search
  patientLocation: {
    latitude: Number,
    longitude: Number,
    city: String,
    state: String,
    pincode: String
  }
}, { 
  timestamps: true 
});

// Generate confirmation code before saving
patientAppointmentSchema.pre('save', function(next) {
  if (!this.confirmationCode) {
    // Generate a 6-digit confirmation code
    this.confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
  }
  next();
});

// Index for efficient queries
patientAppointmentSchema.index({ centerId: 1, status: 1 });
patientAppointmentSchema.index({ patientEmail: 1 });
patientAppointmentSchema.index({ confirmationCode: 1 });
patientAppointmentSchema.index({ preferredDate: 1 });

const PatientAppointment = mongoose.model('PatientAppointment', patientAppointmentSchema);
export default PatientAppointment;
