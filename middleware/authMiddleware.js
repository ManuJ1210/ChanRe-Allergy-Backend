import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LabStaff from '../models/LabStaff.js';
import SuperAdminDoctor from '../models/SuperAdminDoctor.js';
import SuperAdminReceptionist from '../models/SuperAdminReceptionist.js';


const protect = async (req, res, next) => {
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
      next();
    } catch (error) {
      console.error('Token validation failed', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const checkSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'superadmin' || req.user.isSuperAdminStaff === true)) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Superadmin only.' });
  }
};

// Check if user has access to center-specific data
const checkCenterAccess = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  next();
};

// Ensure center isolation for data access
const ensureCenterIsolation = (req, res, next) => {
  // Superadmin can access all data
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  
  // Lab staff can access lab-related endpoints
  if (req.user && req.user.userType === 'LabStaff') {
    return next();
  }
  
  // For all other roles, ensure they have a centerId
  if (!req.user || !req.user.centerId) {
    return res.status(403).json({ 
      message: 'Access denied. Center-specific access required.' 
    });
  }
  
  next();
};

export { protect, checkSuperAdmin, checkCenterAccess, ensureCenterIsolation };
