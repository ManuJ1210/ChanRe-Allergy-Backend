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
    
    console.log('Fetching recent logins with limit:', limit);
    
    const recentLogins = await LoginHistory.getRecentLogins(parseInt(limit));
    
    console.log('Raw recentLogins from DB:', JSON.stringify(recentLogins.slice(0, 2), null, 2)); // Debug log
    
    if (!recentLogins || !Array.isArray(recentLogins)) {
      console.error('recentLogins is not an array:', recentLogins);
      return res.status(500).json({
        success: false,
        message: 'Invalid data received from database'
      });
    }
    
    res.json({
      success: true,
      recentLogins: recentLogins.map(login => {
        try {
          return {
            _id: login._id,
            userId: login.userId ? {
              _id: login.userId._id,
              name: login.userId.name || 'Unknown User',
              username: login.userId.username || 'No username',
              email: login.userId.email || 'No email',
              role: login.userId.role || 'Unknown'
            } : {
              _id: null,
              name: 'Unknown User',
              username: 'No username',
              email: 'No email',
              role: 'Unknown'
            },
            centerId: login.centerId ? {
              _id: login.centerId._id,
              name: login.centerId.name || 'Unknown Center',
              address: login.centerId.address || 'No address',
              code: login.centerId.code || 'No code'
            } : null,
            userRole: login.userRole,
            userType: login.userType,
            loginTime: login.loginTime,
            logoutTime: login.logoutTime,
            sessionDuration: login.sessionDuration,
            deviceInfo: login.deviceInfo,
            locationInfo: login.locationInfo,
            loginStatus: login.loginStatus
          };
        } catch (mapError) {
          console.error('Error mapping login record:', mapError, 'Login data:', login);
          return {
            _id: login._id || 'Unknown',
            userId: { name: 'Error loading user', username: 'Error', email: 'Error', role: 'Error' },
            centerId: null,
            userRole: login.userRole || 'Unknown',
            userType: login.userType || 'Unknown',
            loginTime: login.loginTime,
            logoutTime: login.logoutTime,
            sessionDuration: login.sessionDuration,
            deviceInfo: login.deviceInfo,
            locationInfo: login.locationInfo,
            loginStatus: login.loginStatus
          };
        }
      })
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

// Delete login history record
export const deleteLoginHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const loginRecord = await LoginHistory.findByIdAndDelete(id);
    
    if (!loginRecord) {
      return res.status(404).json({ 
        success: false, 
        message: 'Login history record not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Login history record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting login history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete login history record',
      error: error.message 
    });
  }
};

// Bulk delete login history records
export const bulkDeleteLoginHistory = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Login history IDs array is required'
      });
    }

    const result = await LoginHistory.deleteMany({ _id: { $in: ids } });
    
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} login history records`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting login history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk delete login history records',
      error: error.message 
    });
  }
};

// Delete all login history records
export const deleteAllLoginHistory = async (req, res) => {
  try {
    const result = await LoginHistory.deleteMany({});
    
    res.json({
      success: true,
      message: `Deleted all ${result.deletedCount} login history records`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all login history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete all login history records',
      error: error.message
    });
  }
};

// Update location info for existing login history records (Superadmin only)
export const updateLoginHistoryLocations = async (req, res) => {
  try {
    console.log('Updating login history locations...');
    
    // Find login history records with unknown location
    const loginHistory = await LoginHistory.find({
      $or: [
        { 'locationInfo.country': 'Unknown' },
        { 'locationInfo.country': { $exists: false } }
      ]
    });
    
    console.log(`Found ${loginHistory.length} login history records with unknown location`);
    
    let updated = 0;
    for (const record of loginHistory) {
      try {
        // Get the IP from the record (if available)
        const ip = record.locationInfo?.ip || '127.0.0.1';
        
        // Get updated location info using the new function
        const { getLocationInfo } = await import('../utils/sessionUtils.js');
        const newLocationInfo = await getLocationInfo(ip);
        
        // Update the record
        await LoginHistory.findByIdAndUpdate(record._id, {
          locationInfo: newLocationInfo
        });
        
        updated++;
        console.log(`Updated login history ${record._id}: ${newLocationInfo.city}, ${newLocationInfo.country}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error updating login history ${record._id}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Updated ${updated} login history records with new location data`,
      updatedCount: updated,
      totalFound: loginHistory.length
    });
    
  } catch (error) {
    console.error('Error updating login history locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update login history locations',
      error: error.message
    });
  }
};