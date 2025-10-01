# 📊 How to Import Your 1135 Lab Tests

## 🎯 Quick Overview

You need to create an Excel file with your 1135 tests, then import it into the database using a simple command.

---

## 📋 Step-by-Step Process

### Step 1: Create Your Excel File

1. **Open Microsoft Excel** (or Google Sheets)

2. **Create these columns in the first row:**

   | Column A | Column B | Column C | Column D (optional) |
   |----------|----------|----------|---------------------|
   | Code | Test Name | Cost | Category |

3. **Add your test data starting from row 2:**

   | Code | Test Name | Cost | Category |
   |------|-----------|------|----------|
   | CBC001 | Complete Blood Count | 500 | Hematology |
   | HB001 | Hemoglobin Test | 200 | Hematology |
   | IGE001 | Total IgE Test | 800 | Immunology |
   | ... | ... | ... | ... |
   | TEST1135 | Your Last Test | 1000 | General |

4. **Important Rules:**
   - ✅ First row = Column headers (Code, Test Name, Cost)
   - ✅ Each test code must be unique
   - ✅ Cost must be numbers only (500, not ₹500)
   - ✅ No empty rows between tests
   - ✅ 1135 rows of data (plus 1 header row = 1136 total rows)

5. **Save the file:**
   - File → Save As
   - Choose format: **Excel Workbook (.xlsx)**
   - Name it: `lab-tests.xlsx`
   - Save location: `d:\02 Internal project\Manu\ChanRe-Allergy-Backend\`

---

### Step 2: Verify Your File

Before importing, check:

- [ ] File is saved as `.xlsx` format
- [ ] File is in the backend folder
- [ ] First row has: Code, Test Name, Cost
- [ ] You have 1136 rows total (1 header + 1135 data)
- [ ] All test codes are unique
- [ ] All costs are numbers (no ₹ symbols)
- [ ] No empty rows in the middle

---

### Step 3: Import to Database

1. **Open Terminal/Command Prompt**

2. **Navigate to backend folder:**
   ```bash
   cd "d:\02 Internal project\Manu\ChanRe-Allergy-Backend"
   ```

3. **Make sure MongoDB is running!**

4. **Run the import command:**
   ```bash
   node import-lab-tests.js lab-tests.xlsx
   ```
   
   Replace `lab-tests.xlsx` with your actual filename if different.

5. **You'll see:**
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
   ```

6. **Wait 5 seconds** (or press Ctrl+C to cancel if something looks wrong)

7. **Import will run:**
   ```
   🗑️  Deleted 0 existing tests
   ✅ Inserted 100/1135 tests
   ✅ Inserted 200/1135 tests
   ✅ Inserted 300/1135 tests
   ...
   ✅ Inserted 1135/1135 tests
   
   🎉 Successfully imported 1135 lab tests!
   
   📊 Database Statistics:
      Total Tests: 1135
      Categories: 15
      Average Cost: ₹750.50
   ```

---

### Step 4: Verify Import Success

1. **Check the numbers:**
   - Total Tests should show: 1135
   - No error messages

2. **Open MongoDB Compass** (optional):
   - Connect to your database
   - Find `labtests` collection
   - Should show 1135 documents

3. **Test the API:**
   ```bash
   # Start your backend
   npm start
   ```
   
   Then in browser: `http://localhost:5000/api/lab-tests/statistics`
   
   Should show your test statistics.

---

## 🧪 Test First with Sample Data

**Recommended:** Before creating all 1135 tests, test with sample data!

1. **See file:** `test-import-guide.txt`
2. **Create a small test file** with 20 tests
3. **Import it** to verify everything works
4. **Then create** your full 1135 tests file

This way you can catch any formatting issues early!

---

## ❌ Common Errors and Solutions

### Error: "Excel file not found"

**Problem:** File not in the correct folder or wrong filename

**Solution:**
```bash
# Make sure you're in the right directory
cd "d:\02 Internal project\Manu\ChanRe-Allergy-Backend"

# List files to see what's there
dir *.xlsx

# Use the exact filename you see
node import-lab-tests.js your-exact-filename.xlsx
```

---

### Error: "Missing required fields"

**Problem:** Column names don't match

**Solution:** Check your Excel column headers. They should be exactly:
- `Code` (or Test Code, TestCode, code)
- `Test Name` (or TestName, Name, name)  
- `Cost` (or Price, Amount, cost)

---

### Error: "Invalid cost value"

**Problem:** Cost column has text or symbols

**Solution:** Remove all text from Cost column:
- ❌ Wrong: `₹500`, `Rs 500`, `500/-`, `Five hundred`
- ✅ Correct: `500`

---

### Error: "Duplicate test code: ABC123"

**Problem:** Same test code appears twice

**Solution:** 
1. Open Excel
2. Select Code column
3. Use Conditional Formatting → Highlight Duplicates
4. Fix or remove duplicates

---

### Error: "Cannot connect to MongoDB"

**Problem:** MongoDB is not running

**Solution:**
- Make sure MongoDB service is started
- Check if MongoDB Compass can connect
- Verify your MONGO_URI in .env file

---

## 📝 Excel Template Example

Here's exactly how your Excel should look:

```
Row 1:  Code      | Test Name               | Cost | Category
Row 2:  CBC001    | Complete Blood Count    | 500  | Hematology
Row 3:  HB001     | Hemoglobin Test        | 200  | Hematology
Row 4:  ESR001    | ESR Test               | 150  | Hematology
...
Row 1136: TEST1135 | Your Last Test         | 1000 | General
```

---

## 🎉 After Successful Import

Once you see "Successfully imported 1135 lab tests!", you can:

1. **Start the backend:**
   ```bash
   npm start
   ```

2. **Start the frontend:**
   ```bash
   cd "d:\02 Internal project\Manu\ChanRe-Allergy-Frontend"
   npm run dev
   ```

3. **Login as a doctor**

4. **Test the new feature:**
   - Go to Test Requests → Add Test Request
   - Select a patient
   - Type in the test search box (e.g., "CBC")
   - You should see your imported tests!
   - Select tests and see total cost calculate
   - Submit the test request

---

## 🔄 Need to Re-import or Update?

To reimport (updates all tests):

```bash
node import-lab-tests.js updated-tests.xlsx
```

⚠️ **Warning:** This DELETES all existing tests and replaces them!

---

## 💡 Pro Tips

1. **Keep a backup** of your Excel file
2. **Start small** - test with 20 tests first
3. **Use categories** to organize tests
4. **Be consistent** with naming conventions
5. **Double-check costs** before importing
6. **Save frequently** while creating the Excel file

---

## 📞 Need Help?

If you get stuck:

1. ✅ Read the error message carefully
2. ✅ Check `HOW_TO_IMPORT.md` for troubleshooting
3. ✅ Try the test import first (20 tests)
4. ✅ Verify Excel file format matches examples
5. ✅ Make sure MongoDB is running

---

## ✅ Checklist Before Import

Before running the import command, verify:

- [ ] Excel file created with all 1135 tests
- [ ] File saved as .xlsx format
- [ ] File is in backend folder
- [ ] Column headers: Code, Test Name, Cost
- [ ] All test codes are unique
- [ ] All costs are numbers only
- [ ] No empty rows
- [ ] MongoDB is running
- [ ] You're in the backend directory

**Ready? Run:** `node import-lab-tests.js lab-tests.xlsx`

**Good luck! 🚀**

