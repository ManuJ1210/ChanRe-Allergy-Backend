import mongoose from 'mongoose';

const reassignmentTransactionSchema = new mongoose.Schema({
  // Transaction identification
  transactionId: {
    type: String,
    unique: true,
    required: true,
    description: 'Unique transaction ID for this reassignment payment'
  },
  
  // Patient information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    description: 'Patient ID'
  },
  patientName: {
    type: String,
    required: true,
    description: 'Patient name at time of payment'
  },
  patientUhId: {
    type: String,
    description: 'Patient UH ID'
  },
  
  // Doctor information
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Original assigned doctor ID'
  },
  assignedDoctorName: {
    type: String,
    required: true,
    description: 'Original assigned doctor name'
  },
  
  currentDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Current doctor ID after reassignment'
  },
  currentDoctorName: {
    type: String,
    required: true,
    description: 'Current doctor name after reassignment'
  },
  
  // Center information
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true,
    description: 'Center ID where payment was made'
  },
  centerName: {
    type: String,
    required: true,
    description: 'Center name at time of payment'
  },
  
  // Reassignment details
  reassignmentType: {
    type: String,
    enum: ['regular', 'working_hours_violation'],
    default: 'regular',
    description: 'Type of reassignment'
  },
  
  consultationType: {
    type: String,
    enum: ['OP', 'IP', 'followup'],
    required: true,
    description: 'Type of consultation after reassignment'
  },
  
  reassignmentReason: {
    type: String,
    required: true,
    description: 'Reason for reassignment'
  },
  
  reassignmentNotes: {
    type: String,
    description: 'Additional notes for reassignment'
  },
  
  nextConsultationDate: {
    type: Date,
    description: 'Next consultation date (for working hours violations)'
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Payment amount'
  },
  currency: {
    type: String,
    default: 'INR',
    description: 'Currency code'
  },
  
  // Payment method and type
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'net_banking', 'cheque', 'other'],
    required: true,
    description: 'Method of payment'
  },
  
  paymentType: {
    type: String,
    enum: ['full', 'partial'],
    default: 'full',
    description: 'Type of payment'
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    default: 'pending',
    description: 'Payment status'
  },
  
  // Invoice details
  invoiceNumber: {
    type: String,
    description: 'Invoice number associated with this payment'
  },
  
  // Payment breakdown
  paymentBreakdown: {
    consultationFee: {
      type: Number,
      required: true,
      min: 0
    },
    serviceCharges: [{
      name: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        default: ''
      }
    }],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  // Eligibility information
  isEligibleForFreeReassignment: {
    type: Boolean,
    default: false,
    description: 'Whether patient was eligible for free reassignment'
  },
  
  firstConsultationDate: {
    type: Date,
    description: 'Date of first consultation for eligibility calculation'
  },
  
  // Notes and verification
  notes: {
    type: String,
    description: 'Additional payment notes'
  },
  
  verified: {
    type: Boolean,
    default: false,
    description: 'Whether payment was verified by staff'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'User who verified the payment'
  },
  verifiedAt: {
    type: Date,
    description: 'When payment was verified'
  },
  
  // User tracking
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'User who processed the payment'
  },
  
  processedAt: {
    type: Date,
    default: Date.now,
    description: 'When payment was processed'
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'User who created this payment record'
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'User who last modified this payment record'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    description: 'When this payment record was created'
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    description: 'When this payment record was last updated'
  },
  
  // Status change history
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      description: 'Reason for status change'
    },
    notes: {
      type: String,
      description: 'Additional notes for status change'
    }
  }],
  
  // Refund information
  refunds: [{
    refundId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    refundMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'upi', 'other'],
      required: true
    },
    refundReason: {
      type: String,
      required: true
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    refundedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      description: 'Refund notes'
    },
    patientBehavior: {
      type: String,
      enum: ['okay', 'rude'],
      default: 'okay',
      description: 'Patient behavior for penalty policy'
    }
  }],
  
  // Metadata
  metadata: {
    ipAddress: {
      type: String,
      description: 'IP address from which payment was made'
    },
    userAgent: {
      type: String,
      description: 'User agent from payment request'
    },
    source: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin_portal'],
      default: 'web',
      description: 'Source from which payment was initiated'
    },
    isReassignedEntry: {
      type: Boolean,
      default: true,
      description: 'Whether this payment is for a reassigned patient entry'
    }
  }
}, {
  timestamps: true,
  collection: 'reassignmenttransactions'
});

// Add indexes for efficient querying
reassignmentTransactionSchema.index({ transactionId: 1 }, { unique: true });
reassignmentTransactionSchema.index({ patientId: 1 });
reassignmentTransactionSchema.index({ assignedDoctorId: 1 });
reassignmentTransactionSchema.index({ currentDoctorId: 1 });
reassignmentTransactionSchema.index({ centerId: 1 });
reassignmentTransactionSchema.index({ processedBy: 1 });
reassignmentTransactionSchema.index({ status: 1 });
reassignmentTransactionSchema.index({ createdAt: -1 });
reassignmentTransactionSchema.index({ processedAt: -1 });
reassignmentTransactionSchema.index({ reassignmentType: 1 });
reassignmentTransactionSchema.index({ centerId: 1, processedAt: -1 });

// Pre-save middleware to update timestamps and transaction ID
reassignmentTransactionSchema.pre('save', function (next) {
  if (this.isNew) {
    // Generate transaction ID if not provided
    if (!this.transactionId) {
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      this.transactionId = `REASSIGN-${timestamp}-${randomPart.toUpperCase()}`;
    }
    
    // Initialize status history
    if (this.statusHistory.length === 0) {
      this.statusHistory.push({
        status: this.status,
        changedAt: new Date(),
        changedBy: this.processedBy,
        reason: 'Initial payment creation'
      });
    }
  }
  
  this.updatedAt = new Date();
  next();
});

// Method to update status with history tracking
reassignmentTransactionSchema.methods.updateStatus = function(newStatus, changedBy, reason, notes) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: changedBy,
    reason: reason || 'Status updated',
    notes: notes
  });
  this.updatedAt = new Date();
  this.lastModifiedBy = changedBy;
  
  return this.save();
};

// Method to add refund
reassignmentTransactionSchema.methods.addRefund = function(refundData) {
  const refundId = `REFUND-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  this.refunds.push({
    refundId,
    ...refundData,
    refundedAt: new Date()
  });
  
  // Update status based on refund amount
  const totalRefunded = this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  if (totalRefunded >= this.amount) {
    this.status = 'refunded';
  } else if (totalRefunded > 0) {
    this.status = 'partially_refunded';
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// Virtual for remaining refundable amount
reassignmentTransactionSchema.virtual('remainingRefundAmount').get(function() {
  const totalRefunded = this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return Math.max(0, this.amount - totalRefunded);
});

// Virtual for total refunded amount
reassignmentTransactionSchema.virtual('totalRefundedAmount').get(function() {
  return this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
});

// JSON transformation options
reassignmentTransactionSchema.set('toJSON', { virtuals: true });
reassignmentTransactionSchema.set('toObject', { virtuals: true });

const ReassignmentTransaction = mongoose.model('ReassignmentTransaction', reassignmentTransactionSchema);

export default ReassignmentTransaction;
