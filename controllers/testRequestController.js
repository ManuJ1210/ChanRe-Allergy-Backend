import TestRequest from '../models/TestRequest.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Center from '../models/Center.js';
import LabStaff from '../models/LabStaff.js';
import { generateLabReportPDF } from '../utils/pdfGenerator.js';
import path from 'path';
import fs from 'fs';

// Get all test requests (for superadmin)
export const getAllTestRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, urgency, centerId, search } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (urgency && urgency !== 'all') {
      query.urgency = urgency;
    }
    
    if (centerId && centerId !== 'all') {
      query.centerId = centerId;
    }
    
    if (search) {
      query.$or = [
        { testType: { $regex: search, $options: 'i' } },
        { 'patientId.name': { $regex: search, $options: 'i' } },
        { 'doctorId.name': { $regex: search, $options: 'i' } },
        { 'centerId.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const total = await TestRequest.countDocuments(query);
    
    // Get test requests with pagination
    const testRequests = await TestRequest.find(query)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .populate('centerId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      testRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all test requests:', error);
    res.status(500).json({ message: 'Failed to fetch test requests', error: error.message });
  }
};

// Get pending test requests
export const getPendingTestRequests = async (req, res) => {
  try {
    const testRequests = await TestRequest.find({ 
      status: { $in: ['Pending', 'Assigned'] },
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .sort({ createdAt: -1 });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching pending test requests:', error);
    res.status(500).json({ message: 'Failed to fetch pending test requests' });
  }
};

// Get completed test requests
export const getCompletedTestRequests = async (req, res) => {
  try {
    const testRequests = await TestRequest.find({ 
      status: 'Completed',
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .populate('centerId', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching completed test requests:', error);
    res.status(500).json({ message: 'Failed to fetch completed test requests' });
  }
};

// Get test requests by doctor
export const getTestRequestsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const testRequests = await TestRequest.find({ 
      doctorId, 
      isActive: true 
    })
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .sort({ createdAt: -1 });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching test requests by doctor:', error);
    res.status(500).json({ message: 'Failed to fetch test requests' });
  }
};

// Get test requests for current doctor (authenticated)
export const getTestRequestsForCurrentDoctor = async (req, res) => {
  try {
    console.log('User object from token:', {
      id: req.user.id,
      _id: req.user._id,
      username: req.user.username,
      role: req.user.role
    });
    
    const doctorId = req.user.id || req.user._id;
    
    if (!doctorId) {
      console.log('No doctor ID found in user object');
      return res.status(400).json({ message: 'Doctor ID not found in token' });
    }
    
    console.log('Searching for test requests with doctorId:', doctorId);
    
    // Ensure doctor can only see test requests from their center
    const testRequests = await TestRequest.find({ 
      doctorId, 
      centerId: req.user.centerId, // Only test requests from same center
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .populate('reportSentBy', 'staffName')
      .sort({ createdAt: -1 });

    console.log('Found test requests:', testRequests.length);
    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching test requests for current doctor:', error);
    res.status(500).json({ message: 'Failed to fetch test requests' });
  }
};

// Get completed test requests for current doctor (authenticated)
export const getCompletedTestRequestsForCurrentDoctor = async (req, res) => {
  try {
    const doctorId = req.user.id || req.user._id;
    
    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID not found in token' });
    }
    
    // Ensure doctor can only see completed test requests from their center
    const completedTestRequests = await TestRequest.find({ 
      doctorId, 
      centerId: req.user.centerId, // Only test requests from same center
      status: { $in: ['Completed', 'Report_Sent', 'feedback_sent'] },
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .populate('reportSentBy', 'staffName')
      .sort({ reportSentDate: -1, createdAt: -1 });

    res.status(200).json(completedTestRequests);
  } catch (error) {
    console.error('Error fetching completed test requests for current doctor:', error);
    res.status(500).json({ message: 'Failed to fetch completed test requests' });
  }
};

// Get test requests by center
export const getTestRequestsByCenter = async (req, res) => {
  try {
    const { centerId } = req.params;
    
    const testRequests = await TestRequest.find({ 
      centerId, 
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .sort({ createdAt: -1 });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching test requests by center:', error);
    res.status(500).json({ message: 'Failed to fetch test requests' });
  }
};

// Get test requests by lab staff
export const getTestRequestsByLabStaff = async (req, res) => {
  try {
    const { labStaffId } = req.params;
    
    const testRequests = await TestRequest.find({ 
      assignedLabStaffId: labStaffId, 
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .sort({ createdAt: -1 });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching test requests by lab staff:', error);
    res.status(500).json({ message: 'Failed to fetch test requests' });
  }
};

// Get test requests for current lab staff (authenticated)
export const getTestRequestsForCurrentLabStaff = async (req, res) => {
  try {
    console.log('Lab staff user object from token:', {
      id: req.user.id,
      _id: req.user._id,
      username: req.user.username,
      role: req.user.role
    });
    
    const labStaffId = req.user.id || req.user._id;
    
    if (!labStaffId) {
      console.log('No lab staff ID found in user object');
      return res.status(400).json({ message: 'Lab staff ID not found in token' });
    }
    
    console.log('Searching for test requests with labStaffId:', labStaffId);
    
    // ✅ NEW: Get test requests that are ready for lab processing OR completed (including all completed statuses)
    const testRequests = await TestRequest.find({ 
      isActive: true,
      $or: [
        // Option 1: Test requests with completed billing workflow
        {
          $and: [
            { billing: { $exists: true, $ne: null } },
            { 'billing.status': 'paid' },
            { 
              status: { 
                $in: [
                  'Billing_Paid',           // Ready for superadmin approval
                  'Superadmin_Approved',    // Approved and ready for lab assignment
                  'Assigned',               // Lab staff assigned
                  'Sample_Collection_Scheduled', // Sample collection scheduled
                  'Sample_Collected',       // Sample collected
                  'In_Lab_Testing',        // Lab testing in progress
                  'Testing_Completed',      // Testing completed
                  'Report_Generated',       // Report generated
                  'Report_Sent',            // Report sent to doctor
                  'Completed',              // Fully completed
                  'feedback_sent',          // Feedback sent (also completed)
                  'report_generated',       // Alternative completed status
                  'report_sent',            // Alternative completed status
                  'FEEDBACK_SENT',          // Alternative completed status
                  'Feedback_Sent'           // Alternative completed status
                ] 
              } 
            }
          ]
        },
        // Option 2: ANY completed test requests (regardless of billing status)
        {
          status: { 
            $in: [
              'Completed',              // Fully completed
              'feedback_sent',          // Feedback sent (also completed)
              'report_generated',       // Alternative completed status
              'report_sent',            // Alternative completed status
              'FEEDBACK_SENT',          // Alternative completed status
              'Feedback_Sent',          // Alternative completed status
              'Report_Generated',       // Report generated
              'Report_Sent'             // Report sent to doctor
            ] 
          }
        }
      ]
    })
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .sort({ createdAt: -1 });

    console.log('Found test requests ready for lab processing:', testRequests.length);
    
    // Log billing status breakdown for debugging
    const billingStatusCounts = {};
    testRequests.forEach(req => {
      const status = req.billing?.status || 'unknown';
      billingStatusCounts[status] = (billingStatusCounts[status] || 0) + 1;
    });
    console.log('Billing status breakdown:', billingStatusCounts);
    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching test requests for current lab staff:', error);
    res.status(500).json({ message: 'Failed to fetch test requests' });
  }
};

// Get test requests by patient
export const getTestRequestsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    console.log('Backend getTestRequestsByPatient: received patientId:', patientId, typeof patientId);
    
    const testRequests = await TestRequest.find({ 
      patientId, 
      isActive: true 
    })
      .populate('doctorId', 'name email phone')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName')
      .sort({ createdAt: -1 });

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching test requests by patient:', error);
    res.status(500).json({ message: 'Failed to fetch test requests' });
  }
};

// Get test request by ID
export const getTestRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const testRequest = await TestRequest.findById(id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName');

    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    res.status(200).json(testRequest);
  } catch (error) {
    console.error('Error fetching test request by ID:', error);
    res.status(500).json({ message: 'Failed to fetch test request' });
  }
};

// Create new test request
export const createTestRequest = async (req, res) => {
  try {
    console.log('createTestRequest called with body:', req.body);
    const {
      doctorId,
      patientId,
      testType,
      testDescription,
      urgency,
      notes
    } = req.body;
    console.log('Extracted data:', { doctorId, patientId, testType, testDescription, urgency, notes });

    // Get doctor information - check both User and Doctor models
    console.log('Looking for doctor with ID:', doctorId);
    let doctor = await User.findById(doctorId);
    let doctorModel = 'User';
    
    if (!doctor) {
      // Try Doctor model if not found in User model
      const Doctor = (await import('../models/Docter.js')).default; // Note: filename is Docter.js
      doctor = await Doctor.findById(doctorId);
      doctorModel = 'Doctor';
      console.log('Doctor found in Doctor model:', doctor ? 'YES' : 'NO');
    } else {
      console.log('Doctor found in User model:', doctor ? 'YES' : 'NO');
    }
    
    if (!doctor) {
      console.log('Doctor not found in either User or Doctor model for ID:', doctorId);
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    console.log(`Doctor found in ${doctorModel} model:`, doctor.name || doctor.doctorName);

    // Get patient information
    console.log('Looking for patient with ID:', patientId);
    const patient = await Patient.findById(patientId);
    console.log('Patient found:', patient);
    if (!patient) {
      console.log('Patient not found for ID:', patientId);
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get center information from patient
    const center = await Center.findById(patient.centerId);
    console.log('Center found:', center);

    // Create new test request
    const newTestRequest = new TestRequest({
      doctorId,
      patientId,
      testType,
      testDescription,
      urgency: urgency || 'Normal',
      notes,
      centerId: patient.centerId,
      centerName: center ? center.name : 'Unknown Center',
      centerCode: center ? center.code : 'Unknown',
      doctorName: doctor.name || doctor.doctorName,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientAddress: patient.address,
      // New flow: send to center receptionist for billing first
      status: 'Billing_Pending',
      workflowStage: 'billing',
      billing: { status: 'not_generated' },
      superadminReview: {
        status: 'pending',
        approvedForLab: false
      }
    });

    const savedTestRequest = await newTestRequest.save();
    console.log('Test request saved:', savedTestRequest);

    // ✅ NEW: Send notifications to superadmin, superadmin doctor, center admin, and center receptionists
    try {
      // Import Notification model dynamically to avoid circular dependencies
      const Notification = (await import('../models/Notification.js')).default;
      
      // 1. Find superadmin users
      const superadmins = await User.find({ 
        role: 'superadmin', 
        isSuperAdminStaff: true,
        isDeleted: { $ne: true }
      });
      
      // 2. Find superadmin doctors
      const SuperAdminDoctor = (await import('../models/SuperAdminDoctor.js')).default;
      const superadminDoctors = await SuperAdminDoctor.find({ 
        status: 'active',
        isSuperAdminStaff: true
      });
      
      // 3. Find center admin for this center
      const centerAdmins = await User.find({ 
        role: 'centeradmin', 
        centerId: patient.centerId,
        isDeleted: { $ne: true }
      });
      // 4. Find receptionists for this center
      const receptionists = await User.find({ 
        role: 'receptionist', 
        centerId: patient.centerId,
        isDeleted: { $ne: true }
      });
      
      // Create notifications for superadmins (visibility of request creation)
      for (const superadmin of superadmins) {
        const notification = new Notification({
          recipient: superadmin._id,
          sender: doctorId,
          type: 'test_request',
          title: 'New Test Request (Billing Pending)',
          message: `Dr. ${doctor.name} requested ${testType} for ${patient.name} at ${center ? center.name : 'Unknown Center'}. Awaiting billing by receptionist.`,
          data: {
            testRequestId: savedTestRequest._id,
            patientId: patient._id,
            doctorId: doctorId,
            centerId: patient.centerId,
            testType,
            urgency,
            status: 'Billing_Pending'
          },
          read: false
        });
        await notification.save();
        console.log(`✅ Notification sent to superadmin: ${superadmin.name}`);
      }
      
      // Create notifications for superadmin doctors (status visibility only)
      for (const superadminDoctor of superadminDoctors) {
        const notification = new Notification({
          recipient: superadminDoctor._id,
          sender: doctorId,
          type: 'test_request',
          title: 'New Test Request (Billing Pending)',
          message: `Dr. ${doctor.name} requested ${testType} for ${patient.name}. Awaiting billing by receptionist.`,
          data: {
            testRequestId: savedTestRequest._id,
            patientId: patient._id,
            doctorId: doctorId,
            centerId: patient.centerId,
            testType,
            urgency,
            status: 'Billing_Pending'
          },
          read: false
        });
        await notification.save();
        console.log(`✅ Notification sent to superadmin doctor: ${superadminDoctor.name}`);
      }

      // Notify center admins
      for (const admin of centerAdmins) {
        const notification = new Notification({
          recipient: admin._id,
          sender: doctorId,
          type: 'test_request',
          title: 'Test Request Awaiting Billing',
          message: `New test request (${testType}) for ${patient.name} is awaiting billing at your center.`,
          data: {
            testRequestId: savedTestRequest._id,
            patientId: patient._id,
            doctorId: doctorId,
            centerId: patient.centerId,
            status: 'Billing_Pending'
          },
          read: false
        });
        await notification.save();
        console.log(`✅ Notification sent to center admin: ${admin.name}`);
      }

      // Notify receptionists for billing action
      for (const receptionist of receptionists) {
        const notification = new Notification({
          recipient: receptionist._id,
          sender: doctorId,
          type: 'test_request',
          title: 'New Test Request - Generate Bill',
          message: `Please generate bill for ${patient.name} (${testType}).`,
          data: {
            testRequestId: savedTestRequest._id,
            patientId: patient._id,
            doctorId: doctorId,
            centerId: patient.centerId,
            status: 'Billing_Pending'
          },
          read: false
        });
        await notification.save();
        console.log(`✅ Notification sent to receptionist: ${receptionist.name}`);
      }
      
      console.log('✅ All notifications sent successfully');
    } catch (notificationError) {
      console.error('⚠️ Error sending notifications:', notificationError);
      // Don't fail the test request creation if notifications fail
    }

    // Populate the saved test request
    const populatedTestRequest = await TestRequest.findById(savedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone');

    res.status(201).json({
      message: 'Test request created. Billing pending at center receptionist.',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error creating test request:', error);
    res.status(500).json({ message: 'Failed to create test request', error: error.message });
  }
};

// Assign lab staff to test request
export const assignLabStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedLabStaffId, assignedLabStaffName } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // ✅ New: Ensure billing is paid before lab assignment
    if (testRequest.status !== 'Billing_Paid' || testRequest.billing?.status !== 'paid') {
      return res.status(400).json({
        message: 'Billing must be marked as paid before assigning to lab',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated'
      });
    }

    // Superadmin approval no longer required before lab assignment in the new billing-first workflow

    testRequest.assignedLabStaffId = assignedLabStaffId;
    testRequest.assignedLabStaffName = assignedLabStaffName;
    testRequest.status = 'Assigned';
    testRequest.workflowStage = 'lab_assignment';
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone');

    // ✅ NEW: Send notification to center doctor that lab staff has been assigned
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const notification = new Notification({
        recipient: testRequest.doctorId,
        sender: req.user.id,
        type: 'test_request',
        title: 'Lab Staff Assigned',
        message: `Lab staff ${assignedLabStaffName} has been assigned to your test request for ${testRequest.patientName}. Test is now in progress.`,
        data: {
          testRequestId: testRequest._id,
          patientId: testRequest.patientId,
          assignedLabStaffId,
          assignedLabStaffName,
          status: 'Assigned'
        },
        read: false
      });
      await notification.save();
      console.log(`✅ Notification sent to center doctor about lab staff assignment`);
    } catch (notificationError) {
      console.error('⚠️ Error sending notification to center doctor:', notificationError);
    }

    res.status(200).json({
      message: 'Lab staff assigned successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error assigning lab staff:', error);
    res.status(500).json({ message: 'Failed to assign lab staff', error: error.message });
  }
};

// Schedule sample collection
export const scheduleSampleCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      sampleCollectorId, 
      sampleCollectorName, 
      sampleCollectionScheduledDate,
      sampleCollectionNotes 
    } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // ✅ NEW: Check if billing is completed and lab staff is assigned before scheduling sample collection
    if (testRequest.status !== 'Assigned' || testRequest.billing?.status !== 'paid') {
      return res.status(400).json({
        message: 'Cannot schedule sample collection. Billing must be completed and lab staff must be assigned first.',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        labStaffAssigned: !!testRequest.assignedLabStaffId
      });
    }

    testRequest.sampleCollectorId = sampleCollectorId;
    testRequest.sampleCollectorName = sampleCollectorName;
    testRequest.sampleCollectionScheduledDate = sampleCollectionScheduledDate;
    testRequest.sampleCollectionNotes = sampleCollectionNotes;
    testRequest.sampleCollectionStatus = 'Scheduled';
    testRequest.status = 'Sample_Collection_Scheduled';
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone');

    res.status(200).json({
      message: 'Sample collection scheduled successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error scheduling sample collection:', error);
    res.status(500).json({ message: 'Failed to schedule sample collection' });
  }
};

// Update sample collection status
export const updateSampleCollectionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      sampleCollectionStatus, 
      sampleCollectionActualDate,
      sampleCollectionNotes 
    } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    testRequest.sampleCollectionStatus = sampleCollectionStatus;
    if (sampleCollectionActualDate) {
      testRequest.sampleCollectionActualDate = sampleCollectionActualDate;
    }
    if (sampleCollectionNotes) {
      testRequest.sampleCollectionNotes = sampleCollectionNotes;
    }

    // Update main status based on sample collection status
    if (sampleCollectionStatus === 'Completed') {
      testRequest.status = 'Sample_Collected';
    } else if (sampleCollectionStatus === 'In_Progress') {
      testRequest.status = 'Sample_Collection_Scheduled';
    }

    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone');

    res.status(200).json({
      message: 'Sample collection status updated successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error updating sample collection status:', error);
    res.status(500).json({ message: 'Failed to update sample collection status' });
  }
};

// Start lab testing
export const startLabTesting = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      labTechnicianId, 
      labTechnicianName,
      testingNotes 
    } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // ✅ NEW: Check if billing is completed and sample collection is done before starting lab testing
    if (testRequest.status !== 'Sample_Collected' || testRequest.billing?.status !== 'paid') {
      return res.status(400).json({
        message: 'Cannot start lab testing. Billing must be completed and sample collection must be done first.',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        sampleCollected: testRequest.status === 'Sample_Collected'
      });
    }

    testRequest.labTechnicianId = labTechnicianId;
    testRequest.labTechnicianName = labTechnicianName;
    testRequest.testingStartDate = new Date();
    testRequest.testingNotes = testingNotes;
    testRequest.status = 'In_Lab_Testing';
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone');

    res.status(200).json({
      message: 'Lab testing started successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error starting lab testing:', error);
    res.status(500).json({ message: 'Failed to start lab testing' });
  }
};

// Complete lab testing
export const completeLabTesting = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      testResults,
      labTestingNotes,
      labTestingCompletedDate,
      testParameters,
      conclusion,
      recommendations
    } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // ✅ NEW: Check if billing is completed and lab testing is in progress before completing
    if (testRequest.status !== 'In_Lab_Testing' || testRequest.billing?.status !== 'paid') {
      return res.status(400).json({
        message: 'Cannot complete lab testing. Billing must be completed and lab testing must be in progress first.',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        labTestingInProgress: testRequest.status === 'In_Lab_Testing'
      });
    }

    // Map frontend field names to model field names
    testRequest.testResults = testResults;
    testRequest.testingNotes = labTestingNotes; // Map to correct field name
    testRequest.testingEndDate = labTestingCompletedDate || new Date(); // Map to correct field name
    
    // Transform testParameters to match PDF expectations
    const resultValues = testParameters ? testParameters.map(param => ({
      parameter: param.name || param.parameter,
      value: param.value,
      unit: param.unit,
      normalRange: param.normalRange,
      status: param.status || 'Normal'
    })) : [];
    
    testRequest.resultValues = resultValues;
    testRequest.conclusion = conclusion; // Use the new field
    testRequest.recommendations = recommendations; // Use the new field
    testRequest.labTestingCompletedDate = labTestingCompletedDate || new Date(); // Use the new field
    
    // Set the lab technician who completed the testing
    testRequest.labTechnicianId = req.user.id || req.user._id;
    testRequest.labTechnicianName = req.user.staffName || req.user.name;
    
    testRequest.status = 'Testing_Completed';
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone');

    res.status(200).json({
      message: 'Lab testing completed successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error completing lab testing:', error);
    res.status(500).json({ message: 'Failed to complete lab testing' });
  }
};

export const generateTestReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reportSummary, clinicalInterpretation } = req.body;
    
    const testRequest = await TestRequest.findById(id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone');
      
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    const { filename, filepath } = await generateLabReportPDF(testRequest, { 
      reportSummary,
      clinicalInterpretation 
    });
    
    testRequest.reportGeneratedDate = new Date();
    testRequest.reportFilePath = filepath;
    testRequest.reportSummary = reportSummary;
    testRequest.clinicalInterpretation = clinicalInterpretation;
    testRequest.reportGeneratedBy = req.user.id || req.user._id;
    testRequest.reportGeneratedByName = req.user.staffName || req.user.name;
    testRequest.status = 'Report_Generated';
    
    await testRequest.save();
    
    res.status(200).json({ 
      message: 'Test report generated successfully', 
      pdfFile: filename,
      reportPath: filepath 
    });
  } catch (error) {
    console.error('Error generating test report:', error);
    res.status(500).json({ message: 'Failed to generate test report', error: error.message });
  }
};

