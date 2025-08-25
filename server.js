// server.js (ES Module version)
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

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


dotenv.config();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://billingfrontend-sigma.vercel.app'
];
// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(
      new Error('CORS: Access denied from this origin.'),
      false
    );
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

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
