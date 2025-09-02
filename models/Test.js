import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  // Test result fields
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
  
  // Test request fields
  testType: { type: String }, // e.g., 'CBC', 'Allergy Panel', 'Complete Blood Work'
  notes: { type: String },
  priority: { 
    type: String, 
    enum: ['low', 'normal', 'high', 'urgent'], 
    default: 'normal' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: { type: Date },
  
  date: { type: Date, default: Date.now },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  
  // Superadmin review fields
  superadminReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'completed'],
      default: 'pending'
    },
    additionalTests: { type: String },
    patientInstructions: { type: String },
    notes: { type: String }
  }
});

const Test = mongoose.model('Test', testSchema);
export default Test; 