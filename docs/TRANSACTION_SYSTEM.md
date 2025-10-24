# Transaction System Documentation

## Overview

This document describes the comprehensive transaction system implemented for storing and managing all billing transactions across three different billing types:

1. **Receipt Transactions** - For test request payments and lab billing
2. **Consultation Transactions** - For consultation fee payments
3. **Reassignment Transactions** - For patient reassignment billing

## Database Collections

### 1. Receipt Transactions (`receipttransactions`)

Stores transactions related to test requests and lab billing.

**Key Fields:**
- `transactionId` - Unique transaction identifier
- `testRequestId` - Reference to the test request
- `patientId` - Patient reference
- `amount` - Payment amount
- `paymentMethod` - Payment method (cash, card, upi, etc.)
- `status` - Transaction status (pending, completed, failed, cancelled, refunded)
- `receiptNumber` - Receipt number
- `paymentBreakdown` - Detailed payment breakdown
- `refunds` - Array of refund records

### 2. Consultation Transactions (`consultationtransactions`)

Stores transactions related to consultation fee payments.

**Key Fields:**
- `transactionId` - Unique transaction identifier
- `patientId` - Patient reference
- `doctorId` - Doctor reference
- `consultationType` - Type of consultation (OP, IP, followup)
- `amount` - Payment amount
- `paymentMethod` - Payment method
- `status` - Transaction status
- `appointmentDate` - Appointment date and time
- `paymentBreakdown` - Detailed payment breakdown

### 3. Reassignment Transactions (`reassignmenttransactions`)

Stores transactions related to patient reassignment billing.

**Key Fields:**
- `transactionId` - Unique transaction identifier
- `patientId` - Patient reference
- `assignedDoctorId` - Original assigned doctor
- `currentDoctorId` - Current doctor after reassignment
- `reassignmentType` - Type of reassignment (regular, working_hours_violation)
- `reassignmentReason` - Reason for reassignment
- `amount` - Payment amount
- `isEligibleForFreeReassignment` - Whether patient is eligible for free reassignment
- `paymentBreakdown` - Detailed payment breakdown

## API Endpoints

### Unified Transaction Management

#### Get All Transactions
```
GET /api/transactions/all
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status
- `paymentMethod` - Filter by payment method
- `centerId` - Filter by center
- `startDate` - Start date filter
- `endDate` - End date filter
- `search` - Search term

#### Get Transaction Statistics
```
GET /api/transactions/stats
```

**Query Parameters:**
- `centerId` - Filter by center
- `startDate` - Start date filter
- `endDate` - End date filter

#### Get Transaction Dashboard
```
GET /api/transactions/dashboard
```

#### Get Transaction by ID
```
GET /api/transactions/:transactionId
```

#### Update Transaction Status
```
PATCH /api/transactions/:transactionId/status
```

**Body:**
```json
{
  "status": "completed",
  "reason": "Payment verified",
  "notes": "Additional notes"
}
```

#### Process Refund
```
POST /api/transactions/:transactionId/refund
```

**Body:**
```json
{
  "amount": 500,
  "refundMethod": "cash",
  "refundReason": "Service not provided",
  "notes": "Refund processed by admin",
  "patientBehavior": "okay"
}
```

### Individual Collection Endpoints

#### Receipt Transactions
```
POST /api/receipt-transactions/create
GET /api/receipt-transactions
GET /api/receipt-transactions/:transactionId
PATCH /api/receipt-transactions/:transactionId/status
POST /api/receipt-transactions/:transactionId/refund
GET /api/receipt-transactions/stats/summary
```

#### Consultation Transactions
```
POST /api/consultation-transactions/create
GET /api/consultation-transactions
GET /api/consultation-transactions/:transactionId
PATCH /api/consultation-transactions/:transactionId/status
POST /api/consultation-transactions/:transactionId/refund
GET /api/consultation-transactions/stats/summary
```

#### Reassignment Transactions
```
POST /api/reassignment-transactions/create
GET /api/reassignment-transactions
GET /api/reassignment-transactions/:transactionId
PATCH /api/reassignment-transactions/:transactionId/status
POST /api/reassignment-transactions/:transactionId/refund
GET /api/reassignment-transactions/stats/summary
```

## Integration with Existing Controllers

The transaction system is automatically integrated with the existing billing controllers:

### 1. Billing Controller (`billingController.js`)
- **Receipt Transactions**: Created when processing payments for test requests
- **Consultation Transactions**: Created when processing consultation fee payments

### 2. Reassignment Billing Controller (`reassignmentBillingController.js`)
- **Reassignment Transactions**: Created when processing payments for reassigned patients

## Transaction Service

The `TransactionService` class provides methods for creating and managing transactions:

```javascript
import TransactionService from '../services/transactionService.js';

