import mongoose from 'mongoose';
import TestRequest from './models/TestRequest.js';
import Center from './models/Center.js';

async function fixCenterData() {
  try {
    console.log('🔧 Starting data cleanup...');
    await mongoose.connect('mongodb://localhost:27017/chanre-allergy');
    console.log('✅ Connected to database');
    
    // Get all centers
    const centers = await Center.find({}).select('_id centername name centerCode');
    console.log('🔧 Found centers:', centers.map(c => ({
      id: c._id.toString(),
      name: c.centername || c.name,
      code: c.centerCode
    })));
    
    // Get all test requests with billing
    const testRequests = await TestRequest.find({
      isActive: true,
      billing: { $exists: true, $ne: null }
    }).select('centerId centerName centerCode patientName billing.amount');
    
    console.log('🔧 Found test requests with billing:', testRequests.length);
    
    // Show current data
    console.log('\n📊 CURRENT DATA:');
    testRequests.forEach((item, index) => {
      console.log(`${index + 1}. CenterId: ${item.centerId}, CenterName: ${item.centerName}, Patient: ${item.patientName}, Amount: ${item.billing?.amount}`);
    });
    
    let updatedCount = 0;
    let reassignedCount = 0;
    
    console.log('\n🔧 FIXING DATA...');
    
    for (const testRequest of testRequests) {
      const currentCenter = centers.find(c => c._id.toString() === testRequest.centerId.toString());
      const nameBasedCenter = centers.find(c => 
        (c.centername || c.name) === testRequest.centerName
      );
      
      if (currentCenter) {
        // Center ID is correct, just fix name/code if needed
        const correctCenterName = currentCenter.centername || currentCenter.name;
        const correctCenterCode = currentCenter.centerCode;
        
        if (testRequest.centerName !== correctCenterName || testRequest.centerCode !== correctCenterCode) {
          console.log(`🔧 Updating center info for ${testRequest.patientName}:`);
          console.log(`   Old: ${testRequest.centerName} (${testRequest.centerCode})`);
          console.log(`   New: ${correctCenterName} (${correctCenterCode})`);
          
          await TestRequest.updateOne(
            { _id: testRequest._id },
            { 
              centerName: correctCenterName,
              centerCode: correctCenterCode
            }
          );
          
          updatedCount++;
        }
      } else if (nameBasedCenter) {
        // Center ID is wrong, but center name matches a real center - reassign
        console.log(`🔧 Reassigning ${testRequest.patientName} to correct center:`);
        console.log(`   Old CenterId: ${testRequest.centerId}`);
        console.log(`   New CenterId: ${nameBasedCenter._id}`);
        console.log(`   Center: ${testRequest.centerName}`);
        
        await TestRequest.updateOne(
          { _id: testRequest._id },
          { 
            centerId: nameBasedCenter._id,
            centerName: nameBasedCenter.centername || nameBasedCenter.name,
            centerCode: nameBasedCenter.centerCode
          }
        );
        
        reassignedCount++;
      } else {
        console.log(`⚠️ No matching center found for ${testRequest.patientName}:`);
        console.log(`   CenterId: ${testRequest.centerId}`);
        console.log(`   CenterName: ${testRequest.centerName}`);
      }
    }
    
    console.log(`\n✅ CLEANUP COMPLETE:`);
    console.log(`   - Fixed ${updatedCount} center names`);
    console.log(`   - Reassigned ${reassignedCount} test requests`);
    
    // Verify the fix
    console.log('\n📊 VERIFICATION:');
    const updatedRequests = await TestRequest.find({
      isActive: true,
      billing: { $exists: true, $ne: null }
    }).select('centerId centerName centerCode patientName billing.amount');
    
    updatedRequests.forEach((item, index) => {
      const center = centers.find(c => c._id.toString() === item.centerId.toString());
      console.log(`${index + 1}. CenterId: ${item.centerId}, CenterName: ${item.centerName}, Patient: ${item.patientName}, Amount: ${item.billing?.amount}`);
      console.log(`   ✅ Matches Center: ${center ? (center.centername || center.name) : 'NOT FOUND'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCenterData();
