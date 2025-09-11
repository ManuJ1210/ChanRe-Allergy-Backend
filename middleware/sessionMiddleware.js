import UserSession from '../models/UserSession.js';
import { parseDeviceInfo, getLocationInfo, generateSessionId, getClientIP } from '../utils/sessionUtils.js';

// Middleware to create session on login
export const createLoginSession = async (req, res, next) => {
  try {
    const { userId, userRole, userType, centerId } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const clientIP = getClientIP(req);
    
    // Parse device information
    const deviceInfo = parseDeviceInfo(userAgent);
    
    // Get location information
    const locationInfo = await getLocationInfo(clientIP);
    
    // Generate unique session ID
    const sessionId = generateSessionId();
    
    // Create session
    const session = await UserSession.create({
      userId,
      sessionId,
      token: res.locals.token || req.headers.authorization?.replace('Bearer ', ''),
      deviceInfo,
      locationInfo,
      centerId,
      userRole,
      userType
    });
    
    // Add session info to response
    res.locals.session = session;
    next();
  } catch (error) {
    console.error('Error creating session:', error);
    // Don't block login if session creation fails
    next();
  }
};

// Middleware to update session activity
export const updateSessionActivity = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const session = await UserSession.findOne({ 
        token: token, 
        isActive: true 
      });
      if (session) {
        await session.updateActivity();
      }
    }
    next();
  } catch (error) {
    console.error('Error updating session activity:', error);
    // Don't block the request if session update fails
    next();
  }
};

// Middleware to logout session
export const logoutSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const session = await UserSession.findOne({ 
        token: token, 
        isActive: true 
      });
      if (session) {
        await session.logout();
      }
    }
    next();
  } catch (error) {
    console.error('Error logging out session:', error);
    // Don't block logout if session update fails
    next();
  }
};
