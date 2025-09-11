import UserSession from '../models/UserSession.js';
import LoginHistory from '../models/LoginHistory.js';
import { parseDeviceInfo, getLocationInfo, generateSessionId, getClientIP } from '../utils/sessionUtils.js';

// Create new session on login
export const createSession = async (req, res) => {
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
      token: req.headers.authorization?.replace('Bearer ', ''),
      deviceInfo,
      locationInfo,
      centerId,
      userRole,
      userType
    });
    
    res.status(201).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        loginTime: session.loginTime,
        deviceInfo: session.deviceInfo,
        locationInfo: session.locationInfo
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create session',
      error: error.message 
    });
  }
};

// Get all active sessions (Superadmin only)
export const getAllActiveSessions = async (req, res) => {
  try {
    const sessions = await UserSession.find({ isActive: true })
      .populate('userId', 'name username email role userType centerId')
      .populate('centerId', 'name address code')
      .sort({ loginTime: -1 });
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        _id: session._id,
        sessionId: session.sessionId,
        userId: session.userId,
        centerId: session.centerId,
        userRole: session.userRole,
        userType: session.userType,
        deviceInfo: session.deviceInfo,
        locationInfo: session.locationInfo,
        loginTime: session.loginTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive
      }))
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch active sessions',
      error: error.message 
    });
  }
};

// Get sessions by center
export const getSessionsByCenter = async (req, res) => {
  try {
    const { centerId } = req.params;
    const sessions = await UserSession.find({ centerId, isActive: true })
      .populate('userId', 'name username email role userType')
      .sort({ loginTime: -1 });
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        _id: session._id,
        sessionId: session.sessionId,
        userId: session.userId,
        userRole: session.userRole,
        userType: session.userType,
        deviceInfo: session.deviceInfo,
        locationInfo: session.locationInfo,
        loginTime: session.loginTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive
      }))
    });
  } catch (error) {
    console.error('Error fetching center sessions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch center sessions',
      error: error.message 
    });
  }
};

// Get active sessions for a specific user
export const getUserActiveSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await UserSession.getActiveSessions(userId);
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        _id: session._id,
        sessionId: session.sessionId,
        deviceInfo: session.deviceInfo,
        locationInfo: session.locationInfo,
        loginTime: session.loginTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive
      }))
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user sessions',
      error: error.message 
    });
  }
};

// Update session activity
export const updateSessionActivity = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.findOne({ sessionId, isActive: true });
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found or inactive' 
      });
    }
    
    await session.updateActivity();
    
    res.json({
      success: true,
      message: 'Session activity updated',
      lastActivity: session.lastActivity
    });
  } catch (error) {
    console.error('Error updating session activity:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update session activity',
      error: error.message 
    });
  }
};

// Logout session
export const logoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.findOne({ sessionId, isActive: true });
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found or already logged out' 
      });
    }
    
    await session.logout();
    
    // Update login history with logout time
    try {
      const loginRecord = await LoginHistory.findOne({ 
        userId: session.userId, 
        logoutTime: null 
      }).sort({ loginTime: -1 });
      
      if (loginRecord) {
        loginRecord.logoutTime = new Date();
        loginRecord.calculateDuration();
        await loginRecord.save();
      }
    } catch (historyError) {
      console.error('Error updating login history:', historyError);
      // Don't fail the logout if history update fails
    }
    
    res.json({
      success: true,
      message: 'Session logged out successfully',
      logoutTime: session.logoutTime
    });
  } catch (error) {
    console.error('Error logging out session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to logout session',
      error: error.message 
    });
  }
};

// Force logout all sessions for a user
export const forceLogoutUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await UserSession.find({ userId, isActive: true });
    
    for (const session of sessions) {
      await session.logout();
    }
    
    res.json({
      success: true,
      message: `Logged out ${sessions.length} active sessions`,
      loggedOutSessions: sessions.length
    });
  } catch (error) {
    console.error('Error force logging out user sessions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to force logout sessions',
      error: error.message 
    });
  }
};

// Get session statistics
export const getSessionStats = async (req, res) => {
  try {
    const totalSessions = await UserSession.countDocuments();
    const activeSessions = await UserSession.countDocuments({ isActive: true });
    const sessionsByRole = await UserSession.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$userRole', count: { $sum: 1 } } }
    ]);
    const sessionsByCenter = await UserSession.aggregate([
      { $match: { isActive: true, centerId: { $exists: true } } },
      { $group: { _id: '$centerId', count: { $sum: 1 } } },
      { $lookup: { from: 'centers', localField: '_id', foreignField: '_id', as: 'center' } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalSessions,
        activeSessions,
        sessionsByRole,
        sessionsByCenter
      }
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch session statistics',
      error: error.message 
    });
  }
};
