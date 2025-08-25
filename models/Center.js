import mongoose from 'mongoose';

const centerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  address: {
    type: String
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  phone: {
    type: String
  },
  code: {
    type: String,
    unique: true,
    required: true
  },
  centerAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Center = mongoose.model('Center', centerSchema);
export default Center;