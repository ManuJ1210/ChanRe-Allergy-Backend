import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Generate PDF invoice
export const generateInvoicePDF = async (req, res) => {
  try {
    const { id, billingId } = req.params;
    
    // Use either id or billingId parameter
    const testRequestId = id || billingId;
    
    console.log('🚀 generateInvoicePDF called with:', {
      id,
      billingId,
      testRequestId,
      params: req.params
    });
    
    if (!testRequestId) {
      return res.status(400).json({ message: 'Test request ID is required' });
    }
    
    // Find the test request with billing information
    const TestRequest = (await import('../models/TestRequest.js')).default;
    const testRequest = await TestRequest.findById(testRequestId)
      .populate('patientId', 'name phone address age gender')
      .populate('doctorId', 'name specializations email phone')
      .populate('centerId', 'name code');
    
    if (!testRequest) {
      console.log('❌ Test request not found:', testRequestId);
      return res.status(404).json({ message: 'Test request not found' });
    }
    
    if (!testRequest.billing) {
      console.log('❌ No billing information found for test request:', testRequestId);
      return res.status(400).json({ message: 'No billing information found for this test request' });
    }
    
    console.log('✅ Generating PDF for test request:', {
      testRequestId,
      patientName: testRequest.patientName,
      invoiceNumber: testRequest.billing.invoiceNumber,
      amount: testRequest.billing.amount
    });
    
    // Create PDF document using full page
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 15,
      info: {
        Title: `Invoice - ${testRequest.billing.invoiceNumber || testRequest._id}`,
        Author: 'Chanre Hospital',
        Subject: `Medical Invoice for ${testRequest.patientName}`,
        Creator: 'Hospital Management System'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${testRequest.billing.invoiceNumber || testRequest._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Full-width professional header
    doc.rect(15, 15, 570, 50).fill('#2563eb');
    doc.fillColor('#ffffff')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('CHANRE HOSPITAL', 15, 30, { align: 'center', width: 570 });
    
    doc.fillColor('#ffffff')
       .fontSize(14)
       .font('Helvetica')
       .text('Medical Laboratory Services', 15, 50, { align: 'center', width: 570 });
    
    // Invoice header
    doc.fillColor('#000000')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('INVOICE', 15, 80, { align: 'center', width: 570 });
    
    // Full-width invoice details
    const invoiceBoxY = 110;
    doc.rect(15, invoiceBoxY, 570, 35).stroke('#e5e7eb');
    doc.fillColor('#1f2937')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Details', 25, invoiceBoxY + 8);
    
    doc.fillColor('#374151')
       .fontSize(10)
       .font('Helvetica')
       .text(`Invoice #: ${testRequest.billing.invoiceNumber || 'N/A'}`, 25, invoiceBoxY + 22)
       .text(`Date: ${testRequest.billing.generatedAt ? new Date(testRequest.billing.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 250, invoiceBoxY + 22)
       .text(`Status: ${testRequest.billing.status.toUpperCase()}`, 450, invoiceBoxY + 22);
    
    // Full-width patient and doctor information in two columns
    const infoY = 160;
    
    // Patient information box - full width
    doc.rect(15, infoY, 280, 60).stroke('#e5e7eb');
    doc.fillColor('#1f2937')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('PATIENT INFORMATION', 25, infoY + 8);
    
    doc.fillColor('#374151')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${testRequest.patientName || testRequest.patientId?.name || 'Not Available'}`, 25, infoY + 22)
       .text(`Phone: ${testRequest.patientPhone || testRequest.patientId?.phone || 'Not Available'}`, 25, infoY + 35)
       .text(`Address: ${testRequest.patientAddress || testRequest.patientId?.address || 'Not Available'}`, 25, infoY + 48);
    
    // Doctor information box - full width
    doc.rect(305, infoY, 280, 60).stroke('#e5e7eb');
    doc.fillColor('#1f2937')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('DOCTOR INFORMATION', 315, infoY + 8);
    
    doc.fillColor('#374151')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${testRequest.doctorName || testRequest.doctorId?.name || 'Not Available'}`, 315, infoY + 22)
       .text(`Email: ${testRequest.doctorId?.email || 'Not Available'}`, 315, infoY + 35)
       .text(`Phone: ${testRequest.doctorId?.phone || 'Not Available'}`, 315, infoY + 48);
    
    // Test information - full width
    const testInfoY = infoY + 75;
    doc.rect(15, testInfoY, 570, 30).stroke('#e5e7eb');
    doc.fillColor('#1f2937')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('TEST INFORMATION', 25, testInfoY + 8);
    
    doc.fillColor('#374151')
       .fontSize(10)
       .font('Helvetica')
       .text(`Test Type: ${testRequest.testType || 'Not Available'}`, 25, testInfoY + 22)
       .text(`Description: ${testRequest.testDescription || 'Not Available'}`, 200, testInfoY + 22)
       .text(`Center: ${testRequest.centerName || testRequest.centerId?.name || 'Not Available'}`, 400, testInfoY + 22);
    
    // Full-width billing table
    const billingY = testInfoY + 40;
    doc.fillColor('#1f2937')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('BILLING DETAILS', 15, billingY);
    
    // Full-width table header
    const tableTop = billingY + 15;
    doc.rect(15, tableTop, 570, 25).fill('#f3f4f6');
    doc.fillColor('#1f2937')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('Item Description', 25, tableTop + 8)
       .text('Qty', 350, tableTop + 8)
       .text('Unit Price', 420, tableTop + 8)
       .text('Total', 520, tableTop + 8);
    
    let currentY = tableTop + 30;
    
    // Add billing items
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach((item, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(15, currentY - 3, 570, 20).fill('#f9fafb');
        }
        
        doc.fillColor('#374151')
           .fontSize(10)
           .font('Helvetica')
           .text(item.name || 'N/A', 25, currentY)
           .text((item.quantity || 1).toString(), 350, currentY)
           .text(`₹${(item.unitPrice || 0).toFixed(2)}`, 420, currentY)
           .text(`₹${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}`, 520, currentY);
        currentY += 20;
      });
    } else {
      // Fallback for single test
      doc.rect(15, currentY - 3, 570, 20).fill('#f9fafb');
      doc.fillColor('#374151')
         .fontSize(10)
         .font('Helvetica')
         .text(testRequest.testType || 'Test', 25, currentY)
         .text('1', 350, currentY)
         .text(`₹${(testRequest.billing.amount || 0).toFixed(2)}`, 420, currentY)
         .text(`₹${(testRequest.billing.amount || 0).toFixed(2)}`, 520, currentY);
      currentY += 20;
    }
    
    // Table bottom line
    doc.strokeColor('#d1d5db')
       .lineWidth(2)
       .moveTo(15, currentY - 3)
       .lineTo(585, currentY - 3)
       .stroke();
    
    // Full-width totals section
    const totalsY = currentY + 15;
    const totalsBoxWidth = 200;
    const totalsBoxX = 385;
    
    doc.rect(totalsBoxX, totalsY, totalsBoxWidth, 50).stroke('#e5e7eb');
    
    const subtotal = testRequest.billing.items ? 
      testRequest.billing.items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0) :
      (testRequest.billing.amount || 0);
    
    const taxes = testRequest.billing.taxes || 0;
    const discounts = testRequest.billing.discounts || 0;
    const grandTotal = subtotal + taxes - discounts;
    
    doc.fillColor('#374151')
       .fontSize(11)
       .font('Helvetica')
       .text('Subtotal:', totalsBoxX + 10, totalsY + 10)
       .text(`₹${subtotal.toFixed(2)}`, totalsBoxX + 120, totalsY + 10)
       .text('Taxes:', totalsBoxX + 10, totalsY + 25)
       .text(`₹${taxes.toFixed(2)}`, totalsBoxX + 120, totalsY + 25)
       .text('Discounts:', totalsBoxX + 10, totalsY + 40)
       .text(`₹${discounts.toFixed(2)}`, totalsBoxX + 120, totalsY + 40);
    
    // Grand total with highlight
    doc.rect(totalsBoxX, totalsY + 45, totalsBoxWidth, 25).fill('#f3f4f6');
    doc.fillColor('#1f2937')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Grand Total:', totalsBoxX + 10, totalsY + 52)
       .text(`₹${grandTotal.toFixed(2)}`, totalsBoxX + 120, totalsY + 52);
    
    // Full-width payment information
    const paymentY = totalsY + 80;
    
    if (testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received') {
      doc.rect(15, paymentY, 570, 35).stroke('#10b981');
      doc.fillColor('#065f46')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PAYMENT INFORMATION', 25, paymentY + 8);
      
      doc.fillColor('#374151')
         .fontSize(10)
         .font('Helvetica')
         .text(`Method: ${testRequest.billing.paymentMethod || 'Not Available'}`, 25, paymentY + 22)
         .text(`Transaction: ${testRequest.billing.transactionId || 'Not Available'}`, 200, paymentY + 22)
         .text(`Date: ${testRequest.billing.paidAt ? new Date(testRequest.billing.paidAt).toLocaleDateString() : 'Not Available'}`, 400, paymentY + 22);
    } else if (testRequest.billing.status === 'partial') {
      // Show detailed partial payment information
      const paidAmount = testRequest.billing.paidAmount || 0;
      const remainingAmount = grandTotal - paidAmount;
      
      // Calculate payment history height dynamically
      const paymentHistoryHeight = 80 + (testRequest.billing.partialPayments ? testRequest.billing.partialPayments.length * 20 : 0);
      
      doc.rect(15, paymentY, 570, paymentHistoryHeight).stroke('#f59e0b');
      doc.fillColor('#92400e')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PARTIAL PAYMENT INFORMATION', 25, paymentY + 8);
      
      doc.fillColor('#374151')
         .fontSize(10)
         .font('Helvetica')
         .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, 25, paymentY + 22)
         .text(`Paid Amount: ₹${paidAmount.toFixed(2)}`, 200, paymentY + 22)
         .text(`Remaining: ₹${remainingAmount.toFixed(2)}`, 400, paymentY + 22);
      
      // Payment summary
      doc.fillColor('#374151')
         .fontSize(9)
         .font('Helvetica')
         .text(`Payment Method: ${testRequest.billing.paymentMethod || 'Multiple'}`, 25, paymentY + 35)
         .text(`Last Payment Date: ${testRequest.billing.paidAt ? new Date(testRequest.billing.paidAt).toLocaleDateString() : 'Not Available'}`, 200, paymentY + 35);
      
      // Payment history table if partial payments exist
      if (testRequest.billing.partialPayments && testRequest.billing.partialPayments.length > 0) {
        const paymentTableY = paymentY + 50;
        
        // Table header
        doc.rect(15, paymentTableY, 570, 20).fill('#fef3c7');
        doc.fillColor('#92400e')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text('Payment #', 25, paymentTableY + 6)
           .text('Amount', 100, paymentTableY + 6)
           .text('Method', 200, paymentTableY + 6)
           .text('Date & Time', 300, paymentTableY + 6)
           .text('Transaction ID', 450, paymentTableY + 6);
        
        // Payment rows
        let paymentRowY = paymentTableY + 25;
        testRequest.billing.partialPayments.forEach((payment, index) => {
          doc.fillColor('#374151')
             .fontSize(8)
             .font('Helvetica')
             .text(`${index + 1}`, 25, paymentRowY)
             .text(`₹${payment.amount.toFixed(2)}`, 100, paymentRowY)
             .text(payment.method || 'Cash', 200, paymentRowY)
             .text(new Date(payment.timestamp).toLocaleString(), 300, paymentRowY)
             .text(payment.transactionId || 'Not Available', 450, paymentRowY);
          paymentRowY += 20;
        });
        
        // Show first and last payment summary
        const firstPayment = testRequest.billing.partialPayments[testRequest.billing.partialPayments.length - 1];
        const lastPayment = testRequest.billing.partialPayments[0];
        
        doc.fillColor('#92400e')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text('Payment Summary:', 25, paymentRowY + 5);
        
        doc.fillColor('#374151')
           .fontSize(8)
           .font('Helvetica')
           .text(`First Payment: ₹${firstPayment.amount.toFixed(2)} on ${new Date(firstPayment.timestamp).toLocaleDateString()}`, 25, paymentRowY + 18)
           .text(`Last Payment: ₹${lastPayment.amount.toFixed(2)} on ${new Date(lastPayment.timestamp).toLocaleDateString()}`, 25, paymentRowY + 30);
      }
    } else if (testRequest.billing.status === 'pending') {
      doc.rect(15, paymentY, 570, 30).stroke('#ef4444');
      doc.fillColor('#991b1b')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PAYMENT STATUS: PENDING', 25, paymentY + 8);
      
      doc.fillColor('#374151')
         .fontSize(10)
         .font('Helvetica')
         .text(`Amount Due: ₹${grandTotal.toFixed(2)}`, 25, paymentY + 22)
         .text(`Due Date: ${testRequest.billing.dueDate ? new Date(testRequest.billing.dueDate).toLocaleDateString() : 'Not Available'}`, 200, paymentY + 22);
    }
    
    // Calculate dynamic positioning based on payment info height
    let notesY;
    if (testRequest.billing.status === 'partial') {
      const paymentHistoryHeight = 80 + (testRequest.billing.partialPayments ? testRequest.billing.partialPayments.length * 20 : 0);
      notesY = paymentY + paymentHistoryHeight + 10;
    } else {
      notesY = paymentY + (testRequest.billing.status === 'paid' ? 50 : 40);
    }
    
    // Full-width notes section
    if (testRequest.billing.notes) {
      doc.rect(15, notesY, 570, 40).stroke('#e5e7eb');
      doc.fillColor('#1f2937')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('NOTES', 25, notesY + 10);
      
      doc.fillColor('#374151')
         .fontSize(10)
         .font('Helvetica')
         .text(testRequest.billing.notes, 25, notesY + 25, { width: 560 });
    }
    
    // Full-width professional footer using remaining page space
    const footerY = notesY + (testRequest.billing.notes ? 50 : 10);
    const remainingHeight = 800 - footerY; // Use remaining page height
    
    doc.rect(15, footerY, 570, remainingHeight).fill('#f8fafc');
    doc.fillColor('#6b7280')
       .fontSize(12)
       .font('Helvetica')
       .text('Thank you for choosing Chanre Hospital for your medical needs', 15, footerY + 20, { align: 'center', width: 570 })
       .text('For any billing queries, please contact us at +91 98765 43210', 15, footerY + 40, { align: 'center', width: 570 })
       .text('Email: billing@chanrehospital.com | Website: www.chanrehospital.com', 15, footerY + 60, { align: 'center', width: 570 });
    
    // Add additional footer content to fill remaining space
    if (remainingHeight > 100) {
      doc.fillColor('#9ca3af')
         .fontSize(10)
         .font('Helvetica')
         .text('This invoice is computer generated and does not require a signature', 15, footerY + 80, { align: 'center', width: 570 })
         .text(`Generated on ${new Date().toLocaleString()}`, 15, footerY + 100, { align: 'center', width: 570 });
    }
    
    // Finalize PDF
    doc.end();
    
    console.log('✅ PDF generated successfully for test request:', testRequestId);
    
  } catch (error) {
    console.error('❌ Error generating invoice PDF:', error);
    res.status(500).json({ message: 'Error generating invoice PDF', error: error.message });
  }
};


