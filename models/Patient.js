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
  paymentMethod: { type: String, default: 'cash' },
  status: { type: String, enum: ['pending', 'paid', 'completed', 'unpaid'], default: 'pending' },
  paidBy: { type: String }, // Name of person who collected payment
  paidAt: { type: Date },
  invoiceNumber: { type: String }, // Auto-generated invoice number
  serviceDetails: { type: String }, // Additional service details
  createdAt: { type: Date, default: Date.now }
});

const reassignmentHistorySchema = new mongoose.Schema({
  previousDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  newDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reassignedAt: { type: Date, default: Date.now },
  reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String }
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
  assignedAt: { type: Date }, // Track when patient was assigned to doctor
  viewedByDoctor: { type: Boolean, default: false }, // Track if doctor has viewed this patient
  viewedAt: { type: Date }, // Track when doctor first viewed the patient
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  centerCode: { type: String },
  uhId: { type: String, unique: true }, // UH ID: centerCode + serial number (e.g., 223344001)
  serialNumber: { type: Number }, // Serial number for this center
  lastVisitDate: { type: Date }, // Track last visit date
  visitCount: { type: Number, default: 0 }, // Track number of visits
  tests: [testSchema],
  history: [historySchema],
  medications: [medicationSchema],
  followUps: [followUpSchema],
  billing: [billingSchema],
  reassignmentHistory: [reassignmentHistorySchema], // Track doctor reassignments
  revisitHistory: [revisitHistorySchema] // Track patient revisits
}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;
