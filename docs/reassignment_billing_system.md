# Patient Reassignment & Billing System

## Overview
This system handles patient reassignment with comprehensive billing functionality, including free consultations for first-time reassignments within 7 days, payment processing, bill cancellation, and refund management.

## Features

### 1. Patient Reassignment
- **Unlimited Reassignments**: Patients can be reassigned multiple times
- **7-Day Free Consultation**: First reassignment within 7 days of initial consultation is free
- **Doctor Selection**: Reassign to any available doctor in the center
- **Reassignment History**: Complete tracking of all reassignments with reasons and notes

### 2. Billing System
- **Automatic Fee Calculation**: 
  - Free consultation for first reassignment within 7 days
  - OP Consultation: ₹850 (after free period)
  - IP Consultation: ₹1050 (after free period)
- **Service Charges**: Additional services can be added with custom amounts
- **Tax & Discount**: Configurable tax percentage and discount percentage
- **Invoice Generation**: Automatic invoice creation with unique invoice numbers

### 3. Payment Processing
- **Full Payment**: Pay the entire amount at once
- **Partial Payment**: Pay any amount less than the total
- **Payment Methods**: Cash, Card, UPI/Online Transfer, Other
- **Appointment Scheduling**: Optional appointment scheduling after payment
- **Receipt Generation**: Automatic receipt numbers for all payments

### 4. Bill Management
- **Bill Cancellation**: Cancel bills with reason tracking
- **Refund Processing**: Process refunds for paid amounts
- **Payment History**: Complete payment and refund history
- **Status Tracking**: Pending, Partial, Paid, Cancelled statuses

## API Endpoints

### Backend Routes (`/api/billing/`)

#### 1. Create Invoice
```
POST /api/billing/create-invoice
```
**Body:**
```json
{
  "patientId": "string",
  "doctorId": "string", 
  "centerId": "string",
  "consultationType": "OP|IP",
  "consultationFee": "number",
  "serviceCharges": [
    {
      "name": "string",
      "amount": "number",
      "description": "string"
    }
  ],
  "taxPercentage": "number",
  "discountPercentage": "number",
  "notes": "string",
  "isReassignedEntry": true
}
```

#### 2. Process Payment
```
POST /api/billing/process-payment
```
**Body:**
```json
{
  "invoiceId": "string",
  "patientId": "string",
  "amount": "number",
  "paymentMethod": "cash|card|upi|other",
  "notes": "string",
  "appointmentTime": "datetime",
  "centerId": "string"
}
```

#### 3. Cancel Bill
```
POST /api/billing/cancel-bill
```
**Body:**
```json
{
  "patientId": "string",
  "reason": "string",
  "centerId": "string"
}
```

#### 4. Process Refund
```
POST /api/billing/process-refund
```
**Body:**
```json
{
  "patientId": "string",
  "amount": "number",
  "method": "cash|bank_transfer|card|upi|other",
  "reason": "string",
  "notes": "string",
  "centerId": "string"
}
```

#### 5. Get Billing Status
```
GET /api/billing/reassignment-status/:patientId
```

## Frontend Components

### ReassignPatient.jsx
Main component handling the complete reassignment workflow:

#### Key Functions:
- `isEligibleForFreeReassignment(patient)`: Checks if patient qualifies for free reassignment
- `getConsultationFee(patient, consultationType)`: Calculates consultation fee based on eligibility
- `getReassignmentStatus(patient)`: Determines current reassignment and billing status
- `handleCreateInvoice(patient)`: Creates invoice for reassigned patient
- `handleReassignPatient(patient)`: Initiates patient reassignment process

#### State Management:
- **Patient Selection**: `selectedPatient`, `showReassignModal`
- **Billing**: `showCreateInvoiceModal`, `invoiceFormData`, `generatedInvoice`
- **Payment**: `showPaymentModal`, `paymentData`
- **Cancellation**: `showCancelBillModal`, `cancelReason`
- **Refund**: `showRefundModal`, `refundData`

## Business Logic

### Free Reassignment Eligibility
A patient is eligible for free reassignment if:
1. They have completed their first consultation (have billing records)
2. They have NOT been reassigned before (`isReassigned` is false)
3. The reassignment is within 7 days of their first consultation

### Consultation Fees
- **First Reassignment (within 7 days)**: ₹0 (Free)
- **Subsequent Reassignments**: 
  - OP Consultation: ₹850
  - IP Consultation: ₹1050

