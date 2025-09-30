import User from '../models/User.js';
import Center from '../models/Center.js';
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
