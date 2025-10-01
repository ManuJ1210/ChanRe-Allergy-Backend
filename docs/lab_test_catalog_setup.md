# Lab Test Catalog Setup Guide

## Overview

This guide explains how to set up and use the lab test catalog system for the ChanRe Allergy Clinic. The system allows you to:
- Import tests from an Excel file into the database
- Search and select tests from a catalog of 1000+ tests
- Automatically calculate test costs
- Manage test requests with structured test data

---

## 🚀 Quick Start

### Step 1: Install Dependencies

Navigate to the backend directory and install the required packages:

```bash
cd "d:\02 Internal project\Manu\ChanRe-Allergy-Backend"
npm install
```

This will install the `xlsx` package required for Excel import.

---

## 📊 Importing Lab Tests from Excel

### Excel File Format

Your Excel file should have the following columns (column names are case-insensitive):

| Required Columns | Description | Example |
|-----------------|-------------|---------|
| **Code** | Unique test code | `CBC001` |
| **Test Name** | Full name of the test | `Complete Blood Count` |
| **Cost** | Test cost in INR | `500` |

| Optional Columns | Description | Example |
|-----------------|-------------|---------|
| **Category** | Test category | `Hematology` |
| **Description** | Test description | `Measures blood cell counts` |
| **Sample Type** | Type of sample needed | `Blood` |
| **Preparation Required** | Patient preparation | `8 hours fasting` |
| **Report Delivery Time** | TAT for results | `24 hours` |

### Supported Column Name Variations

The import script recognizes multiple column name variations:
- Code: `Code`, `Test Code`, `TestCode`, `code`
- Test Name: `Test Name`, `TestName`, `Name`, `test name`, `name`
- Cost: `Cost`, `Price`, `Amount`, `cost`, `price`
- Category: `Category`, `Type`, `category`, `type`

### Running the Import

1. **Place your Excel file** in an accessible location (e.g., in the backend directory)

2. **Run the import script:**

```bash
node import-lab-tests.js path/to/your/excel-file.xlsx
```

Example:
```bash
node import-lab-tests.js lab-tests.xlsx
```

3. **The script will:**
   - Read and validate the Excel file
   - Show you a preview of what will be imported
   - Give you 5 seconds to cancel (Ctrl+C)
   - Delete existing tests from the database
   - Import the new tests in batches
   - Show statistics about the imported tests

### Import Output Example

```
🚀 Starting lab test import...
✅ Connected to MongoDB
📖 Reading Excel file: lab-tests.xlsx
📊 Found 1135 tests in Excel file
✅ Successfully parsed 1135 valid tests

⚠️  About to import tests. This will:
   1. Remove all existing lab tests from the database
   2. Insert 1135 new tests

Press Ctrl+C to cancel, or wait 5 seconds to continue...

🗑️  Deleted 0 existing tests
✅ Inserted 100/1135 tests
✅ Inserted 200/1135 tests
...
✅ Inserted 1135/1135 tests

🎉 Successfully imported 1135 lab tests!

📊 Database Statistics:
   Total Tests: 1135
   Categories: 15 (Hematology, Biochemistry, Immunology, ...)
   Average Cost: ₹750.50
```

---

## 🔧 Backend API Endpoints

The following API endpoints are now available:

### Search Tests (for autocomplete)
```
GET /api/lab-tests/search?q=<search_term>
```
Returns up to 20 matching tests for typeahead search.

### Get All Tests (with pagination)
```
GET /api/lab-tests/all?search=<term>&category=<category>&page=1&limit=100
```
Returns paginated list of tests with optional filters.

### Get Test by ID
```
GET /api/lab-tests/:id
```
Returns a specific test by MongoDB ID.

### Get Test by Code
```
GET /api/lab-tests/code/:code
```
Returns a specific test by test code.

### Get Test Categories
```
GET /api/lab-tests/categories
```
Returns list of all test categories.

