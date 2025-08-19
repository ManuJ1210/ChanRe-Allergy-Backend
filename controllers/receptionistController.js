import User from '../models/User.js';

// Create a new receptionist (Center-specific only)
export const createReceptionist = async (req, res) => {
  try {
    const { name, phone, email, username, password } = req.body;
    
    if (!name || !email || !password || !username) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    
    // Ensure centerId is set to current user's center (unless superadmin)
    let centerId = req.user.centerId;
    
    // If superadmin is creating a receptionist, they must specify centerId
    if (req.user.role === 'superadmin') {
      if (!req.body.centerId) {
        return res.status(400).json({ 
          message: 'Superadmin must specify centerId when creating a receptionist.' 
        });
      }
      centerId = req.body.centerId;
    } else {
      // For non-superadmin users, ensure they have a centerId
      if (!centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
    }
    
    // Check for existing email or username
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: 'Receptionist with this email or username already exists' });
    }
    
    const receptionist = await User.create({
      name,
      phone,
      email,
      username,
      password,
      role: 'receptionist',
      centerId: centerId, // Automatically set to current user's center
      isSuperAdminStaff: false // Explicitly mark as center-specific receptionist
    });
    
    console.log(`✅ Center-specific receptionist added successfully to center: ${centerId}`);
    res.status(201).json(receptionist);
  } catch (err) {
    console.error('❌ Error creating receptionist:', err);
    res.status(500).json({ message: 'Failed to create receptionist', error: err.message });
  }
};

// Get all receptionists (Center-specific only)
export const getAllReceptionists = async (req, res) => {
  try {
    let query = { 
      role: 'receptionist',
      centerId: { $exists: true, $ne: null }, // Only receptionists with centerId (center-specific)
      $or: [
        { isSuperAdminStaff: { $exists: false } }, // No isSuperAdminStaff field
        { isSuperAdminStaff: false }, // Or explicitly set to false
        { isSuperAdminStaff: { $ne: true } } // Or not true
      ]
    };

    // Handle status filtering
    if (req.query.status !== undefined && req.query.status !== '') {
      if (req.query.status === 'true') {
        query.isDeleted = true;
      } else if (req.query.status === 'false') {
        query.isDeleted = { $ne: true };
      }
    }

    // Handle search functionality
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$and = [
        {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { username: searchRegex }
          ]
        },
        {
          $or: [
            { isSuperAdminStaff: { $exists: false } }, // No isSuperAdminStaff field
            { isSuperAdminStaff: false }, // Or explicitly set to false
            { isSuperAdminStaff: { $ne: true } } // Or not true
          ]
        }
      ];
      // Remove the original $or since we're now using $and
      delete query.$or;
    }

    // Superadmin can see all receptionists (except superadmin staff)
    if (req.user.role === 'superadmin') {
      console.log('🔍 Superadmin - showing all receptionists (excluding superadmin staff)');
    } else {
      // Center admin and other users can only see receptionists from their center
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      query.centerId = req.user.centerId;
    }

    const receptionists = await User.find(query).select('-password');
    
    console.log(`🔍 Found ${receptionists.length} center-specific receptionists for center: ${req.user.centerId || 'all centers (superadmin/center admin)'}`);
    
    // Log sample receptionist data for debugging
    if (receptionists.length > 0) {
      console.log('🏥 Sample receptionist data:', {
        receptionistId: receptionists[0]._id,
        receptionistName: receptionists[0].name,
        receptionistRole: receptionists[0].role,
        receptionistCenterId: receptionists[0].centerId,
        receptionistCenterIdType: typeof receptionists[0].centerId
      });
    }
    
    res.status(200).json(receptionists);
  } catch (err) {
    console.error('❌ Error fetching receptionists:', err);
    res.status(500).json({ message: 'Failed to fetch receptionists', error: err.message });
  }
};

// Get a single receptionist by ID
export const getReceptionistById = async (req, res) => {
  try {
    let receptionist;
    
    // Superadmin can view any receptionist (except superadmin staff)
    if (req.user.role === 'superadmin') {
      receptionist = await User.findOne({ 
        _id: req.params.id,
        role: 'receptionist', // Only get receptionists
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      }).select('-password');
    } else {
      // Center admin and other users can only view receptionists from their center
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      receptionist = await User.findOne({ 
        _id: req.params.id,
        role: 'receptionist', // Only get receptionists
        centerId: req.user.centerId,
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      }).select('-password');
    }
    
    if (!receptionist) {
      return res.status(404).json({ message: 'Receptionist not found or access denied' });
    }
    
    res.status(200).json(receptionist);
  } catch (err) {
    console.error('❌ Error fetching receptionist:', err);
    res.status(500).json({ message: 'Failed to fetch receptionist', error: err.message });
  }
};

