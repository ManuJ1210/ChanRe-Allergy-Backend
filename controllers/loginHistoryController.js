import LoginHistory from '../models/LoginHistory.js';

// Get login history for a specific user
export const getUserLoginHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    const loginHistory = await LoginHistory.getUserLoginHistory(userId, parseInt(limit));
    
    res.json({
      success: true,
      loginHistory: loginHistory.map(login => ({
        _id: login._id,
        userId: login.userId,
        centerId: login.centerId,
        userRole: login.userRole,
        userType: login.userType,
        loginTime: login.loginTime,
        logoutTime: login.logoutTime,
        sessionDuration: login.sessionDuration,
        deviceInfo: login.deviceInfo,
        locationInfo: login.locationInfo,
        loginStatus: login.loginStatus
      }))
    });
  } catch (error) {
    console.error('Error fetching user login history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user login history',
      error: error.message 
    });
  }
};

// Get login history for a specific center
export const getCenterLoginHistory = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { limit = 100 } = req.query;
    
    const loginHistory = await LoginHistory.getCenterLoginHistory(centerId, parseInt(limit));
    
    res.json({
      success: true,
      loginHistory: loginHistory.map(login => ({
        _id: login._id,
        userId: login.userId,
        centerId: login.centerId,
        userRole: login.userRole,
        userType: login.userType,
        loginTime: login.loginTime,
        logoutTime: login.logoutTime,
        sessionDuration: login.sessionDuration,
        deviceInfo: login.deviceInfo,
        locationInfo: login.locationInfo,
        loginStatus: login.loginStatus
      }))
    });
  } catch (error) {
    console.error('Error fetching center login history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch center login history',
      error: error.message 
    });
  }
};

// Get recent logins across all centers (Superadmin only)
export const getRecentLogins = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const recentLogins = await LoginHistory.getRecentLogins(parseInt(limit));
    
    res.json({
      success: true,
      recentLogins: recentLogins.map(login => ({
        _id: login._id,
        userId: login.userId,
        centerId: login.centerId,
        userRole: login.userRole,
        userType: login.userType,
        loginTime: login.loginTime,
        logoutTime: login.logoutTime,
        sessionDuration: login.sessionDuration,
        deviceInfo: login.deviceInfo,
        locationInfo: login.locationInfo,
        loginStatus: login.loginStatus
      }))
    });
  } catch (error) {
    console.error('Error fetching recent logins:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent logins',
      error: error.message 
    });
  }
};

// Get login statistics
export const getLoginStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await LoginHistory.getLoginStats(startDate, endDate);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching login stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch login statistics',
      error: error.message 
    });
  }
};

// Update logout time for a login history record
export const updateLogoutTime = async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.body;
    
    // Find the most recent active login for this user
    const loginRecord = await LoginHistory.findOne({ 
      userId, 
      logoutTime: null 
    }).sort({ loginTime: -1 });
    
    if (!loginRecord) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active login found for this user' 
      });
    }
    
    loginRecord.logoutTime = new Date();
    loginRecord.calculateDuration();
    await loginRecord.save();
    
    res.json({
      success: true,
      message: 'Logout time updated successfully',
      loginRecord: {
        _id: loginRecord._id,
        loginTime: loginRecord.loginTime,
        logoutTime: loginRecord.logoutTime,
        sessionDuration: loginRecord.sessionDuration
      }
    });
  } catch (error) {
    console.error('Error updating logout time:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update logout time',
      error: error.message 
    });
  }
};
