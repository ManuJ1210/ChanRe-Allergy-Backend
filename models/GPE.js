import mongoose from 'mongoose';

const gpeSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  weight: String,
  pulse: String,
  bp: String,
  rr: String,
  temp: String,
  spo2: String,
  entExamination: String,
  cns: String,
  cvs: String,
  rs: String,
  pa: String,
  drugAdverseNotion: String,
  drugCompliance: String,
  followUpAdvice: String,
  eyeMedication: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('GPE', gpeSchema); 