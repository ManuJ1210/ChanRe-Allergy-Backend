import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const labStaffSchema = new mongoose.Schema({
  staffName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  // Lab staff work for the centralized lab, not specific centers
  labId: {
    type: String,
    default: 'CENTRAL_LAB',
    trim: true
  },
  role: {
    type: String,
    enum: ['Lab Staff', 'Lab Technician', 'Lab Assistant', 'Lab Manager'],
    default: 'Lab Staff'
  },
  password: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
labStaffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
labStaffSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Create index for better query performance
labStaffSchema.index({ labId: 1, email: 1 });

const LabStaff = mongoose.model('LabStaff', labStaffSchema);

export default LabStaff; 