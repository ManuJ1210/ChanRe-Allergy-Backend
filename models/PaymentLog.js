import mongoose from 'mongoose';

const paymentLogSchema = new mongoose.Schema({
  // Transaction identification
  transactionId: {
    type: String,
    unique: true,
    required: true,
    description: 'Unique transaction ID for this payment'
  },
  
  // Reference to the main entity (test request ID)
  testRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestRequest',
    required: false, // Made optional to support patient billing payments
    description: 'Reference to the test request this payment belongs to'
  },
  
  // Patient information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    description: 'Patient ID'
  },
  patientName: {
    type: String,
    required: true,
    description: 'Patient name at time of payment'
  },
  
  // Center and billing information
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
  
  // Payment categorization
  paymentType: {
    type: String,
    enum: ['consultation', 'registration', 'service', 'test', 'medication', 'lab_test', 'other'],
    required: true,
    description: 'Type of payment'
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'upi', 'net_banking', 'cheque', 'nft', 'other'],
    required: true,
    description: 'Method of payment'
  },
  
  // Transaction status tracking
  status: {
    type: String,
    enum: ['initiated', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'initiated',
    description: 'Payment process status'
  },
  
  // External references
  externalTransactionId: {
    type: String,
    description: 'External payment gateway transaction ID'
  },
  
  // Payment processing details
  paymentGateway: {
    type: String,
    description: 'Payment gateway used (e.g., Razorpay, PayU, etc.)'
  },
  
  receiptNumber: {
    type: String,
    description: 'Receipt or reference number'
  },
  
  receiptFile: {
    type: String,
    description: 'Uploaded receipt file path'
  },
  
  // Notes and verification
  notes: {
    type: String,
    description: 'Additional payment notes or verification details'
  },
  
  verificationNotes: {
    type: String,
    description: 'Verification details provided by admin/operator'
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
  
  // Refund information (if applicable)
  refund: {
    refundedAmount: {
      type: Number,
      min: 0,
      description: 'Amount refunded'
    },
    refundedAt: {
      type: Date,
      description: 'When refund was processed'
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'User who processed the refund'
    },
    refundReason: {
      type: String,
      description: 'Reason for refund'
    },
    externalRefundId: {
      type: String,
      description: 'External refund transaction ID'
    }
  },
  
  // Metadata for tracking and troubleshooting
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
      default: false,
      description: 'Whether this payment is for a reassigned patient entry'
    },
    reassignedEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'Reassigned entry ID if applicable'
    }
  },
  
  // Billing reference
  billingId: {
    type: mongoose.Schema.Types.ObjectId,
    description: 'Related billing record ID'
  },
  invoiceNumber: {
    type: String,
    description: 'Invoice number associated with this payment'
  }
}, {
  timestamps: true,
  collection: 'paymentlogs'
});

// Add indexes for efficient querying
// transactionId index is automatically created by unique: true
paymentLogSchema.index({ testRequestId: 1 });
paymentLogSchema.index({ patientId: 1 });
paymentLogSchema.index({ centerId: 1 });
paymentLogSchema.index({ processedBy: 1 });
paymentLogSchema.index({ status: 1 });
paymentLogSchema.index({ createdAt: -1 });
paymentLogSchema.index({ processedAt: -1 });
paymentLogSchema.index({ paymentType: 1 });
paymentLogSchema.index({ paymentMethod: 1 });
paymentLogSchema.index({ centerId: 1, processedAt: -1 });

// Pre-save middleware to update timestamps and transaction ID
paymentLogSchema.pre('save', function (next) {
  if (this.isNew) {
    // Generate transaction ID if not provided
    if (!this.transactionId) {
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      this.transactionId = `PAY-${timestamp}-${randomPart.toUpperCase()}`;
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
paymentLogSchema.methods.updateStatus = function(newStatus, changedBy, reason, notes) {
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

// Method to check if payment is completed
paymentLogSchema.methods.isCompleted = function() {
  return this.status === 'completed';
};

// Method to check if payment is refunded
paymentLogSchema.methods.isRefunded = function() {
  return this.status === 'refunded' || (this.refund && this.refund.refundedAmount > 0);
};

// Virtual for remaining refundable amount
paymentLogSchema.virtual('remainingRefundAmount').get(function() {
  if (!this.refund) return this.amount;
  return Math.max(0, this.amount - (this.refund.refundedAmount || 0));
});

// JSON transformation options
paymentLogSchema.set('toJSON', { virtuals: true });
paymentLogSchema.set('toObject', { virtuals: true });

const PaymentLog = mongoose.model('PaymentLog', paymentLogSchema);

export default PaymentLog;
