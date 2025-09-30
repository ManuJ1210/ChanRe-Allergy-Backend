# Reassignment Debug Guide

## Issues Fixed

### 1. **Doctor Fetching Issue**
- **Problem**: `fetchAvailableDoctors()` was called in useEffect without a selected patient
- **Fix**: Removed from useEffect and only call when opening reassignment modal
- **Result**: Doctors are now fetched only when needed

### 2. **Debug Logging Added**
- **Frontend**: Added console logs to track reassignment process
- **Backend**: Added detailed logging to reassignment endpoint
- **Result**: Better visibility into what's happening

## Debug Steps

### **Step 1: Check Console Logs**
1. Open browser console (F12)
2. Go to Reassign Patient page
3. Click "Reassign" button on any patient
4. Look for these logs:
   ```
   🔄 Opening reassignment modal for patient: [patient object]
   🔄 Fetching available doctors...
   Doctors API response: [doctors array]
   Filtered doctors: [filtered doctors array]
   ```

### **Step 2: Test Reassignment**
1. Fill the reassignment form:
   - Select a new doctor
   - Enter reason for reassignment
   - Add notes (optional)
2. Click "Confirm Reassignment"
3. Look for these logs:
   ```
   🔄 Starting reassignment process...
   Selected patient: [patient object]
   Reassign data: [form data]
   Center ID: [center ID]
   Sending request to /patients/reassign with data: [request data]
   Reassignment response: [response data]
   ```

### **Step 3: Check Backend Logs**
1. Check backend console for:
   ```
   🔄 Patient reassignment request received: [request body]
   🔄 Request headers: [headers]
   🔄 User from middleware: [user object]
   ✅ Validation passed, proceeding with reassignment...
   🔍 Looking for patient with ID: [patient ID]
   ✅ Patient found: [patient name]
   🔍 Looking for doctor with ID: [doctor ID]
   ✅ Doctor found: [doctor name]
   ✅ Patient reassigned successfully: [details]
   ```

## Common Issues & Solutions

### **Issue 1: "Failed to fetch available doctors"**
- **Cause**: API endpoint `/doctors` not accessible
- **Solution**: Check if backend server is running and `/doctors` endpoint exists

### **Issue 2: "Patient not found"**
- **Cause**: Invalid patient ID or patient doesn't exist
- **Solution**: Verify patient ID is correct and patient exists in database

### **Issue 3: "New doctor not found"**
- **Cause**: Invalid doctor ID or doctor doesn't exist
- **Solution**: Verify doctor ID is correct and doctor exists in database

### **Issue 4: "Center ID is required"**
- **Cause**: User not logged in or center ID not available
- **Solution**: Check if user is logged in and has center ID

### **Issue 5: CORS Errors**
- **Cause**: Frontend and backend on different ports
- **Solution**: Check CORS configuration in backend

## Test the Debug Tool

### **Using the Debug Component**
1. Add route for debug component:
   ```jsx
   import ReassignmentDebug from '../pages/Debug/ReassignmentDebug';
   
   // Add route
   <Route path="/debug/reassignment" element={<ReassignmentDebug />} />
   ```

2. Navigate to `/debug/reassignment`
3. Test reassignment with the debug tool
4. Check console logs for detailed information

## API Endpoints to Verify

### **Backend Endpoints**
```
GET  /api/doctors                    - Get all doctors
GET  /api/patients                   - Get all patients  
POST /api/patients/reassign          - Reassign patient
```

### **Frontend API Calls**
```javascript
// Fetch doctors
const response = await API.get('/doctors');

// Fetch patients  
const response = await API.get('/patients');

// Reassign patient
const response = await API.post('/patients/reassign', {
  patientId: selectedPatient._id,
  newDoctorId: reassignData.newDoctorId,
  reason: reassignData.reason,
  notes: reassignData.notes,
  centerId: getCenterId()
});
```

## Expected Behavior

### **Successful Reassignment**
1. Modal opens with patient details
2. Doctors list loads (excluding current doctor)
3. Form submission sends request to backend
4. Backend processes reassignment
5. Patient data updates in frontend
6. Success message displayed
7. Modal closes

### **Error Handling**
1. Validation errors show specific messages
2. Network errors show generic error message
3. Console logs show detailed error information
4. User can retry after fixing issues

## Next Steps

1. **Test the fixes**: Try reassignment functionality
2. **Check console logs**: Look for any remaining errors
3. **Verify backend**: Ensure all endpoints are working
4. **Test edge cases**: Try with invalid data, network issues, etc.

## Files Modified

### **Frontend**
- `src/pages/Receptionist/ReassignPatient.jsx` - Added debug logging and fixed doctor fetching
- `src/pages/Debug/ReassignmentDebug.jsx` - New debug component

### **Backend**  
- `routes/reassignRoutes.js` - Added detailed logging
- `test/debugReassignment.js` - New debug test script

The reassignment functionality should now work correctly with proper error handling and debugging information.