// Send report to doctor
export const sendReportToDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sendMethod,
      emailSubject,
      emailMessage,
      notificationMessage,
      reportSentDate,
      sentTo,
      deliveryConfirmation
    } = req.body;

    const testRequest = await TestRequest.findById(id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName');
      
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Get doctor email from populated doctorId
    const doctorEmail = testRequest.doctorId?.email || testRequest.doctorEmail;
    const doctorName = testRequest.doctorId?.name || testRequest.doctorName;

    // Update test request with report sent information
    testRequest.reportSentDate = reportSentDate || new Date();
    testRequest.reportSentBy = req.user.id || req.user._id;
    testRequest.reportSentByName = req.user.staffName || req.user.name;
    testRequest.sendMethod = sendMethod;
    testRequest.emailSubject = emailSubject;
    testRequest.emailMessage = emailMessage;
    testRequest.notificationMessage = notificationMessage;
    testRequest.sentTo = sentTo || doctorName;
    testRequest.deliveryConfirmation = deliveryConfirmation;
    testRequest.status = 'Report_Sent'; // Changed from 'Completed' to 'Report_Sent'
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName');

    // Log the report sending for debugging
    console.log('Report sent successfully:', {
      testRequestId: id,
      doctorName: doctorName,
      doctorEmail: doctorEmail,
      sendMethod: sendMethod,
      status: 'Report_Sent'
    });

    res.status(200).json({
      message: 'Report sent to doctor successfully',
      testRequest: populatedTestRequest,
      doctorEmail: doctorEmail,
      doctorName: doctorName
    });
  } catch (error) {
    console.error('Error sending report to doctor:', error);
    res.status(500).json({ message: 'Failed to send report to doctor' });
  }
};

