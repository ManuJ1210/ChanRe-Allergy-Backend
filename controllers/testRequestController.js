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
              status: { $in: ['Completed', 'Report_Sent'] },
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
            { 'billing.status': { $in: ['paid', 'partially_paid'] } }, // Include both fully paid and partially paid bills
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
                  'Completed'                // Completed status
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
              'Completed',              // Completed status
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

    // ✅ NEW: Send notifications to superadmin, superadmin consultant, center admin, and center receptionists
    try {
      // Import Notification model dynamically to avoid circular dependencies
      const Notification = (await import('../models/Notification.js')).default;
      
      // 1. Find superadmin users
      const superadmins = await User.find({ 
        role: 'superadmin', 
        isSuperAdminStaff: true,
        isDeleted: { $ne: true }
      });
      
      // 2. Find superadmin consultants
      const SuperAdminDoctor = (await import('../models/SuperAdminDoctor.js')).default;
      const superadminConsultants = await SuperAdminDoctor.find({ 
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
      
      // Create notifications for superadmin consultants (status visibility only)
      for (const superadminConsultant of superadminConsultants) {
        const notification = new Notification({
          recipient: superadminConsultant._id,
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
        console.log(`✅ Notification sent to superadmin consultant: ${superadminConsultant.name}`);
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

    const testRequest = await TestRequest.findById(id)
      .populate('patientId', 'name phone address age gender');
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // ✅ New: Ensure billing is paid before lab assignment
    const allowedBillingStatuses = ['paid', 'payment_received', 'partially_paid'];
    if (testRequest.status !== 'Billing_Paid' || !testRequest.billing || !allowedBillingStatuses.includes(testRequest.billing.status)) {
      return res.status(400).json({
        message: 'Billing must be marked as paid before assigning to lab',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        requiredBillingStatuses: allowedBillingStatuses
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
        message: `Lab staff ${assignedLabStaffName} has been assigned to your test request for ${testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'}. Test is now in progress.`,
        data: {
          testRequestId: testRequest._id,
          patientId: testRequest.patientId,
          patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
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

    console.log('🚀 scheduleSampleCollection called with:', {
      testRequestId: id,
      requestBody: req.body,
      user: req.user?.username || req.user?.id,
      userRole: req.user?.role
    });

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      console.log('❌ Test request not found:', id);
      return res.status(404).json({ message: 'Test request not found' });
    }

    console.log('📋 Test request found:', {
      testRequestId: id,
      status: testRequest.status,
      billingStatus: testRequest.billing?.status || 'not_generated',
      assignedLabStaffId: testRequest.assignedLabStaffId,
      workflowStage: testRequest.workflowStage
    });

    // ✅ Check if billing is completed before scheduling sample collection
    // Allow multiple billing statuses that indicate billing is complete
    const allowedBillingStatuses = ['payment_received', 'paid', 'generated', 'partially_paid'];
    if (!testRequest.billing || !allowedBillingStatuses.includes(testRequest.billing.status)) {
      console.log('❌ Billing validation failed:', {
        testRequestId: id,
        billingStatus: testRequest.billing?.status || 'not_generated',
        currentStatus: testRequest.status,
        allowedStatuses: allowedBillingStatuses
      });
      
      return res.status(400).json({
        message: 'Cannot schedule sample collection. Billing must be completed first.',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        requiredStatuses: allowedBillingStatuses
      });
    }

    console.log('✅ Billing validation passed:', {
      testRequestId: id,
      billingStatus: testRequest.billing.status,
      currentStatus: testRequest.status
    });

    // Check if lab staff is assigned (required for sample collection)
    if (!testRequest.assignedLabStaffId) {
      console.log('❌ Lab staff assignment validation failed:', {
        testRequestId: id,
        assignedLabStaffId: testRequest.assignedLabStaffId,
        currentStatus: testRequest.status
      });
      
      return res.status(400).json({
        message: 'Cannot schedule sample collection. Lab staff must be assigned first.',
        currentStatus: testRequest.status,
        labStaffAssigned: false
      });
    }

    // Check if test request is in a valid status for scheduling collection
    const allowedStatuses = ['Billing_Generated', 'Billing_Paid', 'Assigned', 'Superadmin_Approved'];
    if (!allowedStatuses.includes(testRequest.status)) {
      console.log('❌ Status validation failed:', {
        testRequestId: id,
        currentStatus: testRequest.status,
        allowedStatuses
      });
      
      return res.status(400).json({
        message: 'Cannot schedule sample collection. Test request must be in a valid status for collection scheduling.',
        currentStatus: testRequest.status,
        allowedStatuses
      });
    }

    console.log('✅ Status validation passed:', {
      testRequestId: id,
      currentStatus: testRequest.status
    });

    // Validate required fields from request body
    if (!sampleCollectorId || !sampleCollectionScheduledDate) {
      console.log('❌ Required fields validation failed:', {
        testRequestId: id,
        sampleCollectorId,
        sampleCollectionScheduledDate,
        sampleCollectorName
      });
      
      return res.status(400).json({
        message: 'Sample collector ID and scheduled date are required.',
        missingFields: {
          sampleCollectorId: !sampleCollectorId,
          sampleCollectorName: !sampleCollectorName,
          sampleCollectionScheduledDate: !sampleCollectionScheduledDate
        }
      });
    }

    console.log('✅ Required fields validation passed:', {
      testRequestId: id,
      sampleCollectorId,
      sampleCollectorName,
      sampleCollectionScheduledDate
    });

    console.log('✅ Lab staff assignment validation passed:', {
      testRequestId: id,
      assignedLabStaffId: testRequest.assignedLabStaffId,
      currentStatus: testRequest.status
    });

    console.log('📝 Updating test request with sample collection data:', {
      testRequestId: id,
      sampleCollectorId,
      sampleCollectorName,
      sampleCollectionScheduledDate,
      sampleCollectionNotes
    });

    testRequest.sampleCollectorId = sampleCollectorId;
    testRequest.sampleCollectorName = sampleCollectorName;
    testRequest.sampleCollectionScheduledDate = sampleCollectionScheduledDate;
    testRequest.sampleCollectionNotes = sampleCollectionNotes;
    testRequest.sampleCollectionStatus = 'Scheduled';
    testRequest.status = 'Sample_Collection_Scheduled';
    testRequest.updatedAt = new Date();

    console.log('💾 Saving updated test request...');
    const updatedTestRequest = await testRequest.save();
    console.log('✅ Test request saved successfully');
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone');

    console.log('🎉 Sample collection scheduled successfully:', {
      testRequestId: id,
      newStatus: 'Sample_Collection_Scheduled',
      sampleCollectorId,
      sampleCollectorName
    });

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

    console.log('🚀 updateSampleCollectionStatus called with:', {
      testRequestId: id,
      requestBody: req.body,
      user: req.user?.username || req.user?.id,
      userRole: req.user?.role,
      userCenterId: req.user?.centerId,
      userType: req.user?.userType
    });

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      console.log('❌ Test request not found:', id);
      return res.status(404).json({ message: 'Test request not found' });
    }
    
    console.log('📋 Found test request:', {
      id: testRequest._id,
      status: testRequest.status,
      sampleCollectionStatus: testRequest.sampleCollectionStatus,
      centerId: testRequest.centerId,
      doctorId: testRequest.doctorId,
      patientId: testRequest.patientId
    });

    console.log('📝 Updating test request with collection data:', {
      testRequestId: id,
      sampleCollectionStatus,
      sampleCollectionActualDate,
      sampleCollectionNotes
    });

    testRequest.sampleCollectionStatus = sampleCollectionStatus;
    if (sampleCollectionActualDate) {
      testRequest.sampleCollectionActualDate = sampleCollectionActualDate;
      console.log('📅 Set actual collection date:', sampleCollectionActualDate);
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

    console.log('💾 Saving updated test request...');
    console.log('📝 Test request before save:', {
      id: testRequest._id,
      status: testRequest.status,
      sampleCollectionStatus: testRequest.sampleCollectionStatus,
      sampleCollectionActualDate: testRequest.sampleCollectionActualDate,
      sampleCollectionNotes: testRequest.sampleCollectionNotes
    });
    
    const updatedTestRequest = await testRequest.save();
    console.log('✅ Test request saved successfully');
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('sampleCollectorId', 'staffName phone');

    console.log('🎉 Sample collection status updated successfully:', {
      testRequestId: id,
      newStatus: testRequest.status,
      sampleCollectionStatus,
      sampleCollectionActualDate
    });

    // ✅ NEW: Send notification to doctor when sample collection is completed
    if (sampleCollectionStatus === 'Completed') {
      try {
        const Notification = (await import('../models/Notification.js')).default;
        const notification = new Notification({
          recipient: testRequest.doctorId,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Sample Collection Completed',
          message: `Sample collection has been completed for ${testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'} - ${testRequest.testType || 'Unknown Test'}. Sample is now ready for lab testing.`,
          data: {
            testRequestId: testRequest._id,
            patientId: testRequest.patientId,
            patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
            testType: testRequest.testType || 'Unknown Test',
            status: 'Sample_Collected',
            sampleCollectionDate: sampleCollectionActualDate,
            collectorName: req.user.staffName || req.user.name
          },
          read: false
        });
        await notification.save();
        console.log('✅ Notification sent to doctor about sample collection completion');
      } catch (notificationError) {
        console.error('⚠️ Error sending notification to doctor:', notificationError);
      }
    }

    res.status(200).json({
      message: 'Sample collection status updated successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('❌ Error updating sample collection status:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Check for specific error types
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    if (error.name === 'CastError') {
      console.error('Cast error for field:', error.path);
      return res.status(400).json({ 
        message: 'Invalid data format', 
        field: error.path 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to update sample collection status',
      error: error.message 
    });
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
    const allowedBillingStatuses = ['paid', 'payment_received', 'partially_paid'];
    if (testRequest.status !== 'Sample_Collected' || !testRequest.billing || !allowedBillingStatuses.includes(testRequest.billing.status)) {
      return res.status(400).json({
        message: 'Cannot start lab testing. Billing must be completed and sample collection must be done first.',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        sampleCollected: testRequest.status === 'Sample_Collected',
        requiredBillingStatuses: allowedBillingStatuses
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

    // ✅ NEW: Send notification to doctor when lab testing starts
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const notification = new Notification({
        recipient: testRequest.doctorId,
        sender: req.user.id || req.user._id,
        type: 'test_request',
        title: 'Lab Testing Started',
        message: `Lab testing has started for ${testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'} - ${testRequest.testType || 'Unknown Test'}. Testing is now in progress.`,
        data: {
          testRequestId: testRequest._id,
          patientId: testRequest.patientId,
          patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
          testType: testRequest.testType || 'Unknown Test',
          status: 'In_Lab_Testing',
          labTechnicianName: labTechnicianName,
          testingStartDate: testRequest.testingStartDate
        },
        read: false
      });
      await notification.save();
      console.log('✅ Notification sent to doctor about lab testing start');
    } catch (notificationError) {
      console.error('⚠️ Error sending notification to doctor:', notificationError);
    }

    res.status(200).json({
      message: 'Lab testing started successfully',
      testRequest: populatedTestRequest
    });
  } catch (error) {
    console.error('Error starting lab testing:', error);
    res.status(500).json({ message: 'Failed to start lab testing' });
  }
};

// Complete lab testing with PDF upload
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

    console.log('🚀 completeLabTesting called with:', {
      testRequestId: id,
      requestBody: req.body,
      uploadedFile: req.file,
      user: req.user?.username || req.user?.id,
      userRole: req.user?.role
    });

    const testRequest = await TestRequest.findById(id);
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // ✅ NEW: Check if billing is completed and lab testing is in progress before completing
    const allowedBillingStatuses = ['paid', 'payment_received', 'partially_paid'];
    if (testRequest.status !== 'In_Lab_Testing' || !testRequest.billing || !allowedBillingStatuses.includes(testRequest.billing.status)) {
      return res.status(400).json({
        message: 'Cannot complete lab testing. Billing must be completed and lab testing must be in progress first.',
        currentStatus: testRequest.status,
        billingStatus: testRequest.billing?.status || 'not_generated',
        labTestingInProgress: testRequest.status === 'In_Lab_Testing',
        requiredBillingStatuses: allowedBillingStatuses
      });
    }

    // Handle uploaded PDF file
    if (req.file) {
      console.log('📁 PDF file uploaded:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
      
      // Store the uploaded file information
      testRequest.reportFile = req.file.filename; // Store the filename for file access
      testRequest.reportFilePath = req.file.path; // Store the full path for backend processing
      
      console.log('📁 File information stored:', {
        reportFile: testRequest.reportFile,
        reportFilePath: testRequest.reportFilePath
      });
      testRequest.reportGeneratedDate = new Date();
      testRequest.reportGeneratedBy = req.user.id || req.user._id;
      testRequest.reportGeneratedByName = req.user.staffName || req.user.name;
    } else {
      console.log('⚠️ No PDF file uploaded - only notes will be saved');
    }

    // Map frontend field names to model field names
    testRequest.testingNotes = labTestingNotes || ''; // Map to correct field name
    testRequest.testingEndDate = new Date(); // Set current date
    testRequest.labTestingCompletedDate = new Date(); // Set current date
    
    // Set the lab technician who completed the testing
    testRequest.labTechnicianId = req.user.id || req.user._id;
    testRequest.labTechnicianName = req.user.staffName || req.user.name;
    
    // Update status and workflow stage to allow progression to send report
    if (req.file) {
      testRequest.status = 'Report_Generated'; // Mark as report generated when PDF is uploaded
      testRequest.workflowStage = 'report_generation'; // Set workflow to report generation stage
      console.log('✅ Status updated to Report_Generated and workflow to report_generation due to PDF upload');
    } else {
      testRequest.status = 'Testing_Completed'; // Fallback if no PDF
      testRequest.workflowStage = 'lab_testing'; // Keep in lab testing stage if no PDF
      console.log('✅ Status updated to Testing_Completed (no PDF uploaded)');
    }
    
    testRequest.updatedAt = new Date();

    console.log('💾 Saving updated test request...');
    const updatedTestRequest = await testRequest.save();
    console.log('✅ Test request saved successfully');
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('labTechnicianId', 'staffName phone');

    console.log('🎉 Lab report uploaded and testing completed successfully:', {
      testRequestId: id,
      newStatus: testRequest.status,
      workflowStage: testRequest.workflowStage,
      pdfFilename: req.file?.filename || 'None',
      hasNotes: !!labTestingNotes,
      readyForReportSending: testRequest.status === 'Report_Generated' && testRequest.workflowStage === 'report_generation'
    });

    // ✅ NEW: Send notification to doctor when lab report is generated
    if (testRequest.status === 'Report_Generated') {
      try {
        const Notification = (await import('../models/Notification.js')).default;
        const notification = new Notification({
          recipient: testRequest.doctorId,
          sender: req.user.id || req.user._id,
          type: 'test_request',
          title: 'Lab Report Generated',
          message: `Lab report has been generated for ${testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'} - ${testRequest.testType || 'Unknown Test'}. Report is ready to be sent.`,
          data: {
            testRequestId: testRequest._id,
            patientId: testRequest.patientId,
            patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
            testType: testRequest.testType || 'Unknown Test',
            status: 'Report_Generated',
            labTechnicianName: req.user.staffName || req.user.name
          },
          read: false
        });
        await notification.save();
        console.log('✅ Notification sent to doctor about lab report generation');
      } catch (notificationError) {
        console.error('⚠️ Error sending notification to doctor:', notificationError);
      }
    }

    res.status(200).json({
      message: 'Lab report uploaded and testing completed successfully. Report is ready to be sent.',
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
    
    // Check if this test was completed via direct upload - if so, don't change status
    if (testRequest.directUploadCompleted && testRequest.status === 'Completed') {
      console.log('⚠️ Test was completed via direct upload - keeping status as Completed');
      // Don't change the status, just update the report generation information
    } else {
      testRequest.status = 'Report_Generated'; // Only change status if not completed via direct upload
      console.log('✅ Status updated to Report_Generated for traditional workflow');
    }
    
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
    
    console.log('🚀 sendReportToDoctor called with:', {
      testRequestId: id,
      requestBody: req.body,
      user: req.user?.username || req.user?.id,
      userRole: req.user?.role
    });
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

    // Check if the test request is in the correct status for sending report
    if (testRequest.status !== 'Report_Generated') {
      return res.status(400).json({
        message: 'Cannot send report. Test request must be in "Report Generated" status.',
        currentStatus: testRequest.status,
        requiredStatus: 'Report_Generated'
      });
    }

    // Check if report file exists
    if (!testRequest.reportFile && !testRequest.reportFilePath) {
      return res.status(400).json({
        message: 'Cannot send report. No report file found.',
        reportFile: testRequest.reportFile,
        reportFilePath: testRequest.reportFilePath
      });
    }

    console.log('📋 Test request before sending report:', {
      id: testRequest._id,
      status: testRequest.status,
      workflowStage: testRequest.workflowStage,
      reportFile: testRequest.reportFile,
      reportFilePath: testRequest.reportFilePath,
      doctorEmail: testRequest.doctorId?.email,
      doctorName: testRequest.doctorId?.name
    });

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
    // Update status to Report_Sent when sending the report
    testRequest.status = 'Report_Sent';
    testRequest.workflowStage = 'completed'; // Mark workflow as completed when report is sent
    console.log('✅ Status updated to Report_Sent and workflow to completed');
    
    testRequest.updatedAt = new Date();

    const updatedTestRequest = await testRequest.save();
    
    const populatedTestRequest = await TestRequest.findById(updatedTestRequest._id)
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .populate('assignedLabStaffId', 'staffName phone')
      .populate('reportGeneratedBy', 'staffName');

    // ✅ NEW: Send notification to doctor when report is sent
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const notification = new Notification({
        recipient: testRequest.doctorId,
        sender: req.user.id || req.user._id,
        type: 'test_request',
        title: 'Lab Report Sent',
        message: `Lab report has been sent to you for ${testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient'} - ${testRequest.testType || 'Unknown Test'}. Sent via ${sendMethod}.`,
        data: {
          testRequestId: testRequest._id,
          patientId: testRequest.patientId,
          patientName: testRequest.patientName || testRequest.patientId?.name || 'Unknown Patient',
          testType: testRequest.testType || 'Unknown Test',
          status: 'Report_Sent',
          sendMethod: sendMethod,
          sentBy: req.user.staffName || req.user.name,
          sentDate: testRequest.reportSentDate
        },
        read: false
      });
      await notification.save();
      console.log('✅ Notification sent to doctor about report delivery');
    } catch (notificationError) {
      console.error('⚠️ Error sending notification to doctor:', notificationError);
    }

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
    console.log(`[DOWNLOAD DEBUG] Attempting to download report for test request ID: ${id}`);
    
    const testRequest = await TestRequest.findById(id);
    
    if (!testRequest) {
      console.log(`[DOWNLOAD DEBUG] Test request not found for ID: ${id}`);
      return res.status(404).json({ message: 'Test request not found' });
    }

    console.log(`[DOWNLOAD DEBUG] Test request found:`, {
      id: testRequest._id,
      status: testRequest.status,
      reportFilePath: testRequest.reportFilePath,
      reportGeneratedDate: testRequest.reportGeneratedDate
    });

    // Check if test request is eligible for report download
    const validStatuses = ['Report_Generated', 'Report_Sent', 'Completed', 'feedback_sent'];
    if (!validStatuses.includes(testRequest.status)) {
      console.log(`[DOWNLOAD DEBUG] Invalid status for download: ${testRequest.status}`);
      return res.status(400).json({ 
        message: 'Report not available for download',
        currentStatus: testRequest.status,
        requiredStatuses: validStatuses,
        suggestion: 'Report can only be downloaded after it has been generated and sent.'
      });
    }

    const reportFilePath = testRequest.reportFilePath;
    
    if (!reportFilePath) {
      console.log(`[DOWNLOAD DEBUG] No report file path found for test request: ${id}`);
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
      console.log(`Checking path: ${testPath}`);
      if (fs.existsSync(testPath)) {
        fullPath = testPath;
        console.log(`Found file at: ${fullPath}`);
        break;
      }
    }
    
    if (!fullPath) {
      console.error(`Report file not found on server. Tried paths:`, possiblePaths);
      console.error(`Test request ID: ${id}, Status: ${testRequest.status}, Report path: ${reportFilePath}`);
      console.error(`Current working directory: ${process.cwd()}`);
      console.error(`__dirname: ${__dirname}`);
      
      return res.status(404).json({ 
        message: 'Report file not found on server',
        suggestion: 'The report file may have been moved or deleted. Please contact the lab staff.',
        filePath: reportFilePath,
        currentStatus: testRequest.status,
        attemptedPaths: possiblePaths,
        debug: {
          cwd: process.cwd(),
          dirname: __dirname
        }
      });
    }

    // Validate file size and type
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      console.error(`PDF file is empty: ${fullPath}`);
      return res.status(500).json({ 
        message: 'PDF file is empty or corrupted',
        suggestion: 'Please contact the lab staff to regenerate the report.'
      });
    }
    
    console.log(`File size: ${stats.size} bytes, File path: ${fullPath}`);

    // Set proper headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="test-report-${id}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Length', stats.size);

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

// ✅ BILLING ONLY: Fetch only billing-related test requests for current receptionist's center
export const getBillingRequestsForCurrentReceptionist = async (req, res) => {
  try {
    console.log('🚀 getBillingRequestsForCurrentReceptionist called (BILLING ONLY)');
    console.log('👤 User:', req.user?.username, 'Role:', req.user?.role, 'CenterId:', req.user?.centerId);
    
    // For receptionists, we'll show billing-related test requests
    // Let's first check what statuses exist in the database
    const allStatuses = await TestRequest.distinct('status');
    console.log('📊 All available statuses in database:', allStatuses);
    
    let query = {
      isActive: true
    };
    
    // For now, let's show all requests to debug the issue
    // If receptionist has a centerId, filter by center; otherwise show all requests
    if (req.user?.centerId) {
      query.centerId = req.user.centerId;
      console.log('🏥 Filtering by centerId:', req.user.centerId);
    } else {
      console.log('🏥 No centerId found, showing all requests');
    }
    
    // First, let's get all requests to see what we have
    const allRequests = await TestRequest.find(query)
      .select('status centerId centerName')
      .lean();
    
    console.log(`📋 Found ${allRequests.length} total requests for this center`);
    console.log('📊 Status breakdown:', allRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {}));
    
    // Filter by billing-related statuses including Report_Sent
    query.status = {
      $in: [
        'Pending',              // Initial request
        'Billing_Pending',      // Ready for billing
        'Billing_Generated',    // Bill generated, awaiting payment
        'Billing_Paid',         // Payment received and verified
        'Report_Sent',          // Report sent (treat as bill paid)
        'Completed'             // Fully completed requests
      ]
    };
    
    const testRequests = await TestRequest.find(query)
      .select('testType testDescription status urgency notes centerId centerName centerCode doctorName patientName patientPhone patientAddress billing createdAt updatedAt workflowStage')
      .populate('doctorId', 'name email phone')
      .populate('patientId', 'name phone address age gender')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`✅ Found ${testRequests.length} billing-related test requests for receptionist`);
    console.log('📊 Billing status breakdown:', testRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {}));

    res.status(200).json(testRequests);
  } catch (error) {
    console.error('Error fetching billing-only receptionist data:', error);
    res.status(500).json({ message: 'Failed to fetch billing requests' });
  }
};







