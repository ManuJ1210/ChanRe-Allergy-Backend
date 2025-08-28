import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Doctor from '../models/Docter.js';
import LabStaff from '../models/LabStaff.js';
import SuperAdminDoctor from '../models/SuperAdminDoctor.js';
import SuperAdminReceptionist from '../models/SuperAdminReceptionist.js';

const generateToken = (user, userType) => {
  const payload = {
    id: user._id,
    email: user.email,
    username: user.username,
    role: user.role,
    name: user.name,
    userType: userType
  };

  // Add isSuperAdminStaff flag for superadmin doctors
  if (userType === 'SuperAdminDoctor' && user.isSuperAdminStaff) {
    payload.isSuperAdminStaff = true;
  }

  // Use environment variable or fallback to a default secret
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
  return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
};

export const register = async (req, res) => {
  try {
    const { name, email, username, password, role, centerId } = req.body;

    // Check if user already exists with email or username
    const userExists = await User.findOne({
      $or: [
        { email },
        { username }
      ]
    });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email or username' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      username: username || email, // Use provided username or fallback to email
      password: hashedPassword,
      role,
      centerId
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        centerId: user.centerId,
        token: generateToken(user, 'User')
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    console.log('🔍 Login attempt with:', emailOrUsername);

    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Please provide both email/username and password' });
    }

    // Check in User model first - try email and username (case insensitive)
    console.log('🔍 Searching in User model for:', emailOrUsername);
    let user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } },
        { username: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } }
      ]
    }).populate('centerId', 'name code');
    
    console.log('🔍 User found in User model:', user ? 'YES' : 'NO');
    let userType = 'User';

    if (!user) {
      // Check in Doctor model - try email and username (case insensitive)
      console.log('🔍 Searching in Doctor model for:', emailOrUsername);
      user = await Doctor.findOne({
        $or: [
          { email: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } },
          { username: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } }
        ]
      });
      console.log('🔍 User found in Doctor model:', user ? 'YES' : 'NO');
      userType = 'Doctor';
    }

    if (!user) {
      // Check in LabStaff model - try email and username (case insensitive)
      console.log('🔍 Searching in LabStaff model for:', emailOrUsername);
      user = await LabStaff.findOne({
        $or: [
          { email: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } },
          { username: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } }
        ]
      });
      console.log('🔍 User found in LabStaff model:', user ? 'YES' : 'NO');
      userType = 'LabStaff';
    }

    if (!user) {
      // Check in SuperAdminDoctor model - try email and username (case insensitive)
      user = await SuperAdminDoctor.findOne({
        $or: [
          { email: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } },
          { username: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } }
        ]
      });
      userType = 'SuperAdminDoctor';
    }

    if (!user) {
      // Check in SuperAdminReceptionist model - try email and username (case insensitive)
      user = await SuperAdminReceptionist.findOne({
        $or: [
          { email: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } },
          { username: { $regex: new RegExp(`^${emailOrUsername}$`, 'i') } }
        ]
      });
      userType = 'SuperAdminReceptionist';
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email/username or password' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email/username or password' });
    }

    // Generate token
    const token = generateToken(user, userType);

    // Prepare response based on user type
    let userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      userType: userType,
      token: token
    };

    // Add specific fields based on user type
    if (userType === 'User') {
      userData.centerId = user.centerId;
      userData.phone = user.phone;
      userData.mobile = user.mobile;
      userData.hospitalName = user.hospitalName;
      userData.centerCode = user.centerCode;
      userData.qualification = user.qualification;
      userData.designation = user.designation;
      userData.kmcNumber = user.kmcNumber;
      // Add centerName from populated centerId
      if (user.centerId && user.centerId.name) {
        userData.centerName = user.centerId.name;
      }
    } else if (userType === 'LabStaff') {
      userData.name = user.staffName; // Map staffName to name for consistency
      userData.phone = user.phone;
      userData.staffName = user.staffName;
      userData.labId = user.labId;
    } else if (userType === 'SuperAdminDoctor') {
      userData.isSuperAdminStaff = user.isSuperAdminStaff;
      userData.mobile = user.mobile;
      userData.hospitalName = user.hospitalName;
      userData.qualification = user.qualification;
      userData.designation = user.designation;
      userData.kmcNumber = user.kmcNumber;
    } else if (userType === 'SuperAdminReceptionist') {
      userData.isSuperAdminStaff = user.isSuperAdminStaff;
      userData.mobile = user.mobile;
      userData.address = user.address;
      userData.emergencyContact = user.emergencyContact;
      userData.emergencyContactName = user.emergencyContactName;
    }

    res.json({
      user: userData,
      token: token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('centerId', 'name code').select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id);

    if (user) {
      user.name = name || user.name;
      user.email = email || user.email;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        token: generateToken(updatedUser, 'User')
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Find user in different models
    let user = await User.findOne({ email });
    let userType = 'User';

    if (!user) {
      user = await LabStaff.findOne({ email });
      userType = 'LabStaff';
    }

    if (!user) {
      user = await SuperAdminDoctor.findOne({ email });
      userType = 'SuperAdminDoctor';
    }

    if (!user) {
      user = await SuperAdminReceptionist.findOne({ email });
      userType = 'SuperAdminReceptionist';
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    // Try to find user in different models
    let user = await User.findById(req.user.id).populate('centerId', 'name code').select('-password');
    let userType = 'User';

    if (!user) {
      user = await LabStaff.findById(req.user.id).select('-password');
      userType = 'LabStaff';
    }

    if (!user) {
      user = await SuperAdminDoctor.findById(req.user.id).select('-password');
      userType = 'SuperAdminDoctor';
    }

    if (!user) {
      user = await SuperAdminReceptionist.findById(req.user.id).select('-password');
      userType = 'SuperAdminReceptionist';
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prepare response based on user type
    let userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      userType: userType
    };

    // Add specific fields based on user type
    if (userType === 'User') {
      userData.centerId = user.centerId;
      userData.phone = user.phone;
      userData.mobile = user.mobile;
      userData.hospitalName = user.hospitalName;
      userData.centerCode = user.centerCode;
      userData.qualification = user.qualification;
      userData.designation = user.designation;
      userData.kmcNumber = user.kmcNumber;
      userData.specializations = user.specializations;
      userData.experience = user.experience;
      userData.bio = user.bio;
      userData.status = user.status;
      // Add centerName from populated centerId
      if (user.centerId && user.centerId.name) {
        userData.centerName = user.centerId.name;
      }
    } else if (userType === 'LabStaff') {
      userData.name = user.staffName; // Map staffName to name for consistency
      userData.phone = user.phone;
      userData.staffName = user.staffName;
      userData.labId = user.labId;
    } else if (userType === 'SuperAdminDoctor') {
      userData.isSuperAdminStaff = user.isSuperAdminStaff;
      userData.mobile = user.mobile;
      userData.hospitalName = user.hospitalName;
      userData.qualification = user.qualification;
      userData.designation = user.designation;
      userData.kmcNumber = user.kmcNumber;
      userData.specializations = user.specializations;
      userData.experience = user.experience;
      userData.bio = user.bio;
    } else if (userType === 'SuperAdminReceptionist') {
      userData.isSuperAdminStaff = user.isSuperAdminStaff;
      userData.mobile = user.mobile;
      userData.address = user.address;
      userData.emergencyContact = user.emergencyContact;
      userData.emergencyContactName = user.emergencyContactName;
    }

    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