// Create receipt transaction
await TransactionService.createReceiptTransaction(data, user);

// Create consultation transaction
await TransactionService.createConsultationTransaction(data, user);

// Create reassignment transaction
await TransactionService.createReassignmentTransaction(data, user);

// Update transaction status
await TransactionService.updateTransactionStatus(transactionId, status, user, reason, notes);

// Process refund
await TransactionService.processRefund(transactionId, refundData, user);

// Get transaction by ID
const transaction = await TransactionService.getTransaction(transactionId);

// Get all transactions
const result = await TransactionService.getAllTransactions(filters, pagination);

// Get transaction statistics
const stats = await TransactionService.getTransactionStats(filters);
```

## Transaction Status Flow

1. **pending** - Transaction created but not yet processed
2. **completed** - Payment successfully processed
3. **failed** - Payment processing failed
4. **cancelled** - Transaction cancelled
5. **refunded** - Full refund processed
6. **partially_refunded** - Partial refund processed

## Refund System

The system supports comprehensive refund tracking:

- **Full Refunds**: Complete refund of the transaction amount
- **Partial Refunds**: Partial refund with remaining amount tracking
- **Refund History**: Complete audit trail of all refunds
- **Patient Behavior Tracking**: Tracks patient behavior for penalty policy

## Data Backup and Recovery

All transactions are stored in MongoDB with comprehensive indexing for:

- **Performance**: Fast queries on common fields
- **Reliability**: Automatic backup and recovery
- **Audit Trail**: Complete history of all changes
- **Data Integrity**: Referential integrity with patient and doctor records

## Usage Examples

### Creating a Receipt Transaction
```javascript
const receiptData = {
  testRequestId: 'test123',
  patientId: 'patient456',
  centerId: 'center789',
  amount: 1500,
  paymentMethod: 'cash',
  receiptNumber: 'REC-123456',
  notes: 'Lab test payment'
};

const transaction = await TransactionService.createReceiptTransaction(receiptData, user);
```

### Processing a Refund
```javascript
const refundData = {
  amount: 500,
  refundMethod: 'cash',
  refundReason: 'Service not provided',
  notes: 'Refund processed by admin',
  patientBehavior: 'okay'
};

await TransactionService.processRefund('TRANSACTION_ID', refundData, user);
```

### Getting Transaction Statistics
```javascript
const filters = {
  centerId: 'center123',
  startDate: '2024-01-01',
  endDate: '2024-12-31'
};

const stats = await TransactionService.getTransactionStats(filters);
```

## Benefits

1. **Data Persistence**: All transactions are permanently stored in the database
2. **Backup and Recovery**: Complete transaction history for disaster recovery
3. **Audit Trail**: Comprehensive tracking of all payment activities
4. **Reporting**: Detailed statistics and analytics
5. **Refund Management**: Complete refund tracking and management
6. **Multi-Collection Support**: Separate collections for different transaction types
7. **Unified API**: Single API for managing all transaction types
8. **Status Tracking**: Complete status management and history
9. **Search and Filtering**: Advanced search and filtering capabilities
10. **Pagination**: Efficient handling of large transaction datasets

## Security

- All endpoints require authentication
- User tracking for all operations
- Complete audit trail
- Role-based access control
- Data validation and sanitization

## Monitoring and Maintenance

- Comprehensive logging for all operations
- Error handling and recovery
- Performance monitoring
- Database indexing for optimal performance
- Regular backup procedures
