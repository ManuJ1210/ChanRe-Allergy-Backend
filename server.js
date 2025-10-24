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
import sessionRoutes from './routes/sessionRoutes.js';
import loginHistoryRoutes from './routes/loginHistoryRoutes.js';
import reassignedPatientRoutes from './routes/reassignedPatientRoutes.js';
import reassignRoutes from './routes/reassignRoutes.js';
import reassignedInvoiceRoutes from './routes/reassignedInvoiceRoutes.js';
import reassignmentBillingRoutes from './routes/reassignmentBillingRoutes.js';
import paymentLogRoutes from './routes/paymentLogRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import patientAppointmentRoutes from './routes/patientAppointmentRoutes.js';
import workingHoursRoutes from './routes/workingHoursRoutes.js';
import accountantRoutes from './routes/accountantRoutes.js';
import labTestRoutes from './routes/labTestRoutes.js';
import emailTestRoutes from './routes/emailTestRoutes.js';
import receiptTransactionRoutes from './routes/receiptTransactionRoutes.js';
import consultationTransactionRoutes from './routes/consultationTransactionRoutes.js';
import reassignmentTransactionRoutes from './routes/reassignmentTransactionRoutes.js';
import unifiedTransactionRoutes from './routes/unifiedTransactionRoutes.js';
import manualTransactionRoutes from './routes/manualTransactionRoutes.js';


dotenv.config();

const app = express();

// CORS configuration for development and production
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://127.0.0.1:5173',
      'https://chanreallergyclinic.com',
      'https://www.chanreallergyclinic.com',
      'https://api.chanreallergyclinic.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Handle preflight requests
app.options('*', cors());

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
app.use('/api/reassignment-billing', reassignmentBillingRoutes);
app.use('/api/payment-logs', paymentLogRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/login-history', loginHistoryRoutes);
app.use('/api/reassigned-patients', reassignedPatientRoutes);
app.use('/api/patients', reassignRoutes);
app.use('/api/reassigned-invoices', reassignedInvoiceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patient-appointments', patientAppointmentRoutes);
app.use('/api/working-hours', workingHoursRoutes);
app.use('/api/accountants', accountantRoutes);
app.use('/api/lab-tests', labTestRoutes);
app.use('/api/email-test', emailTestRoutes);
app.use('/api/receipt-transactions', receiptTransactionRoutes);
app.use('/api/consultation-transactions', consultationTransactionRoutes);
app.use('/api/reassignment-transactions', reassignmentTransactionRoutes);
app.use('/api/transactions', unifiedTransactionRoutes);
app.use('/api/manual-transactions', manualTransactionRoutes);


// Database connection check middleware (only for API routes that need database)
app.use('/api/auth', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database connection not available',
      error: 'Please ensure MongoDB is running'
    });
  }
  next();
});

app.use('/api/login-history', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database connection not available',
      error: 'Please ensure MongoDB is running'
    });
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Use environment variable or fallback to local MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/chenre-allergy';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  connectTimeoutMS: 5000, // Give up initial connection after 5 seconds
})
.then(() => console.log('MongoDB connected'))
.catch((err) => {
  console.error('MongoDB connection failed:', err.message);
  console.log('⚠️  Server will continue without database connection');
  console.log('⚠️  Please install MongoDB to enable full functionality');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