### Get Test Statistics
```
GET /api/lab-tests/statistics
```
Returns statistics about tests (count, categories, cost ranges).

---

## 💻 Frontend Usage

### For Doctors: Adding Test Requests

1. **Navigate to Test Requests** → Click "Add Test Request"

2. **Select a Patient** from the dropdown

3. **Search for Tests:**
   - Type at least 2 characters in the "Select Tests" search box
   - Search by test name or test code
   - Results appear instantly with debounced search

4. **Add Tests:**
   - Click on any test from the dropdown to add it
   - Test will appear in the "Selected Tests" section
   - Total cost is automatically calculated

5. **Remove Tests:**
   - Click the trash icon next to any selected test to remove it

6. **Complete the Form:**
   - Select urgency level (Normal, Urgent, Emergency)
   - Add optional notes
   - Click "Create Test Request"

### Features

- **Real-time Search**: Tests are searched as you type with 300ms debounce
- **Duplicate Prevention**: Can't add the same test twice
- **Cost Calculation**: Automatically shows total cost
- **Multiple Selection**: Add multiple tests to one request
- **Visual Feedback**: Selected tests are clearly displayed with cost breakdown

---

## 📝 Data Model

### LabTest Schema

```javascript
{
  testCode: String,        // Unique, uppercase, required
  testName: String,        // Required
  cost: Number,            // Required, minimum 0
  category: String,        // Optional, default: 'General'
  description: String,     // Optional
  sampleType: String,      // Optional
  preparationRequired: String,  // Optional
  reportDeliveryTime: String,   // Optional, default: '24-48 hours'
  isActive: Boolean,       // Default: true
  createdAt: Date,
  updatedAt: Date
}
```

### TestRequest Schema (Updated)

```javascript
{
  // ... existing fields ...
  
  // New field for structured test data
  selectedTests: [{
    testId: ObjectId,      // Reference to LabTest
    testCode: String,      // Cached test code
    testName: String,      // Cached test name
    cost: Number,          // Cached cost
    quantity: Number       // Default: 1
  }],
  
  // Legacy fields (auto-generated from selectedTests)
  testType: String,        // Comma-separated test codes
  testDescription: String  // Comma-separated test names
}
```

---

## 🔍 Troubleshooting

### Import Errors

**Problem**: Excel file not found
```
Solution: Use absolute path or ensure file is in the correct directory
```

**Problem**: Missing required columns
```
Solution: Ensure Excel has "Code", "Test Name", and "Cost" columns
```

**Problem**: Duplicate test codes
```
Solution: The script will skip duplicates and show warnings
```

### Frontend Issues

**Problem**: Tests not loading
```
Solution: 
1. Check browser console for errors
2. Verify API endpoint is accessible
3. Ensure you're logged in with valid token
```

**Problem**: Search not working
```
Solution:
1. Type at least 2 characters
2. Wait for debounce (300ms)
3. Check network tab for API calls
```

---

## 🎯 Best Practices

1. **Excel Preparation:**
   - Remove any empty rows
   - Ensure test codes are unique
   - Use consistent formatting for costs (numbers only)
   - Keep test names concise but descriptive

2. **Importing:**
   - Always backup existing data before importing
   - Import during low-traffic hours
   - Verify the count after import

3. **Using the Catalog:**
   - Use specific search terms for faster results
   - Categorize tests properly for better organization
   - Update costs regularly to maintain accuracy

---

## 📞 Support

If you encounter any issues:
1. Check the console logs for detailed error messages
2. Verify MongoDB connection
3. Ensure all dependencies are installed
4. Check file permissions for Excel files

---

## 🔄 Updating Tests

To update the test catalog:
1. Modify your Excel file
2. Run the import script again
3. The script will replace all existing tests with the new data

**Note**: This is a destructive operation. All existing tests will be deleted and replaced.

---

## 📈 Future Enhancements

Planned features:
- Bulk test editing interface
- Test usage analytics
- Popular tests quick-add
- Test package bundles
- Price history tracking

