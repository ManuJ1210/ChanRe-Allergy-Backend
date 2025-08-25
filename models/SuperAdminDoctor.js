import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const superAdminDoctorSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  mobile: { 
    type: String, 
    required: true,
    trim: true
  },
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  qualification: { 
    type: String,
    trim: true
  },
  designation: { 
    type: String,
    trim: true
  },
  kmcNumber: { 
    type: String,
    trim: true
  },
  hospitalName: { 
    type: String,
    trim: true
  },
  specializations: [{ 
    type: String,
    trim: true
  }],
  experience: { 
    type: String,
    trim: true
  },
  bio: { 
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'centeradmin', 'doctor', 'receptionist', 'lab', 'patient'],
    default: 'doctor',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  isSuperAdminStaff: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String,
    default: null
  }
}, { 
  timestamps: true 
});

// Password hashing middleware
superAdminDoctorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
superAdminDoctorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for full name
superAdminDoctorSchema.virtual('fullName').get(function() {
  return this.name;
});

// Ensure virtual fields are serialized
superAdminDoctorSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

const SuperAdminDoctor = mongoose.model('SuperAdminDoctor', superAdminDoctorSchema);
export default SuperAdminDoctor; 