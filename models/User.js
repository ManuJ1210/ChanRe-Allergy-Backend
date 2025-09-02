import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String, 
    default: ''
  },
  role: {
    type: String,
    enum: ['superadmin', 'centeradmin', 'doctor', 'receptionist', 'lab', 'patient'],
    default: 'patient'
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    default: null
  },
  // ✅ New: Flag to distinguish between center-specific and superadmin staff
  isSuperAdminStaff: {
    type: Boolean,
    default: false
  },
  qualification: { type: String, default: '' },
  designation: { type: String, default: '' },
  kmcNumber: { type: String, default: '' },
  centerCode :{type: String, default: '' },
  hospitalName: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true },
  mobile: { type: String, default: '' },
  specializations: [{ type: String }],
  experience: { type: String, default: '' },
  bio: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isDeleted: { type: Boolean, default: false },
  // Additional fields for receptionists
  address: { type: String, default: '' },
  emergencyContact: { type: String, default: '' },
  emergencyContactName: { type: String, default: '' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