// Update test request status
export const updateTestRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    testRequest.status = status;
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone');

    res.status(200).json({
      message: 'Test request status updated successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error updating test request status:', error);
    res.status(500).json({ message: 'Failed to update test request status' });
  }
};

// Cancel test request
export const cancelTestRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    testRequest.status = 'Cancelled';
    testRequest.notes = cancellationReason ? `${testRequest.notes || ''}\nCancelled: ${cancellationReason}` : testRequest.notes;
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone');

    res.status(200).json({
      message: 'Test request cancelled successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error cancelling test request:', error);
    res.status(500).json({ message: 'Failed to cancel test request' });
  }
};

// Get test request statistics
export const getTestRequestStats = async (req, res) => {
  try {
    const stats = await TestRequest.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalRequests = await TestRequest.countDocuments({ isActive: true });
    const pendingRequests = await TestRequest.countDocuments({ 
      status: { $in: ['Pending', 'Assigned'] }, 
      isActive: true 
    });
    const completedRequests = await TestRequest.countDocuments({ 
      status: 'Completed', 
      isActive: true 
    });

    res.status(200).json({
      totalRequests,
      pendingRequests,
      completedRequests,
      statusBreakdown: stats
    });
  } catch (error) {
    console.error('Error fetching test request statistics:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
};

// Delete test request
export const deleteTestRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if the test request can be deleted (only pending or cancelled requests)
    if (testRequest.status !== 'Pending' && testRequest.status !== 'Cancelled') {
      return res.status(400).json({ 
        message: 'Cannot delete test request. Only pending or cancelled requests can be deleted.' 
      });
    }

    // Soft delete by setting isActive to false
    testRequest.isActive = false;
    testRequest.updatedAt = new Date();
    await testRequest.save();

    res.status(200).json({ 
      message: 'Test request deleted successfully',
      deletedRequest: testRequest
    });
  } catch (error) {
    console.error('Error deleting test request:', error);
    res.status(500).json({ message: 'Failed to delete test request' });
  }
};

