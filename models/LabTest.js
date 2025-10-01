import mongoose from 'mongoose';

const labTestSchema = new mongoose.Schema({
  testCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  description: {
    type: String,
    trim: true
  },
  sampleType: {
    type: String,
    trim: true
  },
  preparationRequired: {
    type: String,
    trim: true
  },
  reportDeliveryTime: {
    type: String,
    trim: true,
    default: '24-48 hours'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster searching
labTestSchema.index({ testName: 'text', testCode: 'text' });
labTestSchema.index({ isActive: 1 });

const LabTest = mongoose.model('LabTest', labTestSchema);

export default LabTest;

