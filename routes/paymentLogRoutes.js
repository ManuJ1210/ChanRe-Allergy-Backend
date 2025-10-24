import express from 'express';
import mongoose from 'mongoose';
import { protect, ensureCenterIsolation, checkSuperAdmin } from '../middleware/authMiddleware.js';
import { 
  getPaymentLogsForTestRequest,
  getPaymentLogsForCenter,
  getPaymentStatistics
} from '../services/paymentLogService.js';
import PaymentLog from '../models/PaymentLog.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get payment logs for a specific test request
router.get('/test-request/:testRequestId', ensureCenterIsolation, async (req, res) => {
  try {
    const { testRequestId } = req.params;
    
    const paymentLogs = await PaymentLog.find({ testRequestId })
      .populate('processedBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('patientId', 'name uhId phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      paymentLogs,
      total: paymentLogs.length
    });
  } catch (error) {
    console.error('❌ Error fetching payment logs for test request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment logs',
      error: error.message
    });
  }
});

// Get payment history for a specific patient
router.get('/patient/:patientId', ensureCenterIsolation, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { centerId } = req.user;
    
    const paymentLogs = await PaymentLog.find({ 
      patientId: new mongoose.Types.ObjectId(patientId),
      centerId: new mongoose.Types.ObjectId(centerId)
    })
      .populate('processedBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('testRequestId', 'testType testDescription workflowStage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      paymentLogs,
      total: paymentLogs.length
    });
  } catch (error) {
    console.error('❌ Error fetching payment logs for patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment logs',
      error: error.message
    });
  }
});

// Get payment logs for the current center
router.get('/center', ensureCenterIsolation, async (req, res) => {
  try {
    const { centerId } = req.user;
    const { 
      status, 
      paymentMethod, 
      dateFrom, 
      dateTo, 
      page = 1, 
      limit = 20,
      searchTerm 
    } = req.query;

    // Build query filters
    const filters = { centerId: new mongoose.Types.ObjectId(centerId) };
    
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (dateFrom && dateTo) {
      filters.createdAt = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      };
    }

    // Search functionality
    let searchQuery = {};
    if (searchTerm) {
      searchQuery = {
        $or: [
          { patientName: { $regex: searchTerm, $options: 'i' } },
          { transactionId: { $regex: searchTerm, $options: 'i' } },
          { receiptNumber: { $regex: searchTerm, $options: 'i' } },
          { invoiceNumber: { $regex: searchTerm, $options: 'i' } }
        ]
      };
    }

    const finalQuery = { ...filters, ...searchQuery };

    // Get paginated results
    const skip = (page - 1) * limit;
    const paymentLogs = await PaymentLog.find(finalQuery)
      .populate('processedBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('testRequestId', 'testType testDescription workflowStage')
      .populate('patientId', 'name uhId phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await PaymentLog.countDocuments(finalQuery);

    res.status(200).json({
      success: true,
      paymentLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching payment logs for center:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment logs',
      error: error.message
    });
  }
});

// Get payment statistics for current center
router.get('/center/statistics', ensureCenterIsolation, async (req, res) => {
  try {
    const { centerId } = req.user;
    const { dateFrom, dateTo } = req.query;

    const dateRange = dateFrom && dateTo ? { startDate: dateFrom, endDate: dateTo } : {};
    const statistics = await getPaymentStatistics(centerId, dateRange);

    res.status(200).json({
      success: true,
      statistics,
      centerId
    });
  } catch (error) {
    console.error('❌ Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
});

// Get payment logs for SuperAdmin (all centers)
router.get('/all', checkSuperAdmin, async (req, res) => {
  try {
    const { 
      status, 
      paymentMethod, 
      centerId,
      dateFrom, 
      dateTo, 
      page = 1, 
      limit = 20,
      searchTerm 
    } = req.query;

    // Build query filters
    const filters = {};
    
    if (centerId && centerId !== 'all') {
      filters.centerId = new mongoose.Types.ObjectId(centerId);
    }
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (dateFrom && dateTo) {
      filters.createdAt = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      };
    }

    // Search functionality
    let searchQuery = {};
    if (searchTerm) {
      searchQuery = {
        $or: [
          { patientName: { $regex: searchTerm, $options: 'i' } },
          { transactionId: { $regex: searchTerm, $options: 'i' } },
          { receiptNumber: { $regex: searchTerm, $options: 'i' } },
          { invoiceNumber: { $regex: searchTerm, $options: 'i' } },
          { centerName: { $regex: searchTerm, $options: 'i' } }
        ]
      };
    }

    const finalQuery = { ...filters, ...searchQuery };

    // Get paginated results
    const skip = (page - 1) * limit;
    const paymentLogs = await PaymentLog.find(finalQuery)
      .populate('processedBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('testRequestId', 'testType testDescription workflowStage')
      .populate('patientId', 'name uhId phone')
      .populate('centerId', 'name centerCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await PaymentLog.countDocuments(finalQuery);

    res.status(200).json({
      success: true,
      paymentLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching all payment logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment logs',
      error: error.message
    });
  }
});

// Export payment logs as CSV
router.get('/center/export', ensureCenterIsolation, async (req, res) => {
  try {
    const { centerId } = req.user;
    const { dateFrom, dateTo } = req.query;

    const filters = { centerId: new mongoose.Types.ObjectId(centerId) };
    
    if (dateFrom && dateTo) {
      filters.createdAt = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      };
    }

    const paymentLogs = await PaymentLog.find(filters)
      .populate('processedBy', 'name email')
      .populate('patientId', 'name uhId phone')
      .sort({ createdAt: -1 })
      .lean();

    // Generate CSV content
    const csvHeaders = [
      'Transaction ID',
      'Patient Name',
      'Amount',
      'Payment Method',
      'Status',
      'Processed By',
      'Processed At',
      'Receipt Number',
      'Notes'
    ];

    const csvRows = paymentLogs.map(log => [
      log.transactionId || '',
      log.patientName || '',
      log.amount || 0,
      log.paymentMethod || '',
      log.status || '',
      log.processedBy?.name || '',
      log.processedAt?.toISOString() || '',
      log.receiptNumber || '',
      log.notes || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const filename = `payment_logs_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('❌ Error exporting payment logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export payment logs',
      error: error.message
    });
  }
});

// Get payment logs analysis
router.get('/analysis', checkSuperAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, centerId } = req.query;

    const filters = {};
    if (centerId && centerId !== 'all') {
      filters.centerId = new mongoose.Types.ObjectId(centerId);
    }
    if (dateFrom && dateTo) {
      filters.createdAt = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      };
    }

    const analysis = await PaymentLog.aggregate([
      { $match: filters },
      {
        $group: {
          _id: {
            status: '$status',
            paymentMethod: '$paymentMethod',
            centerId: '$centerId'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          statusBreakdown: {
            $push: {
              status: '$_id.status',
              paymentMethod: '$_id.paymentMethod',
              centerId: '$_id.centerId',
              count: '$count',
              totalAmount: '$totalAmount',
              avgAmount: '$avgAmount'
            }
          },
          overallCount: { $sum: '$count' },
          overallAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      analysis: analysis[0] || { statusBreakdown: [], overallCount: 0, overallAmount: 0 }
    });
  } catch (error) {
    console.error('❌ Error fetching payment log analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment log analysis',
      error: error.message
    });
  }
});

export default router;
