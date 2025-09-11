import { UAParser } from 'ua-parser-js';

// Parse user agent to extract device information
export const parseDeviceInfo = (userAgent) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    userAgent: userAgent,
    platform: result.os?.name || 'Unknown',
    browser: result.browser?.name || 'Unknown',
    os: `${result.os?.name || 'Unknown'} ${result.os?.version || ''}`.trim(),
    device: result.device?.type || 'Desktop'
  };
};

// Get location information from IP (you can integrate with services like ipapi, ipinfo, etc.)
export const getLocationInfo = async (ip) => {
  try {
    // For now, return basic info. You can integrate with IP geolocation services
    // like ipapi.co, ipinfo.io, or maxmind GeoIP2
    return {
      ip: ip,
      country: 'Unknown',
      region: 'Unknown', 
      city: 'Unknown',
      timezone: 'Unknown',
      coordinates: {
        latitude: null,
        longitude: null
      }
    };
  } catch (error) {
    console.error('Error getting location info:', error);
    return {
      ip: ip,
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown', 
      timezone: 'Unknown',
      coordinates: {
        latitude: null,
        longitude: null
      }
    };
  }
};

// Generate unique session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get client IP from request
export const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip ||
         '127.0.0.1';
};
