import mongoose from 'mongoose';

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  token: {
    type: String,
    required: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String,
    os: String,
    device: String
  },
  locationInfo: {
    ip: String,
    country: String,
    region: String,
    city: String,
    timezone: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: false
  },
  userRole: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ centerId: 1, isActive: 1 });
userSessionSchema.index({ sessionId: 1 });
userSessionSchema.index({ loginTime: -1 });

// Method to update last activity
userSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Method to logout session
userSessionSchema.methods.logout = function() {
  this.isActive = false;
  this.logoutTime = new Date();
  return this.save();
};

// Static method to get active sessions for a user
userSessionSchema.statics.getActiveSessions = function(userId) {
  return this.find({ userId, isActive: true }).sort({ loginTime: -1 });
};

// Static method to get all active sessions for superadmin
userSessionSchema.statics.getAllActiveSessions = function() {
  return this.find({ isActive: true })
    .populate('userId', 'name username email role userType centerId')
    .populate('centerId', 'name address')
    .sort({ loginTime: -1 });
};

// Static method to get sessions by center
userSessionSchema.statics.getSessionsByCenter = function(centerId) {
  return this.find({ centerId, isActive: true })
    .populate('userId', 'name username email role userType')
    .sort({ loginTime: -1 });
};

export default mongoose.model('UserSession', userSessionSchema);
