import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  type: { type: String, required: true }, // e.g., 'Allergic Rhinitis', etc.
  notes: { type: String },
  allergicRhinitisId: { type: mongoose.Schema.Types.ObjectId, ref: 'AllergicRhinitis' },
  date: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const FollowUp = mongoose.model('FollowUp', followUpSchema);
export default FollowUp; 