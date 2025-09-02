// server.js (ES Module version)
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { protect } from './middleware/authMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import centerRoutes from './routes/centerRoutes.js';
import centerAdminRoutes from './routes/centerAdminRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import receptionistRoutes from './routes/receptionistRoutes.js';
import superAdminDoctorRoutes from './routes/superAdminDoctorRoutes.js';

import medicationRoutes from './routes/medicationRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import allergicRhinitisRoutes from './routes/allergicRhinitisRoutes.js';
import atopicDermatitisRoutes from './routes/atopicDermatitisRoutes.js';
import allergicConjunctivitisRoutes from './routes/allergicConjunctivitisRoutes.js';
import allergicBronchitisRoutes from './routes/allergicBronchitisRoutes.js';
import gpeRoutes from './routes/gpeRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import labStaffRoutes from './routes/labStaffRoutes.js';
import testRequestRoutes from './routes/testRequestRoutes.js';
import labReportsRoutes from './routes/labReportsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import billingRoutes from './routes/billingRoutes.js';


dotenv.config();

const app = express();

// Simple CORS configuration for development
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));
app.use('/uploads/receipts', express.static('uploads/receipts'));
// Serve files by filename for history report viewing compatibility
app.get('/api/files/:filename', (req, res) => {
  const { filename } = req.params;
  if (!filename) return res.status(400).json({ message: 'Filename is required' });
  return res.sendFile(filename, { root: 'uploads' }, (err) => {
    if (err) return res.status(404).json({ message: 'File not found' });
  });
});

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Debug endpoint to test server health
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running and healthy'
  });
});

// Debug endpoint to test authentication
app.get('/api/debug/auth', protect, (req, res) => {
  res.json({
    message: 'Authentication debug info',
    user: {
      id: req.user._id,
      role: req.user.role,
      userType: req.user.userType,
      centerId: req.user.centerId,
      name: req.user.name,
      username: req.user.username
    },
    headers: {
      authorization: req.headers.authorization ? 'Bearer [TOKEN]' : 'No token',
      contentType: req.headers['content-type']
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/center-admins', centerAdminRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/receptionists', receptionistRoutes);
app.use('/api/superadmin/doctors', superAdminDoctorRoutes);

app.use('/api/medications', medicationRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/allergic-rhinitis', allergicRhinitisRoutes);
app.use('/api/atopic-dermatitis', atopicDermatitisRoutes);
app.use('/api/allergic-conjunctivitis', allergicConjunctivitisRoutes);
app.use('/api/allergic-bronchitis', allergicBronchitisRoutes);
app.use('/api/gpe', gpeRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/lab-staff', labStaffRoutes);
app.use('/api/test-requests', testRequestRoutes);
app.use('/api/lab-reports', labReportsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/billing', billingRoutes);


// Use environment variable or fallback to local MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/chenre-allergy';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection failed:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