export const checkReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const testRequest = await TestRequest.findById(id);
    
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if test request is eligible for report download
    const validStatuses = ['Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'];
    const isEligible = validStatuses.includes(testRequest.status);
    
    // Check if report file path exists
    const hasReportPath = !!testRequest.reportFilePath;
    
    // Check if file actually exists on server
    let fileExists = false;
    let fullPath = '';
    if (hasReportPath) {
      // Try multiple path resolution strategies
      let possiblePaths = [];
      
      // 1. Try the stored path as-is
      possiblePaths.push(testRequest.reportFilePath);
      
      // 2. Try resolving from current working directory
      possiblePaths.push(path.resolve(testRequest.reportFilePath));
      
      // 3. Try relative to uploads directory
      possiblePaths.push(path.join(process.cwd(), 'uploads', 'reports', path.basename(testRequest.reportFilePath)));
      
      // 4. Try relative to current directory
      possiblePaths.push(path.join('.', 'uploads', 'reports', path.basename(testRequest.reportFilePath)));
      
      // Check each possible path
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          fullPath = testPath;
          fileExists = true;
          break;
        }
      }
      
      // If no path works, use the first one for debugging
      if (!fullPath) {
        fullPath = possiblePaths[0];
      }
    }



    res.status(200).json({
      isAvailable: isEligible && hasReportPath && fileExists,
      currentStatus: testRequest.status,
      requiredStatuses: validStatuses,
      reportGeneratedDate: testRequest.reportGeneratedDate,
      reportGeneratedBy: testRequest.reportGeneratedByName,
      message: isEligible && hasReportPath && fileExists 
        ? 'Report is available for download' 
        : 'Report is not available for download'
    });

  } catch (error) {
    console.error('Error checking report status:', error);
    res.status(500).json({ message: 'Failed to check report status', error: error.message });
  }
};

