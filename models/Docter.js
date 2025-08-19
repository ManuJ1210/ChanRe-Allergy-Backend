import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qualification: { type: String },
  designation: { type: String },
  kmcNumber: { type: String },
  hospitalName: { type: String },
  centerCode: { type: String }, 
  mobile: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['superadmin', 'centeradmin', 'doctor', 'receptionist', 'lab', 'patient'],
    default: 'doctor',
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    default: null
  },
}, { timestamps: true });

// Password hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const Doctor = mongoose.model('Doctor', userSchema);
export default Doctor;
