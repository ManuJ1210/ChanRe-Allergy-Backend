import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  medicationName: String,
  dosage: String,
  duration: String,
  frequency: String,
  instructions: String
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center' },
  visit: String,
  date: { type: Date, default: Date.now },
  diagnosis: String,
  medications: [medicationSchema],
  instructions: String,
  followUp: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Prescription', prescriptionSchema); 