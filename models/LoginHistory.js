import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  sessionDuration: {
    type: Number, // in minutes
    default: null
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
  loginStatus: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  failureReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
loginHistorySchema.index({ userId: 1, loginTime: -1 });
loginHistorySchema.index({ centerId: 1, loginTime: -1 });
loginHistorySchema.index({ userRole: 1, loginTime: -1 });
loginHistorySchema.index({ loginTime: -1 });

// Method to calculate session duration
loginHistorySchema.methods.calculateDuration = function() {
  if (this.logoutTime) {
    this.sessionDuration = Math.round((this.logoutTime - this.loginTime) / (1000 * 60)); // in minutes
  }
  return this.sessionDuration;
};

// Static method to get login history for a user
loginHistorySchema.statics.getUserLoginHistory = function(userId, limit = 50) {
  return this.find({ userId })
    .populate('centerId', 'name address code')
    .sort({ loginTime: -1 })
    .limit(limit);
};

// Static method to get login history for a center
loginHistorySchema.statics.getCenterLoginHistory = function(centerId, limit = 100) {
  return this.find({ centerId })
    .populate('userId', 'name username email role')
    .sort({ loginTime: -1 })
    .limit(limit);
};

// Static method to get recent logins across all centers
loginHistorySchema.statics.getRecentLogins = function(limit = 100) {
  return this.find({ loginStatus: 'success' })
    .populate('userId', 'name username email role userType')
    .populate('centerId', 'name address code')
    .sort({ loginTime: -1 })
    .limit(limit);
};

// Static method to get login statistics
loginHistorySchema.statics.getLoginStats = function(startDate, endDate) {
  const matchStage = {
    loginStatus: 'success'
  };
  
  if (startDate && endDate) {
    matchStage.loginTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$loginTime" } },
          role: "$userRole"
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: "$userId" }
      }
    },
    {
      $group: {
        _id: "$_id.date",
        totalLogins: { $sum: "$count" },
        uniqueUsers: { $sum: { $size: "$uniqueUsers" } },
        roles: {
          $push: {
            role: "$_id.role",
            count: "$count"
          }
        }
      }
    },
    { $sort: { _id: -1 } }
  ]);
};

export default mongoose.model('LoginHistory', loginHistorySchema);
