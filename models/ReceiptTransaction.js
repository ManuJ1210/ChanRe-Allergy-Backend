import mongoose from 'mongoose';

const receiptTransactionSchema = new mongoose.Schema({
  // Transaction identification
  transactionId: {
    type: String,
    unique: true,
    required: true,
    description: 'Unique transaction ID for this receipt payment'
  },
  
  // Test Request reference
  testRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestRequest',
    required: true,
    description: 'Reference to the test request this payment belongs to'
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
  
  // Receipt information
  receiptNumber: {
    type: String,
    required: true,
    description: 'Receipt number'
  },
  
  receiptFile: {
    type: String,
    description: 'Uploaded receipt file path'
  },
  
  // Invoice details
  invoiceNumber: {
    type: String,
    description: 'Invoice number associated with this payment'
  },
  
  // Payment breakdown
  paymentBreakdown: {
    items: [{
      name: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      quantity: {
        type: Number,
        default: 1
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
    }
  }
}, {
  timestamps: true,
  collection: 'receipttransactions'
});

// Add indexes for efficient querying
receiptTransactionSchema.index({ transactionId: 1 }, { unique: true });
receiptTransactionSchema.index({ testRequestId: 1 });
receiptTransactionSchema.index({ patientId: 1 });
receiptTransactionSchema.index({ centerId: 1 });
receiptTransactionSchema.index({ processedBy: 1 });
receiptTransactionSchema.index({ status: 1 });
receiptTransactionSchema.index({ createdAt: -1 });
receiptTransactionSchema.index({ processedAt: -1 });
receiptTransactionSchema.index({ receiptNumber: 1 });
receiptTransactionSchema.index({ centerId: 1, processedAt: -1 });

// Pre-save middleware to update timestamps and transaction ID
receiptTransactionSchema.pre('save', function (next) {
  if (this.isNew) {
    // Generate transaction ID if not provided
    if (!this.transactionId) {
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 5);
      this.transactionId = `RECEIPT-${timestamp}-${randomPart.toUpperCase()}`;
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
receiptTransactionSchema.methods.updateStatus = function(newStatus, changedBy, reason, notes) {
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
receiptTransactionSchema.methods.addRefund = function(refundData) {
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
receiptTransactionSchema.virtual('remainingRefundAmount').get(function() {
  const totalRefunded = this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return Math.max(0, this.amount - totalRefunded);
});

// Virtual for total refunded amount
receiptTransactionSchema.virtual('totalRefundedAmount').get(function() {
  return this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
});

// JSON transformation options
receiptTransactionSchema.set('toJSON', { virtuals: true });
receiptTransactionSchema.set('toObject', { virtuals: true });

const ReceiptTransaction = mongoose.model('ReceiptTransaction', receiptTransactionSchema);

export default ReceiptTransaction;
