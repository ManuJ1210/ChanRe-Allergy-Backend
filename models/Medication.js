import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  drugName: { type: String, required: true },
  dose: { type: String, required: true },
  duration: { type: String, required: true },
  frequency: { type: String },
  prescribedBy: { type: String },
  prescribedDate: { type: Date },
  instructions: { type: String },
  adverseEvent: { type: String },
}, { timestamps: true });

const Medication = mongoose.model('Medication', medicationSchema);
export default Medication; 