// Delete a receptionist by ID
export const deleteReceptionist = async (req, res) => {
  try {
    const receptionist = await User.findById(req.params.id);

    if (!receptionist) {
      return res.status(404).json({ message: 'Receptionist not found' });
    }

    // Check if it's a superadmin staff receptionist (should not be deleted through this endpoint)
    if (receptionist.isSuperAdminStaff) {
      console.log('❌ Cannot delete superadmin staff receptionist through this endpoint');
      return res.status(403).json({ message: 'Access denied. You can only delete regular receptionists.' });
    }

    // Allow superadmin to delete any receptionist (except superadmin staff)
    if (req.user.role === 'superadmin') {
      await receptionist.deleteOne();
      console.log(`✅ Receptionist deleted successfully by superadmin`);
      return res.status(200).json({ message: 'Receptionist deleted successfully' });
    }

    // Allow center admin to delete receptionists from their center only (except superadmin staff)
    if (req.user.role === 'centeradmin') {
      if (receptionist.centerId?.toString() !== req.user.centerId?.toString()) {
        return res.status(403).json({ message: 'Access denied. You can only delete receptionists from your own center.' });
      }
      await receptionist.deleteOne();
      console.log(`✅ Receptionist deleted successfully by center admin`);
      return res.status(200).json({ message: 'Receptionist deleted successfully' });
    }

    // Allow regular receptionists to delete themselves (if needed)
    if (req.user.role === 'receptionist' && req.user._id.toString() === receptionist._id.toString()) {
      await receptionist.deleteOne();
      console.log(`✅ Receptionist deleted themselves`);
      return res.status(200).json({ message: 'Receptionist deleted successfully' });
    }

    return res.status(403).json({ message: 'Access denied. You can only delete receptionists from your own center.' });
  } catch (err) {
    console.error('❌ Error deleting receptionist:', err);
    res.status(500).json({ message: 'Failed to delete receptionist', error: err.message });
  }
};

// Update a receptionist by ID
export const updateReceptionist = async (req, res) => {
  try {
    let receptionist;
    
    // Superadmin can update any receptionist (except superadmin staff)
    if (req.user.role === 'superadmin') {
      receptionist = await User.findOne({ 
        _id: req.params.id,
        role: 'receptionist', // Only update receptionists
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      });
      if (!receptionist) {
        return res.status(404).json({ message: 'Receptionist not found' });
      }
    } else {
      // Center admin and other users can only update receptionists from their center
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      receptionist = await User.findOne({ 
        _id: req.params.id,
        role: 'receptionist', // Only update receptionists
        centerId: req.user.centerId,
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      });
      if (!receptionist) {
        return res.status(404).json({ message: 'Receptionist not found or access denied' });
      }
    }
    
    // Update fields
    const fields = ['name', 'phone', 'email', 'username', 'isDeleted'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        receptionist[field] = req.body[field];
      }
    });

    await receptionist.save();
    console.log(`✅ Receptionist updated successfully`);
    res.status(200).json({ message: 'Receptionist updated successfully', receptionist });
  } catch (err) {
    console.error('❌ Error updating receptionist:', err);
    res.status(500).json({ message: 'Failed to update receptionist', error: err.message });
  }
}; 

// ✅ New: Get Receptionist Stats for Center Admin
// @route   GET /api/receptionists/stats
// @desc    Get receptionist statistics for center admin
// @access  Private (Center Admin)
export const getReceptionistStats = async (req, res) => {
  try {
    let query = { 
      role: 'receptionist',
      centerId: { $exists: true, $ne: null } // Only receptionists with centerId (center-specific)
    };

    // If user is not superadmin, filter by their center
    if (req.user.role !== 'superadmin') {
      if (!req.user.centerId) {
        return res.status(403).json({ 
          message: 'Access denied. Center-specific access required.' 
        });
      }
      query.centerId = req.user.centerId;
    }

    // Explicitly exclude super admin staff receptionists
    query.$and = [
      {
        $or: [
          { isSuperAdminStaff: { $exists: false } },
          { isSuperAdminStaff: false },
          { isSuperAdminStaff: { $ne: true } }
        ]
      }
    ];

    // Get total receptionists
    const total = await User.countDocuments(query);

    // Get active receptionists (not deleted)
    const active = await User.countDocuments({ ...query, isDeleted: { $ne: true } });

    // Get inactive receptionists (deleted)
    const inactive = await User.countDocuments({ ...query, isDeleted: true });

    const stats = {
      total,
      active,
      inactive
    };

    console.log(`📊 Receptionist stats for center: ${req.user.centerId || 'all centers'}`);
    res.status(200).json(stats);
  } catch (error) {
    console.error('❌ Error fetching receptionist stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 