import mongoose from 'mongoose';

const testRequestSchema = new mongoose.Schema({
  // Basic request info
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  testType: {
    type: String,
    required: true
  },
  testDescription: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['Normal', 'Urgent', 'Emergency'],
    default: 'Normal'
  },
  notes: String,
  
  // Center and doctor info (derived)
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center'
  },
  centerName: String,
  centerCode: String,
  doctorName: String,
  patientName: String,
  patientPhone: String,
  patientAddress: String,
  
  // Lab workflow fields
  status: {
    type: String,
    enum: ['Pending', 'Billing_Pending', 'Billing_Generated', 'Billing_Paid', 'Superadmin_Review', 'Superadmin_Approved', 'Superadmin_Rejected', 'Assigned', 'Sample_Collection_Scheduled', 'Sample_Collected', 'In_Lab_Testing', 'Testing_Completed', 'Report_Generated', 'Report_Sent', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  
  // ✅ NEW: Superadmin review workflow fields
  superadminReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdminDoctor'
    },
    reviewedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'requires_changes'],
      default: 'pending'
    },
    reviewNotes: String,
    additionalTests: String,
    patientInstructions: String,
    changesRequired: String,
    approvedForLab: {
      type: Boolean,
      default: false
    }
  },
  
  // ✅ NEW: Workflow tracking
  workflowStage: {
    type: String,
    enum: ['doctor_request', 'billing', 'superadmin_review', 'lab_assignment', 'sample_collection', 'lab_testing', 'report_generation', 'completed'],
    default: 'doctor_request'
  },
  
  // ✅ NEW: Approval tracking
  approvals: {
    superadmin: {
      approved: { type: Boolean, default: false },
      approvedAt: Date,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdminDoctor' }
    },
    lab: {
      approved: { type: Boolean, default: false },
      approvedAt: Date,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'LabStaff' }
    }
  },

  // ✅ NEW: Billing information (handled by Center Receptionist)
  billing: {
    status: {
      type: String,
      enum: ['not_generated', 'generated', 'payment_received', 'paid', 'partially_paid', 'verified', 'cancelled'],
      default: 'not_generated'
    },
    amount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 }, // ✅ NEW: Track paid amount
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'partial', 'completed'], 
      default: 'pending' 
    }, // ✅ NEW: Track payment status
    currency: { type: String, default: 'INR' },
    items: [
      {
        name: String,
        code: String,
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      }
    ],
    taxes: { type: Number, default: 0 },
    discounts: { type: Number, default: 0 },
    invoiceNumber: { type: String },
    generatedAt: Date,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
    paymentNotes: String, // ✅ NEW: Payment-specific notes
    // ✅ NEW: Enhanced payment verification fields
    paymentMethod: String,
    transactionId: String,
    receiptUpload: String,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    verificationNotes: String,
    // ✅ NEW: Update tracking fields
    updatedBy: String, // ✅ NEW: Track who updated
    updatedAt: Date // ✅ NEW: Track when updated
  },
  
  // Lab staff assignment
  assignedLabStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabStaff'
  },
  assignedLabStaffName: String,
  
  // Sample collection details
  sampleCollectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabStaff'
  },
  sampleCollectorName: String,
  sampleCollectionScheduledDate: Date,
  sampleCollectionActualDate: Date,
  sampleCollectionNotes: String,
  sampleCollectionStatus: {
    type: String,
    enum: ['Not_Scheduled', 'Scheduled', 'In_Progress', 'Completed', 'Failed'],
    default: 'Not_Scheduled'
  },
  
  // Lab testing details
  labTechnicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabStaff'
  },
  labTechnicianName: String,
  testingStartDate: Date,
  testingEndDate: Date,
  testingNotes: String,
  
  // Test results
  testResults: {
    type: String,
    default: 'Pending'
  },
  resultDetails: String,
  resultValues: [{
    parameter: String,
    value: String,
    unit: String,
    normalRange: String,
    status: {
      type: String,
      enum: ['Normal', 'High', 'Low', 'Critical'],
      default: 'Normal'
    }
  }],
  
  // Report generation
  reportGeneratedDate: Date,
  reportGeneratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabStaff'
  },
  reportGeneratedByName: String,
  reportFile: String, // PDF file path
  reportNotes: String,
  reportFilePath: String, // For uploaded files
  reportSummary: String,
  clinicalInterpretation: String,
  qualityControl: String,
  methodUsed: String,
  equipmentUsed: String,
  
  // Additional fields for complete testing workflow
  conclusion: String,
  recommendations: String,
  labTestingCompletedDate: Date,
  
  // Report sending fields
  reportSentDate: Date,
  reportSentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabStaff'
  },
  reportSentByName: String,
  sendMethod: String,
  emailSubject: String,
  emailMessage: String,
  notificationMessage: String,
  sentTo: String,
  deliveryConfirmation: String,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Status tracking
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Direct upload tracking
  directUploadCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Update the updatedAt field on save
testRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const TestRequest = mongoose.model('TestRequest', testRequestSchema);

export default TestRequest; 