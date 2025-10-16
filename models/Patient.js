import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  CBC: { type: String },
  Hb: { type: String },
  TC: { type: String },
  DC: { type: String },
  Neutrophils: { type: String },
  Eosinophil: { type: String },
  Lymphocytes: { type: String },
  Monocytes: { type: String },
  Platelets: { type: String },
  ESR: { type: String },
  SerumCreatinine: { type: String },
  SerumIgELevels: { type: String },
  C3C4Levels: { type: String },
  ANA_IF: { type: String },
  UrineRoutine: { type: String },
  AllergyPanel: { type: String },
  date: { type: Date, default: Date.now }
});

const historySchema = new mongoose.Schema({
  hayFever: { type: String },
  asthma: { type: String },
  breathingProblems: { type: String },
  hivesSwelling: { type: String },
  sinusTrouble: { type: String },
  eczemaRashes: { type: String },
  foodAllergies: { type: String },
  drugAllergy: { type: String },
  date: { type: Date, default: Date.now }
});

const medicationSchema = new mongoose.Schema({
  drugName: { type: String, required: true },
  dose: { type: String, required: true },
  duration: { type: String, required: true },
  frequency: { type: String },
  prescribedBy: { type: String },
  adverseEvent: { type: String },
  instructions: { type: String }, // Medication instructions
  date: { type: Date, default: Date.now }
});

const followUpSchema = new mongoose.Schema({
  type: { type: String, required: true },
  status: { type: String, default: 'active' },
  notes: { type: String },
  date: { type: Date, default: Date.now }
});

const billingSchema = new mongoose.Schema({
  type: { type: String, required: true }, // 'consultation', 'registration', 'service', 'test', 'medication', etc.
  description: { type: String },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 }, // Amount paid so far
  paymentMethod: { type: String, default: 'cash' },
  status: { type: String, enum: ['pending', 'paid', 'partial', 'completed', 'unpaid', 'cancelled', 'refunded', 'partially_refunded'], default: 'pending' },
  paidBy: { type: String }, // Name of person who collected payment
  paidAt: { type: Date },
  paymentNotes: { type: String }, // Payment notes
  invoiceNumber: { type: String }, // Auto-generated invoice number
  serviceDetails: { type: String }, // Additional service details
  
  // Consultation type and followup tracking
  consultationType: { 
    type: String, 
    enum: ['OP', 'IP', 'followup'], 
    default: 'OP' 
  }, // Type of consultation
  isFollowup: { type: Boolean, default: false }, // Whether this is a followup visit
  followupParentId: { type: mongoose.Schema.Types.ObjectId }, // Reference to original consultation
  
  // Reassigned entry tracking
  isReassignedEntry: { type: Boolean, default: false }, // Whether this is a reassigned entry
  reassignedEntryId: { type: String }, // Unique ID for reassigned entry
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Doctor for this billing entry
  
  // Cancellation fields
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationReason: { type: String },
  // Penalty information for cancellation policy
  penaltyInfo: {
    penaltyAmount: { type: Number, default: 0 },
    refundType: { type: String, enum: ['partial', 'full'], default: 'partial' },
    patientBehavior: { type: String, enum: ['okay', 'rude'], default: 'okay' },
    refundAmount: { type: Number, default: 0 },
    appliedAt: { type: Date },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  // Refund fields
  refundedAt: { type: Date },
  refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  refundAmount: { type: Number, default: 0 },
  refundMethod: { type: String },
  refundReason: { type: String },
  refundNotes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const reassignmentHistorySchema = new mongoose.Schema({
  previousDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  previousDoctorName: { type: String }, // Store doctor name for easier access
  newDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  newDoctorName: { type: String }, // Store doctor name for easier access
  reassignedAt: { type: Date, default: Date.now },
  reassignedBy: { type: String }, // Name of person who reassigned
  reason: { type: String, required: true },
  notes: { type: String }, // Additional notes about reassignment
  createdAt: { type: Date, default: Date.now }
});

const revisitHistorySchema = new mongoose.Schema({
  revisitDate: { type: Date, default: Date.now },
  reason: { type: String },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});


const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  age: { type: Number, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true,
  },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Current doctor (for reassigned patients)
  isReassigned: { type: Boolean, default: false }, // Flag to indicate if patient has been reassigned
  assignedAt: { type: Date }, // Track when patient was assigned to doctor
  viewedByDoctor: { type: Boolean, default: false }, // Track if doctor has viewed this patient
  viewedAt: { type: Date }, // Track when doctor first viewed the patient
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  centerCode: { type: String },
  uhId: { type: String, unique: true }, // UH ID: centerCode + serial number (e.g., 223344001)
  serialNumber: { type: Number }, // Serial number for this center
  lastVisitDate: { type: Date }, // Track last visit date
  visitCount: { type: Number, default: 0 }, // Track number of visits
  // Appointment fields
  appointmentTime: { type: Date }, // Scheduled appointment time
  appointmentStatus: { 
    type: String, 
    enum: ['scheduled', 'viewed', 'missed', 'reassigned', 'working_hours_violation'], 
    default: 'scheduled' 
  }, // Appointment status
  appointmentNotes: { type: String }, // Additional appointment notes
  missedAt: { type: Date }, // When appointment was marked as missed
  reassignedAt: { type: Date }, // When patient was reassigned due to missed appointment
  
  // Working hours tracking
  workingHoursViolation: { type: Boolean, default: false }, // Flag for working hours violation
  violationDate: { type: Date }, // Date when working hours were violated
  nextConsultationDate: { type: Date }, // Custom date for next consultation
  requiresReassignment: { type: Boolean, default: false }, // Flag to indicate reassignment needed
  reassignmentReason: { type: String }, // Reason for reassignment (working hours, etc.)
  
  // Followup tracking
  lastPaidConsultationDate: { type: Date }, // Date of last paid consultation
  followupEligible: { type: Boolean, default: false }, // Whether patient is eligible for free followup
  followupUsed: { type: Boolean, default: false }, // Whether free followup has been used
  followupExpiryDate: { type: Date }, // When followup eligibility expires
  
  // Consultation type tracking
  consultationType: { 
    type: String, 
    enum: ['OP', 'IP', 'followup'], 
    default: 'OP' 
  }, // Type of consultation
  tests: [testSchema],
  history: [historySchema],
  medications: [medicationSchema],
  followUps: [followUpSchema],
  billing: [billingSchema],
  reassignedBilling: [billingSchema], // Separate billing records for reassigned patients
  reassignmentHistory: [reassignmentHistorySchema], // Track doctor reassignments
  lastReassignedAt: { type: Date }, // Track when patient was last reassigned
  revisitHistory: [revisitHistorySchema] // Track patient revisits
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
