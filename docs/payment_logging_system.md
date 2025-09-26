# Payment Logging System Documentation

## Overview

The Payment Logging System provides comprehensive tracking of all payment transactions within the ChanRe Allergy Backend. Every payment event is recorded in a separate, dedicated database collection for audit and analytics purposes.

## Components Created

### 1. PaymentLog Model (`models/PaymentLog.js`)

A comprehensive mongoose model that captures:
- **Transaction Details**: Unique transaction ID, amount, currency, payment method
- **Reference Information**: Test request ID, patient ID, center ID  
- **Payment Categories**: Type of payment (consultation, test, registration, etc.)
- **Status Tracking**: Complete status history with timestamps
- **Verification & Audit**: Who verified, when, processing user info
- **Metadata**: IP addresses, user agents, source tracking
- **Refund Information**: Refund tracking and history
- **Indexes**: Optimized for common queries

### 2. Payment Logging Service (`services/paymentLogService.js`)

Service functions for logging and retrieving payment records:
- `logPaymentTransaction()` - Log new payment transactions
- `logPaymentStatusUpdate()` - Track status changes
- `logPaymentCancellation()` - Log cancellation events  
- `logPaymentRefund()` - Track refund operations
- `logPartialPayment()` - Handle partial payment scenarios
- `getPaymentLogsForTestRequest()` - Retrieve logs for specific test requests
- `getPaymentLogsForCenter()` - Get payment logs for a center
- `getPaymentStatistics()` - Analytics and reporting data

### 3. Payment Logging Integration

The system automatically logs payments in the following controllers:

#### Billing Controller Integration
- **`markBillPaidForTestRequest`**: Logs main payment transactions
- **`updatePaymentStatus`**: Tracks payment status changes
- **`cancelBill`**: Logs cancellation events 
- **`createConsultationFeeBilling`**: Logs consultation fee payments

#### Integration Points
Every payment operation now has:
- Automatic logging with no interruption to existing workflow
- Error handling that prevents logging failures from blocking operations
- Comprehensive metadata capture

### 4. API Routes (`routes/paymentLogRoutes.js`)

RESTful API endpoints for accessing payment logs:

#### Center-Level Access
- `GET /api/payment-logs/center` - Get payment logs for current center
- `GET /api/payment-logs/center/statistics` - Center payment statistics
- `GET /api/payment-logs/center/export` - Export payment logs as CSV

#### Test Request Specific
- `GET /api/payment-logs/test-request/:testRequestId` - Get logs for specific test request

#### SuperAdmin Access  
- `GET /api/payment-logs/all` - Get payment logs for all centers
- `GET /api/payment-logs/analysis` - Payment analytics and reporting

#### Query Parameters
All endpoints support filtering by:
- Date ranges (`dateFrom`, `dateTo`)
- Payment method (`paymentMethod`)
- Status (`status`)
- Search terms (`searchTerm`)
- Pagination (`page`, `limit`)

## Database Structure

### PaymentLog Collection Fields

```
{
  transactionId: String (unique),
  testRequestId: ObjectId,
  patientId: ObjectId,
  patientName: String,
  centerId: ObjectId,
  centerName: String,
  amount: Number,
  currency: String (default: 'INR'),
  paymentType: String (enum: ['consultation', 'registration', 'test', etc.]),
  paymentMethod: String (enum: ['cash', 'card', 'upi', etc.]),
  status: String (enum: ['initiated', 'completed', 'failed', etc.]),
  statusHistory: Array (tracks all status changes),
  processedBy: ObjectId,
  processedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  refund: Object,
  metadata: Object
}
```

## Deployment

### Files Created/Modified

**New Files:**
1. `models/PaymentLog.js` - Database model
2. `services/paymentLogService.js` - Business logic
3. `routes/paymentLogRoutes.js` - API endpoints  
4. `docs/payment_logging_system.md` - Documentation

**Modified Files:**
1. `controllers/billingController.js` - Integrated payment logging
2. `server.js` - Added payment log routes

### Database Indexes

The following indexes are automatically created for optimal query performance:
- `transactionId`
- `testRequestId`
- `patientId`
- `centerId`
- `processedBy`
- `status`
- `createdAt`
- `centerId + processedAt` (compound)

## Usage Examples

### Retrieving Payment Logs

```javascript
// Get payment logs for a specific test request
GET /api/payment-logs/test-request/507f1f77bcf86cd799439011

// Get paid transactions for center in last 30 days
GET /api/payment-logs/center?status=completed&dateFrom=2024-01-01&dateTo=2024-01-31

// Export payment logs as CSV
GET /api/payment-logs/center/export
```

### Statistical Analysis

```javascript
// Get payment statistics for center
GET /api/payment-logs/center/statistics

// Full analytics (SuperAdmin only)
GET /api/payment-logs/analysis
```

## Benefits

1. **Complete Audit Trail**: Every payment is now recorded with full context
2. **Enhanced Analytics**: Detailed payment statistics and reporting capabilities  
3. **Compliance**: Comprehensive logging for regulatory requirements
4. **Troubleshooting**: Easy identification and resolution of payment issues
5. **Business Intelligence**: Rich data for financial analysis and reporting
6. **Security**: Detailed tracking of who processed payments and when
7. **Seamless Integration**: No disruption to existing payment workflows

## Error Handling

The system is designed to be resilient:
- Payment logging failures do not block financial transactions
- Comprehensive error logging for debugging
- Graceful degradation if logging service is unavailable

## Future Enhancements

Potential improvements that can be made:
- Real-time payment notifications via WebSocket
- Advanced payment analytics and reporting dashboards
- Integration with external payment gateways for status sync
- Automated reconciliation with bank statements
- Enhanced export formats (Excel, PDF reports)
