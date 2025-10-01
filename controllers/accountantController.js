import User from '../models/User.js';
import Center from '../models/Center.js';
import Patient from '../models/Patient.js';
import TestRequest from '../models/TestRequest.js';
import PaymentLog from '../models/PaymentLog.js';
import bcrypt from 'bcryptjs';

// Get all accountants for a center
export const getAccountants = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;

    // Build query
    const query = {
      role: 'accountant',
      isDeleted: false
    };

    // Add center filter if not superadmin
    if (req.user.role !== 'superadmin') {
      query.centerId = req.user.centerId;
    } else if (centerId) {
      query.centerId = centerId;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const accountants = await User.find(query)
      .populate('centerId', 'name code')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      accountants,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching accountants:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single accountant
export const getAccountant = async (req, res) => {
  try {
    const { id } = req.params;

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    }).populate('centerId', 'name code').select('-password');

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(accountant);
  } catch (error) {
    console.error('Error fetching accountant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new accountant
export const createAccountant = async (req, res) => {
  try {
    const {
      name,
      email,
      username,
      password,
      phone,
      mobile,
      address,
      emergencyContact,
      emergencyContactName,
      centerId
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username: username || email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or username' });
    }

    // Determine centerId
    let assignedCenterId = centerId;
    if (req.user.role !== 'superadmin') {
      assignedCenterId = req.user.centerId;
    }

    // Validate center exists
    if (assignedCenterId) {
      const center = await Center.findById(assignedCenterId);
      if (!center) {
        return res.status(400).json({ message: 'Invalid center' });
      }
    }

    // Create accountant
    const accountant = await User.create({
      name,
      email,
      username: username || email,
      password,
      role: 'accountant',
      centerId: assignedCenterId,
      phone,
      mobile,
      address,
      emergencyContact,
      emergencyContactName
    });

    // Return accountant without password
    const createdAccountant = await User.findById(accountant._id)
      .populate('centerId', 'name code')
      .select('-password');

    res.status(201).json(createdAccountant);
  } catch (error) {
    console.error('Error creating accountant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update accountant
export const updateAccountant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      username,
      phone,
      mobile,
      address,
      emergencyContact,
      emergencyContactName,
      status,
      centerId
    } = req.body;

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    });

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if email/username already exists for another user
    if (email || username) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : [])
        ]
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email or username already exists' });
      }
    }

    // Update fields
    if (name) accountant.name = name;
    if (email) accountant.email = email;
    if (username) accountant.username = username;
    if (phone !== undefined) accountant.phone = phone;
    if (mobile !== undefined) accountant.mobile = mobile;
    if (address !== undefined) accountant.address = address;
    if (emergencyContact !== undefined) accountant.emergencyContact = emergencyContact;
    if (emergencyContactName !== undefined) accountant.emergencyContactName = emergencyContactName;
    if (status) accountant.status = status;

    // Only superadmin can change centerId
    if (req.user.role === 'superadmin' && centerId) {
      const center = await Center.findById(centerId);
      if (!center) {
        return res.status(400).json({ message: 'Invalid center' });
      }
      accountant.centerId = centerId;
    }

    await accountant.save();

    // Return updated accountant without password
    const updatedAccountant = await User.findById(accountant._id)
      .populate('centerId', 'name code')
      .select('-password');

    res.json(updatedAccountant);
  } catch (error) {
    console.error('Error updating accountant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete accountant (soft delete)
export const deleteAccountant = async (req, res) => {
  try {
    const { id } = req.params;

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    });

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete
    accountant.isDeleted = true;
    accountant.status = 'inactive';
    await accountant.save();

    res.json({ message: 'Accountant deleted successfully' });
  } catch (error) {
    console.error('Error deleting accountant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset accountant password
export const resetAccountantPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const accountant = await User.findOne({
      _id: id,
      role: 'accountant',
      isDeleted: false
    });

    if (!accountant) {
      return res.status(404).json({ message: 'Accountant not found' });
    }

    // Check center access
    if (req.user.role !== 'superadmin' && accountant.centerId.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    accountant.password = await bcrypt.hash(newPassword, salt);
    await accountant.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get accountant dashboard data
export const getAccountantDashboard = async (req, res) => {
  try {
    const centerId = req.user.centerId;

    // Get basic counts
    const totalPatients = await User.countDocuments({
      role: 'patient',
      centerId,
      isDeleted: false
    });

    const totalDoctors = await User.countDocuments({
      role: 'doctor',
      centerId,
      isDeleted: false
    });

    const totalReceptionists = await User.countDocuments({
      role: 'receptionist',
      centerId,
      isDeleted: false
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPatients = await User.countDocuments({
      role: 'patient',
      centerId,
      isDeleted: false,
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      totalPatients,
      totalDoctors,
      totalReceptionists,
      recentPatients,
      centerId
    });
  } catch (error) {
    console.error('Error fetching accountant dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get accountant statistics
export const getAccountantStats = async (req, res) => {
  try {
    const centerId = req.user.centerId;

    const total = await User.countDocuments({
      role: 'accountant',
      centerId,
      isDeleted: false
    });

    const active = await User.countDocuments({
      role: 'accountant',
      centerId,
      isDeleted: false,
      status: 'active'
    });

    const inactive = await User.countDocuments({
      role: 'accountant',
      centerId,
      isDeleted: false,
      status: 'inactive'
    });

    res.json({
      total,
      active,
      inactive
    });
  } catch (error) {
    console.error('Error fetching accountant stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all bills and transactions for accountant
export const getAllBillsAndTransactions = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    const { startDate, endDate, billType, status, page = 1, limit = 50 } = req.query;

    console.log('📊 Fetching bills and transactions for center:', centerId);

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    // 1. Get ALL patients and group their billing by invoice number
    const patientQuery = { centerId };
    const patients = await Patient.find(patientQuery)
      .populate('assignedDoctor', 'name')
      .populate('currentDoctor', 'name')
      .select('name uhId age gender contact billing reassignedBilling createdAt');

    const invoiceMap = new Map(); // Group by patient and date (to combine all services in one visit)
    
    patients.forEach(patient => {
      // Process regular consultation bills - GROUP BY PATIENT AND DATE (not just invoice number)
      if (patient.billing && patient.billing.length > 0) {
        // Group bills by date (within 1 day) to combine all services from same visit
        const billsByDate = {};
        
        patient.billing.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          const matchesDateFilter = (!dateFilter.$gte || billDate >= dateFilter.$gte) && 
                                   (!dateFilter.$lte || billDate <= dateFilter.$lte);
          
          if ((!startDate && !endDate) || matchesDateFilter) {
            // Group by date (YYYY-MM-DD) to combine all services from same day
            const dateKey = billDate.toISOString().split('T')[0];
            
            if (!billsByDate[dateKey]) {
              billsByDate[dateKey] = [];
            }
            billsByDate[dateKey].push(bill);
          }
        });
        
        // Create one invoice per date (combining all services)
        Object.entries(billsByDate).forEach(([dateKey, bills]) => {
          // Use the first bill's invoice number, or generate one
          const primaryBill = bills[0];
          const invoiceNum = primaryBill.invoiceNumber || `INV-${patient.uhId}-${dateKey}`;
          const billDate = new Date(primaryBill.createdAt || patient.createdAt);
          
          // Create invoice with all services
          const invoice = {
            _id: primaryBill._id,
            patientId: patient._id,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender,
            patientContact: patient.contact,
            uhId: patient.uhId,
            billType: 'Consultation',
            billNo: primaryBill.billNo || invoiceNum,
            invoiceNumber: invoiceNum,
            date: billDate,
            doctor: patient.assignedDoctor?.name || 'N/A',
            status: 'paid', // Will be updated based on bills
            services: [],
            amount: 0,
            paidAmount: 0,
            balance: 0,
            discount: primaryBill.discount || 0,
            tax: primaryBill.tax || 0,
            paymentHistory: [],
            paymentMethod: primaryBill.paymentMethod,
            refunds: [],
            refundedAmount: 0,
            customData: primaryBill.customData,
            notes: primaryBill.notes,
            generatedBy: primaryBill.generatedBy,
            generatedAt: primaryBill.createdAt
          };
          
          // Add all bills as service line items
          bills.forEach(bill => {
            invoice.services.push({
              name: bill.description || bill.type,
              serviceName: bill.description || bill.type,
              quantity: 1,
              charges: bill.amount || 0,
              amount: bill.amount || 0,
              paid: bill.paidAmount || 0,
              paidAmount: bill.paidAmount || 0,
              balance: (bill.amount || 0) - (bill.paidAmount || 0),
              status: bill.status
            });
            
            // Accumulate totals
            invoice.amount += bill.amount || 0;
            invoice.paidAmount += bill.paidAmount || 0;
            invoice.balance += (bill.amount || 0) - (bill.paidAmount || 0);
            
            // Update status (worst case)
            if (bill.status === 'refunded') invoice.status = 'refunded';
            else if (bill.status === 'cancelled' && invoice.status !== 'refunded') invoice.status = 'cancelled';
            else if (bill.status === 'pending' && !['refunded', 'cancelled'].includes(invoice.status)) invoice.status = 'pending';
            else if (bill.status === 'partially_paid' && !['refunded', 'cancelled', 'pending'].includes(invoice.status)) invoice.status = 'partially_paid';
            
            // Merge payment histories
            if (bill.paymentHistory && bill.paymentHistory.length > 0) {
              invoice.paymentHistory.push(...bill.paymentHistory);
            }
            
            // Merge refunds
            if (bill.refunds && bill.refunds.length > 0) {
              invoice.refunds.push(...bill.refunds);
              invoice.refundedAmount += bill.refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
            }
          });
          
          // Apply filters
          if (!billType || billType === 'consultation') {
            if (!status || invoice.status === status) {
              invoiceMap.set(invoiceNum, invoice);
            }
          }
        });
      }

      // Process reassignment bills - GROUP BY INVOICE NUMBER
      if (patient.reassignedBilling && patient.reassignedBilling.length > 0) {
        patient.reassignedBilling.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          const matchesDateFilter = (!dateFilter.$gte || billDate >= dateFilter.$gte) && 
                                   (!dateFilter.$lte || billDate <= dateFilter.$lte);
          
          if ((!startDate && !endDate) || matchesDateFilter) {
            const invoiceNum = bill.invoiceNumber || `REASSIGN-${bill._id}`;
            
            // Get or create invoice entry
            if (!invoiceMap.has(invoiceNum)) {
              invoiceMap.set(invoiceNum, {
                _id: bill._id,
                patientId: patient._id,
                patientName: patient.name,
                patientAge: patient.age,
                patientGender: patient.gender,
                patientContact: patient.contact,
                uhId: patient.uhId,
                billType: 'Reassignment',
                billNo: bill.billNo || bill.invoiceNumber,
                invoiceNumber: invoiceNum,
                date: billDate,
                doctor: patient.currentDoctor?.name || 'N/A',
                status: bill.status || 'pending',
                services: bill.customData?.services || [],
                amount: bill.amount || 0,
                paidAmount: bill.paidAmount || 0,
                balance: (bill.amount || 0) - (bill.paidAmount || 0),
                discount: bill.customData?.discountPercentage || 0,
                tax: bill.customData?.taxPercentage || 0,
                paymentHistory: bill.paymentHistory || [],
                paymentMethod: bill.paymentMethod,
                refunds: bill.refunds || [],
                refundedAmount: bill.refunds?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
                customData: bill.customData,
                notes: bill.notes,
                generatedBy: bill.generatedBy,
                generatedAt: bill.createdAt
              });
            }
          }
        });
      }
    });

    const consultationBills = Array.from(invoiceMap.values());

    // 2. Get test/lab bills from TestRequest
    const testQuery = { centerId };
    if (Object.keys(dateFilter).length > 0) {
      testQuery.createdAt = dateFilter;
    }

    const testRequests = await TestRequest.find(testQuery)
      .populate({
        path: 'patientId',
        select: 'name uhId',
        model: 'Patient'
      })
      .populate({
        path: 'doctorId',
        select: 'name',
        model: 'User'
      })
      .select('patientId doctorId billing status createdAt patientName');

    console.log(`📋 Found ${testRequests.length} test requests for accountant billing`);

    const testBills = [];
    
    // Process each test request and manually fetch patient data if needed
    for (const testReq of testRequests) {
      if (testReq.billing && (!billType || billType === 'lab')) {
        if (!status || testReq.billing.status === status) {
          // Try to get patient info from populated field, stored field, or fetch manually
          let patientName = 'Unknown Patient';
          let patientUhId = 'N/A';
          let patientIdValue = null;

          if (testReq.patientId) {
            if (typeof testReq.patientId === 'object' && testReq.patientId._id) {
              // Already populated
              patientName = testReq.patientId.name || testReq.patientName || 'Unknown Patient';
              patientUhId = testReq.patientId.uhId || 'N/A';
              patientIdValue = testReq.patientId._id;
            } else {
              // Just an ID - fetch patient manually
              patientIdValue = testReq.patientId;
              try {
                const patient = await Patient.findById(testReq.patientId).select('name uhId');
                if (patient) {
                  patientName = patient.name || testReq.patientName || 'Unknown Patient';
                  patientUhId = patient.uhId || 'N/A';
                }
              } catch (err) {
                console.error(`Failed to fetch patient ${testReq.patientId}:`, err.message);
                patientName = testReq.patientName || 'Unknown Patient';
              }
            }
          }

          testBills.push({
            _id: testReq._id,
            patientId: patientIdValue,
            patientName: patientName,
            uhId: patientUhId,
            billType: 'Lab/Test',
            description: testReq.billing.description || 'Laboratory Test',
            amount: testReq.billing.amount || 0,
            paidAmount: testReq.billing.paidAmount || 0,
            balance: (testReq.billing.amount || 0) - (testReq.billing.paidAmount || 0),
            status: testReq.billing.status || 'pending',
            paymentMethod: testReq.billing.paymentMethod,
            date: testReq.createdAt,
            doctor: testReq.doctorId?.name || testReq.doctorName || 'N/A',
            invoiceNumber: testReq.billing.invoiceNumber || `${testReq._id}`
          });
        }
      }
    }

    console.log(`📊 Processed ${testBills.length} test bills`);
    console.log(`📊 Total grouped invoices from patients: ${consultationBills.length}`);

    // 3. Get payment logs
    const paymentQuery = { centerId };
    if (Object.keys(dateFilter).length > 0) {
      paymentQuery.createdAt = dateFilter;
    }

    const paymentLogs = await PaymentLog.find(paymentQuery)
      .populate('patientId', 'name uhId')
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });

    const transactions = paymentLogs.map(log => ({
      _id: log._id,
      patientId: log.patientId?._id,
      patientName: log.patientId?.name || 'N/A',
      uhId: log.patientId?.uhId || 'N/A',
      transactionType: log.action || 'payment',
      description: log.description || 'Payment',
      amount: log.amount || 0,
      paymentMethod: log.paymentMethod,
      date: log.createdAt,
      doctor: log.doctorId?.name || 'N/A',
      invoiceNumber: log.invoiceNumber,
      status: 'completed'
    }));

    // Combine all bills (already complete invoice structures)
    const allInvoices = [...consultationBills, ...testBills];

    // Sort by date (newest first)
    allInvoices.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedInvoices = allInvoices.slice(startIndex, endIndex);

    // Calculate totals (excluding refunded and cancelled bills)
    const activeInvoices = allInvoices.filter(inv => 
      inv.status !== 'refunded' && inv.status !== 'cancelled'
    );
    const cancelledInvoices = allInvoices.filter(inv => inv.status === 'cancelled');
    const refundedInvoices = allInvoices.filter(inv => inv.status === 'refunded');
    
    const totalAmount = activeInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalPaid = activeInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalBalance = activeInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    
    const cancelledAmount = cancelledInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const refundedAmount = refundedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

    console.log(`📊 Total invoices: ${allInvoices.length}, Active: ${activeInvoices.length}, Cancelled: ${cancelledInvoices.length}, Refunded: ${refundedInvoices.length}`);

    res.json({
      bills: paginatedInvoices,
      transactions: transactions.slice(0, limit),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(allInvoices.length / limit),
        totalRecords: allInvoices.length,
        limit: parseInt(limit)
      },
      summary: {
        totalAmount,
        totalPaid,
        totalBalance,
        totalTransactions: transactions.length,
        cancelledCount: cancelledInvoices.length,
        cancelledAmount: cancelledAmount,
        refundedCount: refundedInvoices.length,
        refundedAmount: refundedAmount,
        activeInvoicesCount: activeInvoices.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching bills and transactions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get financial reports (daily, weekly, monthly, yearly) with detailed transactions
export const getFinancialReports = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    const { reportType = 'daily', startDate, endDate } = req.query;

    console.log('📈 Generating financial report:', reportType);

    const now = new Date();
    let dateFilter = {};

    // Set date range based on report type
    switch (reportType) {
      case 'daily':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { $gte: today, $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
        break;
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        dateFilter = { $gte: weekStart, $lte: now };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { $gte: monthStart, $lte: now };
        break;
      case 'yearly':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = { $gte: yearStart, $lte: now };
        break;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter = { $gte: start, $lte: end };
        }
        break;
    }

    // Fetch all patients and their bills
    const patients = await Patient.find({ centerId })
      .populate('assignedDoctor', 'name')
      .populate('currentDoctor', 'name')
      .select('name uhId age gender contact billing reassignedBilling createdAt');

    // Fetch test requests
    const testRequests = await TestRequest.find({
      centerId,
      createdAt: dateFilter
    }).populate('patientId', 'name uhId').populate('doctorId', 'name').select('billing createdAt patientId doctorId');

    // Detailed transaction list
    const detailedTransactions = [];
    
    // Calculate consultation revenue and collect transactions
    let consultationRevenue = 0;
    let consultationCount = 0;
    let reassignmentRevenue = 0;
    let reassignmentCount = 0;

    patients.forEach(patient => {
      if (patient.billing) {
        patient.billing.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          if (
            (!dateFilter.$gte || billDate >= dateFilter.$gte) &&
            (!dateFilter.$lte || billDate <= dateFilter.$lte)
          ) {
            // Add to detailed transactions
            detailedTransactions.push({
              date: billDate,
              invoiceNumber: bill.invoiceNumber || 'N/A',
              patientName: patient.name,
              uhId: patient.uhId,
              age: patient.age,
              gender: patient.gender,
              billType: 'Consultation',
              service: bill.description || bill.type,
              doctor: patient.assignedDoctor?.name || 'N/A',
              amount: bill.amount || 0,
              paidAmount: bill.paidAmount || 0,
              balance: (bill.amount || 0) - (bill.paidAmount || 0),
              status: bill.status,
              paymentMethod: bill.paymentMethod || 'N/A'
            });
            
            if (bill.status === 'paid' || bill.status === 'completed') {
              consultationRevenue += bill.paidAmount || bill.amount || 0;
              consultationCount++;
            }
          }
        });
      }

      if (patient.reassignedBilling) {
        patient.reassignedBilling.forEach(bill => {
          const billDate = new Date(bill.createdAt || patient.createdAt);
          if (
            (!dateFilter.$gte || billDate >= dateFilter.$gte) &&
            (!dateFilter.$lte || billDate <= dateFilter.$lte)
          ) {
            // Add to detailed transactions
            detailedTransactions.push({
              date: billDate,
              invoiceNumber: bill.invoiceNumber || 'N/A',
              patientName: patient.name,
              uhId: patient.uhId,
              age: patient.age,
              gender: patient.gender,
              billType: 'Reassignment',
              service: 'Patient Reassignment',
              doctor: patient.currentDoctor?.name || 'N/A',
              amount: bill.amount || 0,
              paidAmount: bill.paidAmount || 0,
              balance: (bill.amount || 0) - (bill.paidAmount || 0),
              status: bill.status,
              paymentMethod: bill.paymentMethod || 'N/A'
            });
            
            if (bill.status === 'paid' || bill.status === 'completed') {
              reassignmentRevenue += bill.paidAmount || bill.amount || 0;
              reassignmentCount++;
            }
          }
        });
      }
    });

    // Calculate lab revenue and collect transactions
    let labRevenue = 0;
    let labCount = 0;

    testRequests.forEach(test => {
      if (test.billing) {
        detailedTransactions.push({
          date: test.createdAt,
          invoiceNumber: test.billing.invoiceNumber || 'N/A',
          patientName: test.patientId?.name || 'N/A',
          uhId: test.patientId?.uhId || 'N/A',
          age: 'N/A',
          gender: 'N/A',
          billType: 'Lab/Test',
          service: test.billing.description || 'Laboratory Test',
          doctor: test.doctorId?.name || 'N/A',
          amount: test.billing.amount || 0,
          paidAmount: test.billing.paidAmount || 0,
          balance: (test.billing.amount || 0) - (test.billing.paidAmount || 0),
          status: test.billing.status,
          paymentMethod: test.billing.paymentMethod || 'N/A'
        });
        
        if (test.billing.status === 'paid' || test.billing.status === 'completed') {
          labRevenue += test.billing.paidAmount || test.billing.amount || 0;
          labCount++;
        }
      }
    });

    // Sort transactions by date
    detailedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalRevenue = consultationRevenue + reassignmentRevenue + labRevenue;
    const totalTransactions = consultationCount + reassignmentCount + labCount;

    res.json({
      reportType,
      dateRange: dateFilter,
      summary: {
        totalRevenue,
        totalTransactions,
        consultationRevenue,
        consultationCount,
        reassignmentRevenue,
        reassignmentCount,
        labRevenue,
        labCount
      },
      breakdown: {
        consultation: {
          revenue: consultationRevenue,
          count: consultationCount,
          percentage: totalRevenue > 0 ? ((consultationRevenue / totalRevenue) * 100).toFixed(2) : 0
        },
        reassignment: {
          revenue: reassignmentRevenue,
          count: reassignmentCount,
          percentage: totalRevenue > 0 ? ((reassignmentRevenue / totalRevenue) * 100).toFixed(2) : 0
        },
        lab: {
          revenue: labRevenue,
          count: labCount,
          percentage: totalRevenue > 0 ? ((labRevenue / totalRevenue) * 100).toFixed(2) : 0
        }
      },
      transactions: detailedTransactions
    });
  } catch (error) {
    console.error('❌ Error generating financial report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
