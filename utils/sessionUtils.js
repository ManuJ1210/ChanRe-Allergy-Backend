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
    // For localhost/private IPs, try to get the real public IP first
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || 
        ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') ||
        ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      
      // Try to get the real public IP
      try {
        console.log('Detected local IP, trying to get real public IP...');
        const publicIPResponse = await fetch('https://api.ipify.org?format=json', {
          timeout: 5000
        });
        
        if (publicIPResponse.ok) {
          const publicIPData = await publicIPResponse.json();
          const publicIP = publicIPData.ip;
          console.log('Got public IP:', publicIP);
          
          // Now get location for the real public IP
          const realLocation = await getLocationFromIP(publicIP);
          if (realLocation.country !== 'Unknown') {
            return {
              ...realLocation,
              ip: `${ip} (Public: ${publicIP})` // Show both IPs
            };
          }
        }
      } catch (error) {
        console.log('Failed to get public IP, using local fallback');
      }
      
      // Fallback to local network info
      return {
        ip: ip,
        country: 'Local Network',
        region: 'Local',
        city: 'Local',
        timezone: 'Local',
        coordinates: {
          latitude: null,
          longitude: null
        }
      };
    }

    // For public IPs, get real location
    return await getLocationFromIP(ip);
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

// Helper function to get location from IP
const getLocationFromIP = async (ip) => {
  // Try to get location from ipapi.co (free service)
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      timeout: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      
      return {
        ip: ip,
        country: data.country_name || 'Unknown',
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        timezone: data.timezone || 'Unknown',
        coordinates: {
          latitude: data.latitude || null,
          longitude: data.longitude || null
        }
      };
    }
  } catch (fetchError) {
    console.log('ipapi.co failed, trying ipinfo.io...');
  }

  // Fallback to ipinfo.io
  try {
    const response = await fetch(`https://ipinfo.io/${ip}/json`, {
      timeout: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      
      return {
        ip: ip,
        country: data.country || 'Unknown',
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        timezone: data.timezone || 'Unknown',
        coordinates: {
          latitude: data.loc ? parseFloat(data.loc.split(',')[0]) : null,
          longitude: data.loc ? parseFloat(data.loc.split(',')[1]) : null
        }
      };
    }
  } catch (fetchError) {
    console.log('ipinfo.io also failed, using fallback...');
  }

  // Final fallback
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
};

// Generate unique session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get client IP from request
export const getClientIP = (req) => {
  // Check for forwarded IPs first (from proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = forwardedFor.split(',');
    const firstIP = ips[0].trim();
    if (firstIP && firstIP !== '::1' && firstIP !== '127.0.0.1') {
      return firstIP;
    }
  }
  
  // Check other headers
  const realIP = req.headers['x-real-ip'];
  if (realIP && realIP !== '::1' && realIP !== '127.0.0.1') {
    return realIP;
  }
  
  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP && cfIP !== '::1' && cfIP !== '127.0.0.1') {
    return cfIP;
  }
  
  // Fallback to connection IP
  const connectionIP = req.connection?.remoteAddress || 
                      req.socket?.remoteAddress ||
                      (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
                      req.ip;
  
  // If it's IPv6 localhost, return IPv4 localhost for consistency
  if (connectionIP === '::1' || connectionIP === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  
  return connectionIP || '127.0.0.1';
};
