import mongoose from 'mongoose';

const allergicBronchitisSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  symptoms: String,
  type: String,
  ginaGrading: Object,
  pftGrading: String,
  habits: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('AllergicBronchitis', allergicBronchitisSchema); 