export const downloadTestReport = async (req, res) => {
  try {
    const { id } = req.params;
    const testRequest = await TestRequest.findById(id);
    
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if test request is eligible for report download
    const validStatuses = ['Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'];
    if (!validStatuses.includes(testRequest.status)) {
      return res.status(400).json({ 
        message: 'Report not available for download',
        currentStatus: testRequest.status,
        requiredStatuses: validStatuses,
        suggestion: 'Report can only be downloaded after it has been generated and sent.'
      });
    }

    const reportFilePath = testRequest.reportFilePath;
    
    if (!reportFilePath) {
      return res.status(404).json({ 
        message: 'Report file path not found',
        suggestion: 'The report may not have been generated yet or the file path is missing.',
        currentStatus: testRequest.status,
        reportGeneratedDate: testRequest.reportGeneratedDate
      });
    }

    // Check if file exists using multiple path resolution strategies
    let fullPath = null;
    let possiblePaths = [];
    
    // 1. Try the stored path as-is
    possiblePaths.push(reportFilePath);
    
    // 2. Try resolving from current working directory
    possiblePaths.push(path.resolve(reportFilePath));
    
    // 3. Try relative to uploads directory
    possiblePaths.push(path.join(process.cwd(), 'uploads', 'reports', path.basename(reportFilePath)));
    
    // 4. Try relative to current directory
    possiblePaths.push(path.join('.', 'uploads', 'reports', path.basename(reportFilePath)));
    
    // Check each possible path
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        fullPath = testPath;
        break;
      }
    }
    
    if (!fullPath) {
      console.error(`Report file not found on server. Tried paths:`, possiblePaths);
      console.error(`Test request ID: ${id}, Status: ${testRequest.status}, Report path: ${reportFilePath}`);
      
      return res.status(404).json({ 
        message: 'Report file not found on server',
        suggestion: 'The report file may have been moved or deleted. Please contact the lab staff.',
        filePath: reportFilePath,
        currentStatus: testRequest.status,
        attemptedPaths: possiblePaths
      });
    }

    // Set proper headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test-report-${id}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream the PDF file
    const readStream = fs.createReadStream(fullPath);
    readStream.pipe(res);
    
    readStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming PDF file' });
      }
    });

  } catch (error) {
    console.error('Error downloading test report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download test report', error: error.message });
    }
  }
};

