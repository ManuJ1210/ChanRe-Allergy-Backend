import TestRequest from '../models/TestRequest.js';
import Center from '../models/Center.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

// Get all lab reports for superadmin
export const getAllLabReports = async (req, res) => {
  try {
    const reports = await TestRequest.find({
      $or: [
        { status: 'Report_Generated' },
        { status: 'Report_Sent' },
        { status: 'Testing_Completed' },
        { status: 'feedback_sent' }
      ],
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null } // Only reports that have been generated
    });

    const formattedReports = reports.map(report => ({
      _id: report._id,
      patientName: report.patientId?.name || report.patientName,
      patientId: report.patientId?.centerCode || report.patientId?._id,
      centerName: report.centerId?.name || report.centerName,
      centerCode: report.centerId?.centerCode || report.centerCode,
      doctorName: report.doctorId?.name || report.doctorName,
      testType: report.testType,
      testDescription: report.testDescription,
      status: report.status,
      urgency: report.urgency,
      reportGeneratedDate: report.reportGeneratedDate,
      reportSentDate: report.reportSentDate,
      reportFile: report.reportFile,
      reportFilePath: report.reportFilePath,
      resultSummary: report.reportSummary,
      clinicalInterpretation: report.clinicalInterpretation,
      resultDetails: report.resultDetails,
      resultValues: report.resultValues,
      notes: report.notes,
      conclusion: report.conclusion,
      recommendations: report.recommendations,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));

    res.status(200).json(formattedReports);
  } catch (error) {
    console.error('Error fetching lab reports:', error);
    res.status(500).json({ message: 'Failed to fetch lab reports', error: error.message });
  }
};

// Get lab reports by center
export const getLabReportsByCenter = async (req, res) => {
  try {
    const { centerId } = req.params;
    
    const reports = await TestRequest.find({
      centerId: centerId,
      $or: [
        { status: 'Report_Generated' },
        { status: 'Report_Sent' },
        { status: 'Testing_Completed' },
        { status: 'feedback_sent' }
      ],
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null }
    })
    .populate('patientId', 'name phone centerCode')
    .populate('doctorId', 'name email')
    .populate('centerId', 'name centerCode')
    .populate('assignedLabStaffId', 'staffName')
    .populate('reportGeneratedBy', 'staffName')
    .populate('reportSentBy', 'staffName')
    .sort({ reportGeneratedDate: -1, createdAt: -1 });

    const formattedReports = reports.map(report => ({
      _id: report._id,
      patientName: report.patientId?.name || report.patientName,
      patientId: report.patientId?.centerCode || report.patientId?._id,
      centerName: report.centerId?.name || report.centerName,
      centerCode: report.centerId?.centerCode || report.centerCode,
      doctorName: report.doctorId?.name || report.doctorName,
      testType: report.testType,
      testDescription: report.testDescription,
      status: report.status,
      urgency: report.urgency,
      reportGeneratedDate: report.reportGeneratedDate,
      reportSentDate: report.reportSentDate,
      reportFile: report.reportFile,
      reportFilePath: report.reportFilePath,
      resultSummary: report.reportSummary,
      clinicalInterpretation: report.clinicalInterpretation,
      resultDetails: report.resultDetails,
      resultValues: report.resultValues,
      notes: report.notes,
      conclusion: report.conclusion,
      recommendations: report.recommendations,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));

    res.status(200).json(formattedReports);
  } catch (error) {
    console.error('Error fetching lab reports by center:', error);
    res.status(500).json({ message: 'Failed to fetch lab reports by center', error: error.message });
  }
};

// Get single lab report details
export const getLabReportById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await TestRequest.findById(id)
      .populate('patientId', 'name phone centerCode age gender')
      .populate('doctorId', 'name email phone')
      .populate('centerId', 'name centerCode address phone')
      .populate('assignedLabStaffId', 'staffName email phone')
      .populate('reportGeneratedBy', 'staffName email')
      .populate('reportSentBy', 'staffName email');

    if (!report) {
      return res.status(404).json({ message: 'Lab report not found' });
    }

    const formattedReport = {
      _id: report._id,
      patientName: report.patientId?.name || report.patientName,
      patientId: report.patientId?.centerCode || report.patientId?._id,
      patientPhone: report.patientId?.phone || report.patientPhone,
      patientAge: report.patientId?.age,
      patientGender: report.patientId?.gender,
      centerName: report.centerId?.name || report.centerName,
      centerCode: report.centerId?.centerCode || report.centerCode,
      centerAddress: report.centerId?.address,
      centerPhone: report.centerId?.phone,
      doctorName: report.doctorId?.name || report.doctorName,
      doctorEmail: report.doctorId?.email,
      doctorPhone: report.doctorId?.phone,
      testType: report.testType,
      testDescription: report.testDescription,
      status: report.status,
      urgency: report.urgency,
      notes: report.notes,
      reportGeneratedDate: report.reportGeneratedDate,
      reportSentDate: report.reportSentDate,
      reportFile: report.reportFile,
      reportFilePath: report.reportFilePath,
      reportSummary: report.reportSummary,
      clinicalInterpretation: report.clinicalInterpretation,
      resultDetails: report.resultDetails,
      resultValues: report.resultValues,
      conclusion: report.conclusion,
      recommendations: report.recommendations,
      qualityControl: report.qualityControl,
      methodUsed: report.methodUsed,
      equipmentUsed: report.equipmentUsed,
      labTechnicianName: report.assignedLabStaffId?.staffName || report.labTechnicianName,
      labTechnicianEmail: report.assignedLabStaffId?.email,
      labTechnicianPhone: report.assignedLabStaffId?.phone,
      reportGeneratedByName: report.reportGeneratedBy?.staffName || report.reportGeneratedByName,
      reportSentByName: report.reportSentBy?.staffName || report.reportSentByName,
      sendMethod: report.sendMethod,
      sentTo: report.sentTo,
      emailSubject: report.emailSubject,
      emailMessage: report.emailMessage,
      notificationMessage: report.notificationMessage,
      deliveryConfirmation: report.deliveryConfirmation,
      testResults: report.testResults,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };

    res.status(200).json(formattedReport);
  } catch (error) {
    console.error('Error fetching lab report by ID:', error);
    res.status(500).json({ message: 'Failed to fetch lab report', error: error.message });
  }
};

