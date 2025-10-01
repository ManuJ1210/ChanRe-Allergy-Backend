import mongoose from 'mongoose';
import xlsx from 'xlsx';
import LabTest from './models/LabTest.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/allergy-clinic';

/**
 * Import lab tests from Excel file
 * Expected Excel columns: Code, Test Name, Cost
 * You can also have optional columns: Category, Description, Sample Type, Preparation Required, Report Delivery Time
 */
async function importLabTests() {
  try {
    console.log('🚀 Starting lab test import...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read the Excel file
    const excelFilePath = process.argv[2];
    
    if (!excelFilePath) {
      console.error('❌ Please provide the Excel file path as an argument');
      console.log('Usage: node import-lab-tests.js <path-to-excel-file>');
      console.log('Example: node import-lab-tests.js ./lab-tests.xlsx');
      process.exit(1);
    }

    console.log(`📖 Reading Excel file: ${excelFilePath}`);
    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0]; // Read first sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${jsonData.length} tests in Excel file`);

    // Map and validate the data
    const labTests = [];
    const errors = [];

    jsonData.forEach((row, index) => {
      try {
        // Map column names (case-insensitive)
        const getColumnValue = (possibleNames) => {
          for (const name of possibleNames) {
            const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
            if (key && row[key]) return row[key];
          }
          return null;
        };

        const testCode = getColumnValue(['Code', 'Test Code', 'TestCode', 'code']);
        const testName = getColumnValue(['Test Name', 'TestName', 'Name', 'test name', 'name']);
        const cost = getColumnValue(['Cost', 'Price', 'Amount', 'cost', 'price']);
        const category = getColumnValue(['Category', 'Type', 'category', 'type']);
        const description = getColumnValue(['Description', 'Details', 'description', 'details']);
        const sampleType = getColumnValue(['Sample Type', 'SampleType', 'Sample', 'sample type', 'sample']);
        const preparationRequired = getColumnValue(['Preparation Required', 'Preparation', 'PreparationRequired', 'preparation']);
        const reportDeliveryTime = getColumnValue(['Report Delivery Time', 'Delivery Time', 'TAT', 'report delivery time']);

        if (!testCode || !testName || cost === null) {
          errors.push({
            row: index + 2, // +2 because Excel rows start at 1 and first row is header
            reason: `Missing required fields (Code: ${testCode}, Name: ${testName}, Cost: ${cost})`
          });
          return;
        }

        labTests.push({
          testCode: String(testCode).trim().toUpperCase(),
          testName: String(testName).trim(),
          cost: parseFloat(cost),
          category: category ? String(category).trim() : 'General',
          description: description ? String(description).trim() : '',
          sampleType: sampleType ? String(sampleType).trim() : '',
          preparationRequired: preparationRequired ? String(preparationRequired).trim() : '',
          reportDeliveryTime: reportDeliveryTime ? String(reportDeliveryTime).trim() : '24-48 hours',
          isActive: true
        });
      } catch (error) {
        errors.push({
          row: index + 2,
          reason: error.message
        });
      }
    });

    if (errors.length > 0) {
      console.log(`⚠️  Found ${errors.length} errors:`);
      errors.slice(0, 10).forEach(error => {
        console.log(`   Row ${error.row}: ${error.reason}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }

    console.log(`✅ Successfully parsed ${labTests.length} valid tests`);

    if (labTests.length === 0) {
      console.log('❌ No valid tests to import');
      process.exit(1);
    }

    // Ask for confirmation
    console.log('\n⚠️  About to import tests. This will:');
    console.log('   1. Remove all existing lab tests from the database');
    console.log(`   2. Insert ${labTests.length} new tests`);
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Clear existing tests
    const deleteResult = await LabTest.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing tests`);

    // Insert new tests in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < labTests.length; i += batchSize) {
      const batch = labTests.slice(i, i + batchSize);
      try {
        await LabTest.insertMany(batch, { ordered: false });
        inserted += batch.length;
        console.log(`✅ Inserted ${inserted}/${labTests.length} tests`);
      } catch (error) {
        // Handle duplicate key errors
        if (error.code === 11000) {
          console.log(`⚠️  Some tests in batch ${i / batchSize + 1} were duplicates`);
          // Try inserting one by one for this batch
          for (const test of batch) {
            try {
              await LabTest.create(test);
              inserted++;
            } catch (err) {
              if (err.code !== 11000) {
                console.error(`❌ Error inserting test ${test.testCode}: ${err.message}`);
              }
            }
          }
          console.log(`✅ Processed ${inserted}/${labTests.length} tests`);
        } else {
          throw error;
        }
      }
    }

    console.log(`\n🎉 Successfully imported ${inserted} lab tests!`);
    
    // Show some statistics
    const totalTests = await LabTest.countDocuments();
    const categories = await LabTest.distinct('category');
    const avgCost = await LabTest.aggregate([
      { $group: { _id: null, avgCost: { $avg: '$cost' } } }
    ]);

    console.log('\n📊 Database Statistics:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Categories: ${categories.length} (${categories.join(', ')})`);
    console.log(`   Average Cost: ₹${avgCost[0]?.avgCost?.toFixed(2) || 0}`);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the import
importLabTests();