// ===================== Billing Workflow (Receptionist) =====================

// ✅ REAL DATA: Fetch billing-related test requests for current receptionist's center
export const getBillingRequestsForCurrentReceptionist = async (req, res) => {
  try {
    console.log('🚀 getBillingRequestsForCurrentReceptionist called (REAL DATA)');
    
    // For receptionists, we'll work with embedded data to avoid permission issues
    // Receptionists can see billing requests from their center without needing to populate sensitive patient data
    
    const billingStatuses = ['Billing_Pending', 'Billing_Generated', 'Billing_Paid'];
    let query = {
      status: { $in: billingStatuses },
      isActive: true
    };
    
    // If receptionist has a centerId, filter by center; otherwise show all billing requests
    if (req.user?.centerId) {
      query.centerId = req.user.centerId;
    }
    
    const testRequests = await TestRequest.find(query)
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorName patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${testRequests.length} real billing requests for receptionist`);

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching real receptionist billing data:', error);
    res.status(500).json({ message: 'Failed to fetch billing requests' });
  }
};

// ✅ REAL DATA: Generate bill for a test request (Receptionist action)
export const generateBillForTestRequest = async (req, res) => {
  try {
    console.log('🚀 generateBillForTestRequest called (REAL DATA) for test request:', req.params.id);
    
    const { id } = req.params;
    const { items = [], taxes = 0, discounts = 0, currency = 'INR', notes } = req.body;

    // Find the test request in database
    const testRequest = await TestRequest.findById(id).select('patientName centerId centerName centerCode _id status');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if bill already exists
    if (testRequest.billing && testRequest.billing.status !== 'not_generated') {
      return res.status(400).json({ message: 'Bill already generated for this test request' });
    }

    // Compute totals
    const itemsWithTotals = items.map((it) => ({
      name: it.name,
      code: it.code,
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.quantity || 1) * Number(it.unitPrice || 0)
    }));
    const subTotal = itemsWithTotals.reduce((sum, it) => sum + (it.total || 0), 0);
    const totalAmount = Math.max(0, subTotal + Number(taxes || 0) - Number(discounts || 0));

    // Generate a simple invoice number
    const prefix = testRequest.centerCode || testRequest.centerId?.code || 'INV';
    const invoiceNumber = `${prefix}-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${String(testRequest._id).slice(-5)}`;

    // Update test request with billing information
    testRequest.billing = {
      status: 'generated',
      amount: totalAmount,
      currency,
      items: itemsWithTotals,
      taxes: Number(taxes || 0),
      discounts: Number(discounts || 0),
      invoiceNumber,
      generatedAt: new Date(),
      generatedBy: req.user.id || req.user._id,
      notes
    };
    testRequest.status = 'Billing_Generated';
    testRequest.workflowStage = 'billing';
    testRequest.updatedAt = new Date();

    // Save to database
    const updated = await testRequest.save();

    // Notify stakeholders
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const UserModel = (await import('../models/User.js')).default;

      const recipients = await UserModel.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'centeradmin', centerId: testRequest.centerId },
          { role: 'superadmin', isSuperAdminStaff: true }
        ],
        isDeleted: { $ne: true }
      });

      for (const r of recipients) {
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Bill Generated',
          message: `Invoice ${invoiceNumber} generated for ${testRequest.patientName} - ${testRequest.testType}`,
          data: { testRequestId: testRequest._id, invoiceNumber, amount: totalAmount, status: 'Billing_Generated' },
          read: false
        });
        await n.save();
      }
    } catch (notifyErr) {
      console.error('Billing generation notification error:', notifyErr);
    }

    console.log('✅ Bill generated successfully (REAL DATA)');

    res.status(200).json({ 
      message: 'Bill generated successfully', 
      testRequest: updated 
    });
  } catch (error) {
    console.error('Error in real bill generation:', error);
    res.status(500).json({ message: 'Failed to generate bill' });
  }
};

// ✅ REAL DATA: Mark bill as paid (Receptionist action)
export const markBillPaidForTestRequest = async (req, res) => {
  try {
    console.log('🚀 markBillPaidForTestRequest called (REAL DATA) for test request:', req.params.id);
    
    const { id } = req.params;
    const { paymentNotes, paymentMethod, transactionId, receiptUpload } = req.body;

    // Find the test request in database
    const testRequest = await TestRequest.findById(id).select('patientName centerId centerName centerCode billing status');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if bill exists and is generated
    if (!testRequest.billing || testRequest.billing.status === 'not_generated') {
      return res.status(400).json({ message: 'Generate bill before marking paid' });
    }

    // Enhanced payment verification
    if (!paymentMethod || !transactionId) {
      return res.status(400).json({ 
        message: 'Payment method and transaction ID are required for verification' 
      });
    }

    // Update billing with payment details
    testRequest.billing.status = 'payment_received';
    testRequest.billing.paymentMethod = paymentMethod;
    testRequest.billing.transactionId = transactionId;
    testRequest.billing.receiptUpload = receiptUpload;
    testRequest.billing.paidAt = new Date();
    testRequest.billing.paidBy = req.user.id || req.user._id;
    testRequest.billing.verifiedBy = null; // Will be set by center admin
    testRequest.billing.verifiedAt = null;
    
    if (paymentNotes) {
      testRequest.billing.notes = [testRequest.billing.notes, paymentNotes].filter(Boolean).join('\n');
    }
    
    // Status remains as 'Billing_Generated' until verified by center admin
    testRequest.status = 'Billing_Generated';
    testRequest.updatedAt = new Date();

    // Save to database
    const updated = await testRequest.save();

    // Notify center admin for payment verification
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const UserModel = (await import('../models/User.js')).default;

      const recipients = await UserModel.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'centeradmin', centerId: testRequest.centerId },
          { role: 'superadmin', isSuperAdminStaff: true }
        ],
        isDeleted: { $ne: true }
      });

      for (const r of recipients) {
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Payment Received - Awaiting Verification',
          message: `Payment received for ${testRequest.patientName} - ${testRequest.testType}. Center admin must verify before proceeding.`,
          data: { testRequestId: testRequest._id, status: 'Billing_Generated', billingStatus: 'payment_received' },
          read: false
        });
        await n.save();
      }
    } catch (notifyErr) {
      console.error('Billing paid notification error:', notifyErr);
    }

    console.log('✅ Payment marked as received successfully (REAL DATA)');

    res.status(200).json({ 
      message: 'Payment received and recorded. Awaiting center admin verification before proceeding to lab.', 
      testRequest: updated 
    });
  } catch (error) {
    console.error('Error in real payment marking:', error);
    res.status(500).json({ message: 'Failed to mark bill paid' });
  }
};

// ✅ REAL DATA: Verify payment and approve for lab (Center Admin action)
export const verifyPaymentAndApproveForLab = async (req, res) => {
  try {
    console.log('🚀 verifyPaymentAndApproveForLab called (REAL DATA) for test request:', req.params.id);
    
    const { id } = req.params;
    const { verificationNotes } = req.body;

    // Find the test request in database
    const testRequest = await TestRequest.findById(id).select('patientName centerId centerName centerCode billing status workflowStage');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Only center admin can verify payments
    if (req.user.role !== 'centeradmin') {
      return res.status(403).json({ message: 'Only center admin can verify payments' });
    }

    // Ensure center admin can only verify payments for their center
    if (String(req.user.centerId) !== String(testRequest.centerId)) {
      return res.status(403).json({ 
        message: 'You can only verify payments for requests from your center',
        debug: {
          userCenterId: req.user.centerId,
          testRequestCenterId: testRequest.centerId,
          userRole: req.user.role,
          username: req.user.username
        }
      });
    }

    // Check if payment was received and is awaiting verification
    if (testRequest.billing?.status !== 'payment_received') {
      return res.status(400).json({ 
        message: 'Payment must be received before verification',
        currentBillingStatus: testRequest.billing?.status || 'not_generated'
      });
    }

    // Verify the payment
    testRequest.billing.status = 'paid';
    testRequest.billing.verifiedBy = req.user.id || req.user._id;
    testRequest.billing.verifiedAt = new Date();
    if (verificationNotes) {
      testRequest.billing.verificationNotes = verificationNotes;
    }
    
    // Update status to allow superadmin doctor approval
    testRequest.status = 'Billing_Paid';
    testRequest.workflowStage = 'superadmin_review';
    testRequest.updatedAt = new Date();

    // Save to database
    const updated = await testRequest.save();

    // Notify stakeholders that payment is verified and ready for lab
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const UserModel = (await import('../models/User.js')).default;
      const LabStaffModel = (await import('../models/LabStaff.js')).default;

      const recipients = await UserModel.find({
        $or: [
          { _id: testRequest.doctorId },
          { role: 'superadmin', isSuperAdminStaff: true }
        ],
        isDeleted: { $ne: true }
      });
      const labStaff = await LabStaffModel.find({ isDeleted: { $ne: true } }).lean();

      // Notify doctor and superadmin
      for (const r of recipients) {
        const n = new Notification({
          recipient: r._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Payment Verified - Ready for Lab',
          message: `Payment verified for ${testRequest.patientName} - ${testRequest.testType}. Ready for superadmin doctor approval.`,
          data: { testRequestId: testRequest._id, status: 'Billing_Paid', workflowStage: 'superadmin_review' },
          read: false
        });
        await n.save();
      }

      // Notify lab staff that a verified request is available
      for (const staff of labStaff) {
        const n = new Notification({
          recipient: staff._id,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'New Verified Test Request',
          message: `Payment verified request ready: ${testRequest.patientName} - ${testRequest.testType}`,
          data: { testRequestId: testRequest._id, status: 'Billing_Paid', workflowStage: 'superadmin_review' },
          read: false
        });
        await n.save();
      }
    } catch (notifyErr) {
      console.error('Payment verification notification error:', notifyErr);
    }

    console.log('✅ Payment verified successfully (REAL DATA)');

    res.status(200).json({ 
      message: 'Payment verified successfully. Test request is now ready for superadmin doctor approval and lab assignment.', 
      testRequest: updated 
    });
  } catch (error) {
    console.error('Error in real payment verification:', error);
    res.status(500).json({ message: 'Failed to verify payment', error: error.message });
  }
};

// ✅ REAL DATA: Get all billing data for superadmin (across all centers)
export const getAllBillingData = async (req, res) => {
  try {
    console.log('🚀 getAllBillingData called by superadmin (REAL DATA)');
    
    // Get all test requests with billing information from database
    const billingRequests = await TestRequest.find({ 
      isActive: true,
      $or: [
        { billing: { $exists: true, $ne: null } },
        { status: { $in: ['Billing_Pending', 'Billing_Generated', 'Billing_Paid'] } }
      ]
    })
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${billingRequests.length} real billing requests for superadmin`);

    res.status(200).json({
      success: true,
      billingRequests,
      total: billingRequests.length
    });
  } catch (error) {
    console.error('Error fetching real billing data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch billing data', 
      error: error.message 
    });
  }
};

// ✅ REAL DATA: Get billing data for specific center (center admin)
export const getBillingDataForCenter = async (req, res) => {
  try {
    const { centerId } = req.params;
    console.log('🚀 getBillingDataForCenter called for center (REAL DATA):', {
      centerId,
      username: req.user?.username,
      role: req.user?.role
    });
    
    if (!centerId) {
      return res.status(400).json({ 
        success: false,
        message: 'Center ID is required' 
      });
    }

    // Get test requests with billing information for specific center from database
    const billingRequests = await TestRequest.find({ 
      centerId: centerId,
      isActive: true,
      $or: [
        { billing: { $exists: true, $ne: null } },
        { status: { $in: ['Billing_Pending', 'Billing_Generated', 'Billing_Paid'] } }
      ]
    })
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorId doctorName patientId patientName patientPhone patientAddress billing createdAt updatedAt')
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${billingRequests.length} real billing requests for center ${centerId}`);

    res.status(200).json({
      success: true,
      billingRequests,
      total: billingRequests.length,
      centerId: centerId
    });
  } catch (error) {
    console.error('Error fetching real center billing data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch center billing data', 
      error: error.message 
    });
  }
};