### Payment Processing
- Payments can be full or partial
- Each payment generates a unique receipt number
- Payment history is maintained for audit purposes
- Optional appointment scheduling after payment

### Bill Status Flow
1. **Pending**: Invoice created, no payments made
2. **Partial**: Some payment made, amount still due
3. **Paid**: Full amount paid
4. **Cancelled**: Bill cancelled with reason

## Database Schema

### Patient Model Updates
```javascript
{
  // Existing fields...
  isReassigned: Boolean,
  currentDoctor: ObjectId, // Current doctor (for reassigned patients)
  reassignmentHistory: [{
    previousDoctor: ObjectId,
    previousDoctorName: String,
    newDoctor: ObjectId,
    newDoctorName: String,
    reason: String,
    notes: String,
    reassignedBy: ObjectId,
    reassignedAt: Date,
    createdAt: Date
  }],
  lastReassignedAt: Date,
  billing: [{
    // Existing billing fields...
    isReassignedEntry: Boolean,
    consultationType: String,
    consultationFee: Number,
    serviceCharges: [{
      name: String,
      amount: Number,
      description: String
    }],
    totals: {
      subtotal: Number,
      taxAmount: Number,
      discountAmount: Number,
      total: Number,
      paid: Number,
      due: Number
    },
    payments: [{
      amount: Number,
      method: String,
      notes: String,
      processedBy: ObjectId,
      processedAt: Date,
      receiptNumber: String
    }],
    refunds: [{
      amount: Number,
      method: String,
      reason: String,
      notes: String,
      processedBy: ObjectId,
      processedAt: Date,
      refundNumber: String
    }],
    status: String, // pending, partial, paid, cancelled
    cancelledAt: Date,
    cancellationReason: String,
    cancelledBy: ObjectId
  }]
}
```

## Usage Workflow

### 1. Patient Reassignment
1. Receptionist selects a patient from the list
2. Clicks "Reassign" button
3. Selects new doctor and provides reason
4. Confirms reassignment
5. Patient is reassigned and history is updated

### 2. Invoice Creation
1. Receptionist clicks "Create Bill" for reassigned patient
2. System automatically calculates consultation fee (free if eligible)
3. Receptionist can add service charges, tax, discount
4. Invoice is generated and previewed
5. Patient can review invoice before payment

### 3. Payment Processing
1. Patient reviews invoice and proceeds to payment
2. Receptionist enters payment amount (full or partial)
3. Selects payment method and adds notes
4. Optionally schedules appointment
5. Payment is processed and receipt is generated

### 4. Bill Management
1. **Cancellation**: Receptionist can cancel bills with reason
2. **Refund**: Process refunds for paid amounts
3. **Status Tracking**: Monitor payment status and due amounts

## Security & Validation

### Authentication
- All endpoints require authentication (`protect` middleware)
- Center isolation ensures users can only access their center's data

### Validation
- Required field validation for all operations
- Amount validation (positive numbers, not exceeding limits)
- Date validation for appointment scheduling
- ObjectId validation for all references

### Audit Trail
- All payments, cancellations, and refunds are logged
- User tracking for all operations
- Timestamp tracking for all actions

## Error Handling

### Frontend
- Toast notifications for success/error messages
- Form validation with user-friendly error messages
- Loading states during API calls

### Backend
- Comprehensive error handling with meaningful messages
- Database transaction safety
- Input validation and sanitization

## Testing Considerations

### Unit Tests
- Test free reassignment eligibility logic
- Test consultation fee calculations
- Test payment processing logic
- Test bill status transitions

### Integration Tests
- Test complete reassignment workflow
- Test payment processing with different scenarios
- Test bill cancellation and refund processes

### Edge Cases
- Multiple reassignments for same patient
- Payment exceeding due amount
- Refund exceeding paid amount
- Concurrent payment processing

## Future Enhancements

1. **PDF Invoice Generation**: Generate downloadable PDF invoices
2. **Email Notifications**: Send invoice and payment confirmations via email
3. **Payment Gateway Integration**: Support for online payment gateways
4. **Advanced Reporting**: Detailed reports on reassignments and payments
5. **Mobile App Support**: API optimization for mobile applications
6. **Automated Reminders**: Reminder system for pending payments
7. **Bulk Operations**: Support for bulk reassignments and payments
