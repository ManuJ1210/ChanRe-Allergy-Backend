import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const superAdminReceptionistSchema = new mongoose.Schema({
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
  address: { 
    type: String,
    trim: true
  },
  emergencyContact: { 
    type: String,
    trim: true
  },
  emergencyContactName: { 
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'centeradmin', 'doctor', 'receptionist', 'lab', 'patient'],
    default: 'receptionist',
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
superAdminReceptionistSchema.pre('save', async function (next) {
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
superAdminReceptionistSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for full name
superAdminReceptionistSchema.virtual('fullName').get(function() {
  return this.name;
});

// Ensure virtual fields are serialized
superAdminReceptionistSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

const SuperAdminReceptionist = mongoose.model('SuperAdminReceptionist', superAdminReceptionistSchema);
export default SuperAdminReceptionist; 