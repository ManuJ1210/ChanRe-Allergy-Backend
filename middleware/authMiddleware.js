import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LabStaff from '../models/LabStaff.js';
import SuperAdminDoctor from '../models/SuperAdminDoctor.js';
import SuperAdminReceptionist from '../models/SuperAdminReceptionist.js';
import UserSession from '../models/UserSession.js';


export const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Use environment variable or fallback to a default secret
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
      const decoded = jwt.verify(token, jwtSecret);
      
      // First try to find user in User model
      let user = await User.findById(decoded.id).select('-password').populate('centerId', 'name code');
      
      // If not found in User model, try LabStaff model
      if (!user) {
        user = await LabStaff.findById(decoded.id).select('-password');
      }
      
      // If not found in LabStaff model, try SuperAdminDoctor model
      if (!user) {
        user = await SuperAdminDoctor.findById(decoded.id).select('-password');
      }
      
      // If not found in SuperAdminDoctor model, try SuperAdminReceptionist model
      if (!user) {
        user = await SuperAdminReceptionist.findById(decoded.id).select('-password');
      }
      
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      
      // Preserve the userType from the JWT token
      user.userType = decoded.userType;
      
      
      req.user = user;
      
      // Update session activity if session exists
      try {
        const session = await UserSession.findOne({ 
          token: token, 
          isActive: true 
        });
        if (session) {
          await session.updateActivity();
        }
      } catch (sessionError) {
        // Don't block the request if session update fails
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const checkSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'superadmin' || req.user.isSuperAdminStaff === true)) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Superadmin only.' });
  }
};

// Check if user has access to center-specific data
export const checkCenterAccess = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  next();
};

// Ensure center isolation for data access
export const ensureCenterIsolation = (req, res, next) => {
  
  // Superadmin can access all data
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  
  // Lab staff can access lab-related endpoints
  if (req.user && req.user.userType === 'LabStaff') {
    return next();
  }
  
  
  
  // Check for different possible role field names
  const userRole = req.user?.role || req.user?.userRole || req.user?.userType;
  
  // Allow receptionists and accountants (either by role or by userType being 'User' with role 'receptionist' or 'accountant')
  if (req.user && (userRole === 'receptionist' || userRole === 'accountant' || (req.user.userType === 'User' && (req.user.role === 'receptionist' || req.user.role === 'accountant')))) {
    return next();
  }
  
  // For all other roles, ensure they have a centerId
  // Exception: Receptionists and accountants can work without centerId for billing operations
  if (!req.user || (!req.user.centerId && req.user.role !== 'receptionist' && req.user.role !== 'accountant')) {
    return res.status(403).json({ 
      message: 'Access denied. Center-specific access required. User must be assigned to a center.',
      debug: {
        hasUser: !!req.user,
        hasCenterId: !!req.user?.centerId,
        userRole: req.user?.role,
        userType: req.user?.userType,
        userId: req.user?._id,
        userName: req.user?.name
      }
    });
  }
  
  // Normalize centerId to always be a string for consistent comparison
  if (req.user.centerId && typeof req.user.centerId === 'object' && req.user.centerId._id) {
    req.user.centerId = req.user.centerId._id;
  }
  
  next();
};


 
// Require specific roles
export const ensureRole = (...roles) => (req, res, next) => {
  try {
    const userRole = req.user?.role;
    if (userRole && roles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ message: 'Access denied.' });
  } catch (e) {
    return res.status(403).json({ message: 'Access denied.' });
  }
};

export const ensureDoctor = (req, res, next) => {
  if (req.user && req.user.role === 'doctor') return next();
  return res.status(403).json({ message: 'Only doctors can perform this action.' });
};

// Allow both doctors and receptionists to perform patient-related actions
export const ensureDoctorOrReceptionist = (req, res, next) => {
  if (req.user && (req.user.role === 'doctor' || req.user.role === 'receptionist')) {
    return next();
  }
  return res.status(403).json({ message: 'Only doctors and receptionists can perform this action.' });
};

// Allow doctors and CenterAdmin to perform patient management actions
export const ensureDoctorOrCenterAdmin = (req, res, next) => {
  
  if (req.user && (req.user.role === 'doctor' || req.user.role === 'centeradmin')) {
    return next();
  }
  
  return res.status(403).json({ message: 'Only doctors and CenterAdmin can perform this action.' });
};

  // Allow center admin, center receptionist, center doctor, and accountant to perform patient management actions
export const ensureCenterStaffOrDoctor = (req, res, next) => {
  console.log('🔍 ensureCenterStaffOrDoctor check:', {
    userRole: req.user?.role,
    userId: req.user?._id,
    userName: req.user?.name,
    username: req.user?.username,
    userType: req.user?.userType,
    centerId: req.user?.centerId
  });
  
  // Allow center admin, center receptionist, center doctor, and accountant
  if (req.user && (
    req.user.role === 'centeradmin' || 
    req.user.role === 'receptionist' || 
    req.user.role === 'doctor' ||
    req.user.role === 'accountant'
  )) {
    console.log('✅ ensureCenterStaffOrDoctor access granted for role:', req.user.role);
    return next();
  }
  
  console.log('❌ ensureCenterStaffOrDoctor access denied for role:', req.user?.role);
  return res.status(403).json({ 
    message: 'Only center admin, center receptionist, center doctor, and accountant can perform this action.' 
  });
};



