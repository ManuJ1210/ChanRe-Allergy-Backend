import mongoose from 'mongoose';
import UserSession from './models/UserSession.js';
import LoginHistory from './models/LoginHistory.js';
import { getLocationInfo } from './utils/sessionUtils.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/chenre-allergy';
    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Update location info for existing sessions
const updateSessionLocations = async () => {
  try {
    console.log('Updating session locations...');
    
    // Find sessions with unknown location
    const sessions = await UserSession.find({
      $or: [
        { 'locationInfo.country': 'Unknown' },
        { 'locationInfo.country': { $exists: false } }
      ]
    });
    
    console.log(`Found ${sessions.length} sessions with unknown location`);
    
    let updated = 0;
    for (const session of sessions) {
      try {
        // Get the IP from the session (if available)
        const ip = session.locationInfo?.ip || '127.0.0.1';
        
        // Get updated location info
        const newLocationInfo = await getLocationInfo(ip);
        
        // Update the session
        await UserSession.findByIdAndUpdate(session._id, {
          locationInfo: newLocationInfo
        });
        
        updated++;
        console.log(`Updated session ${session.sessionId}: ${newLocationInfo.city}, ${newLocationInfo.country}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error updating session ${session.sessionId}:`, error.message);
      }
    }
    
    console.log(`✅ Updated ${updated} sessions`);
    
  } catch (error) {
    console.error('Error updating sessions:', error);
  }
};

// Update location info for existing login history
const updateLoginHistoryLocations = async () => {
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
        
        // Get updated location info
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
    
    console.log(`✅ Updated ${updated} login history records`);
    
  } catch (error) {
    console.error('Error updating login history:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting location data update...\n');
    
    await updateSessionLocations();
    console.log('');
    await updateLoginHistoryLocations();
    
    console.log('\n✅ Location update completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
};

main();