// Get lab reports statistics
export const getLabReportsStats = async (req, res) => {
  try {
    const totalReports = await TestRequest.countDocuments({
      $or: [
        { status: 'Report_Generated' },
        { status: 'Report_Sent' },
        { status: 'Testing_Completed' },
        { status: 'feedback_sent' }
      ],
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null }
    });

    const sentReports = await TestRequest.countDocuments({ 
      status: 'Report_Sent',
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null }
    });
    
    const generatedReports = await TestRequest.countDocuments({ 
      status: 'Report_Generated',
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null }
    });
    
    const completedTests = await TestRequest.countDocuments({ 
      status: 'Testing_Completed',
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null }
    });

    // Get reports by center
    const reportsByCenter = await TestRequest.aggregate([
      {
        $match: {
          $or: [
            { status: 'Report_Generated' },
            { status: 'Report_Sent' },
            { status: 'Testing_Completed' },
            { status: 'feedback_sent' }
          ],
          isActive: true,
          reportGeneratedDate: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$centerId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'centers',
          localField: '_id',
          foreignField: '_id',
          as: 'center'
        }
      },
      {
        $unwind: {
          path: '$center',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          centerName: { $ifNull: ['$center.name', 'Unknown Center'] },
          centerCode: { $ifNull: ['$center.centerCode', 'Unknown'] },
          count: 1
        }
      }
    ]);

    // Get reports by status
    const reportsByStatus = await TestRequest.aggregate([
      {
        $match: {
          $or: [
            { status: 'Report_Generated' },
            { status: 'Report_Sent' },
            { status: 'Testing_Completed' },
            { status: 'feedback_sent' }
          ],
          isActive: true,
          reportGeneratedDate: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get reports by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const reportsByMonth = await TestRequest.aggregate([
      {
        $match: {
          $or: [
            { status: 'Report_Generated' },
            { status: 'Report_Sent' },
            { status: 'Testing_Completed' },
            { status: 'feedback_sent' }
          ],
          isActive: true,
          reportGeneratedDate: { 
            $exists: true, 
            $ne: null,
            $gte: twelveMonthsAgo 
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$reportGeneratedDate' },
            month: { $month: '$reportGeneratedDate' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.status(200).json({
      totalReports,
      sentReports,
      generatedReports,
      completedTests,
      reportsByCenter,
      reportsByStatus,
      reportsByMonth
    });
  } catch (error) {
    console.error('Error fetching lab reports statistics:', error);
    res.status(500).json({ message: 'Failed to fetch lab reports statistics', error: error.message });
  }
};

// Get lab reports for a specific doctor
export const getLabReportsForDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const reports = await TestRequest.find({
      doctorId: doctorId,
      $or: [
        { status: 'Report_Generated' },
        { status: 'Report_Sent' },
        { status: 'Testing_Completed' },
        { status: 'feedback_sent' }
      ],
      isActive: true,
      reportGeneratedDate: { $exists: true, $ne: null }
    })
    .populate('patientId', 'name phone centerCode')
    .populate('doctorId', 'name email')
    .populate('centerId', 'name centerCode')
    .populate('assignedLabStaffId', 'staffName')
    .populate('reportGeneratedBy', 'staffName')
    .populate('reportSentBy', 'staffName')
    .sort({ reportSentDate: -1, reportGeneratedDate: -1, createdAt: -1 });

    const formattedReports = reports.map(report => ({
      _id: report._id,
      patientName: report.patientId?.name || report.patientName,
      patientId: report.patientId?.centerCode || report.patientId?._id,
      centerName: report.centerId?.name || report.centerName,
      centerCode: report.centerId?.centerCode || report.centerCode,
      doctorName: report.doctorId?.name || report.doctorName,
      testType: report.testType,
      testDescription: report.testDescription,
      status: report.status,
      urgency: report.urgency,
      reportGeneratedDate: report.reportGeneratedDate,
      reportSentDate: report.reportSentDate,
      reportFile: report.reportFile,
      reportFilePath: report.reportFilePath,
      resultSummary: report.reportSummary,
      clinicalInterpretation: report.clinicalInterpretation,
      testResults: report.testResults,
      conclusion: report.conclusion,
      recommendations: report.recommendations,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));

    res.status(200).json(formattedReports);
  } catch (error) {
    console.error('Error fetching lab reports for doctor:', error);
    res.status(500).json({ message: 'Failed to fetch lab reports for doctor', error: error.message });
  }
};