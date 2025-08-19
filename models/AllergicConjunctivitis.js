import mongoose from 'mongoose';

const allergicConjunctivitisSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  symptoms: { type: Object }, // Changed from [String] to Object to match form data
  type: String,
  grading: { type: Object },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('AllergicConjunctivitis', allergicConjunctivitisSchema); 