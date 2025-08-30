import User from '../models/User.js';
import Center from '../models/Center.js';

// ✅ Get all center admins
export const getAllCenterAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'centeradmin' })
      .populate('centerId', 'name code')
      .select('-password');

    const formatted = admins.map((admin) => ({
      _id: admin._id,
      adminName: admin.name,
      name: admin.name, // Keep original name field for compatibility
      email: admin.email,
      phone: admin.phone,
      qualification: admin.qualification || '',
      designation: admin.designation || '',
      kmcNumber: admin.kmcNumber || '',
      hospitalName: admin.hospitalName || '',
      username: admin.username || '',
      centerCode: admin.centerCode || '',
      createdAt: admin.createdAt,
      centerId: admin.centerId?._id || admin.centerId, // Include centerId
      centerName: admin.centerId?.name || 'N/A',
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Failed to fetch center admins:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ✅ Get single center admin by ID
export const getCenterAdminById = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id).select('-password');
    if (!admin || admin.role !== 'centeradmin') {
      return res.status(404).json({ message: 'Center admin not found' });
    }
    res.status(200).json(admin);
  } catch (error) {
    console.error('Failed to fetch center admin:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ✅ Update center admin by ID
export const updateCenterAdmin = async (req, res) => {
  try {
    console.log('Update center admin request:', { id: req.params.id, body: req.body });
    
    const admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'centeradmin') {
      return res.status(404).json({ message: 'Center admin not found' });
    }

    const fields = [
      'name',
      'qualification',
      'designation',
      'kmcNumber',
      'hospitalName',
      'centerCode',
      'phone',
      'email',
      'username',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        admin[field] = req.body[field];
      }
    });

    // Handle password separately to avoid hashing empty passwords
    if (req.body.password && req.body.password.trim() !== '') {
      admin.password = req.body.password;
    }

    console.log('About to save admin with data:', {
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      qualification: admin.qualification,
      designation: admin.designation,
      kmcNumber: admin.kmcNumber,
      hospitalName: admin.hospitalName,
      centerCode: admin.centerCode,
      username: admin.username,
      hasPassword: !!admin.password
    });

    const updatedAdmin = await admin.save();
    console.log('Admin saved successfully:', updatedAdmin._id);
    
    // Return the updated admin without password
    const adminResponse = updatedAdmin.toObject();
    delete adminResponse.password;
    res.status(200).json(adminResponse);
  } catch (error) {
    console.error('Failed to update center admin:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ✅ Delete center admin by ID
export const deleteCenterAdmin = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'centeradmin') {
      return res.status(404).json({ message: 'Center admin not found' });
    }

    await admin.deleteOne();
    res.status(200).json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Failed to delete center admin:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Create a new center admin for an existing center
export const createCenterAdmin = async (req, res) => {
  try {
    console.log('createCenterAdmin req.body:', req.body);
    const { name, email, password, username, centerId, ...rest } = req.body;
    
    // Check if admin already exists for this center
    const existingCenterAdmin = await User.findOne({ centerId, role: 'centeradmin' });
    if (existingCenterAdmin) {
      return res.status(400).json({ message: 'Admin already exists for this center' });
    }
    
    // Check for duplicate email or username across all users
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'User with this username already exists' });
      }
    }
    
    const newAdmin = await User.create({
      name,
      email,
      password,
      username,
      role: 'centeradmin',
      centerId,
      ...rest,
    });
    console.log('✅ New center admin created:', newAdmin._id, newAdmin.email);
    
    // Update the Center's centerAdminId field
    const updatedCenter = await Center.findByIdAndUpdate(centerId, { centerAdminId: newAdmin._id }, { new: true });
    console.log('✅ Center updated with new centerAdminId:', updatedCenter?._id, '->', updatedCenter?.centerAdminId);
    
    // Return the admin without password
    const adminResponse = newAdmin.toObject();
    delete adminResponse.password;
    res.status(201).json(adminResponse);
  } catch (err) {
    console.error('❌ Error in createCenterAdmin:', err);
    
    // Handle duplicate key errors more gracefully
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        message: `User with this ${field} already exists. Please choose a different ${field}.` 
      });
    }
    
    res.status(500).json({ message: 'Failed to create admin', error: err.message });
  }
};
