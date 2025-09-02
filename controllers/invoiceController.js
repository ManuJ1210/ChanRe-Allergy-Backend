import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Generate PDF invoice
export const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the test request with billing information
    const TestRequest = (await import('../models/TestRequest.js')).default;
    const testRequest = await TestRequest.findById(id)
      .populate('patientId', 'name phone address age gender')
      .populate('doctorId', 'name')
      .populate('centerId', 'name code');
    
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }
    
    if (!testRequest.billing) {
      return res.status(400).json({ message: 'No billing information found for this test request' });
    }
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${testRequest.billing.invoiceNumber || testRequest._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add company header
    doc.fontSize(20).text('CHANRE HOSPITAL', { align: 'center' });
    doc.fontSize(12).text('Medical Laboratory Services', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('Address: Your Hospital Address', { align: 'center' });
    doc.text('Phone: +91 1234567890 | Email: info@chanrehospital.com', { align: 'center' });
    doc.moveDown(2);
    
    // Add invoice header
    doc.fontSize(16).text('INVOICE', { align: 'center' });
    doc.moveDown();
    
    // Invoice details
    doc.fontSize(12).text(`Invoice Number: ${testRequest.billing.invoiceNumber || 'N/A'}`);
    doc.text(`Date: ${testRequest.billing.generatedAt ? new Date(testRequest.billing.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()}`);
    doc.text(`Status: ${testRequest.billing.status}`);
    doc.moveDown();
    
    // Patient information
    doc.fontSize(14).text('PATIENT INFORMATION');
    doc.fontSize(10);
    doc.text(`Name: ${testRequest.patientName || testRequest.patientId?.name || 'N/A'}`);
    doc.text(`Phone: ${testRequest.patientPhone || testRequest.patientId?.phone || 'N/A'}`);
    doc.text(`Address: ${testRequest.patientAddress || testRequest.patientId?.address || 'N/A'}`);
    doc.text(`Age: ${testRequest.patientId?.age || 'N/A'}`);
    doc.text(`Gender: ${testRequest.patientId?.gender || 'N/A'}`);
    doc.moveDown();
    
    // Doctor information
    doc.fontSize(14).text('DOCTOR INFORMATION');
    doc.fontSize(10);
    doc.text(`Name: ${testRequest.doctorName || testRequest.doctorId?.name || 'N/A'}`);
    doc.moveDown();
    
    // Test information
    doc.fontSize(14).text('TEST INFORMATION');
    doc.fontSize(10);
    doc.text(`Test Type: ${testRequest.testType || 'N/A'}`);
    doc.text(`Center: ${testRequest.centerName || testRequest.centerId?.name || 'N/A'}`);
    doc.moveDown();
    
    // Billing items table
    doc.fontSize(14).text('BILLING DETAILS');
    doc.moveDown();
    
    // Table header
    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Item', 50, tableTop);
    doc.text('Code', 200, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Unit Price', 350, tableTop);
    doc.text('Total', 450, tableTop);
    
    // Table line
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
    
    let currentY = tableTop + 30;
    
    // Add billing items
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach(item => {
        doc.text(item.name || 'N/A', 50, currentY);
        doc.text(item.code || 'N/A', 200, currentY);
        doc.text((item.quantity || 1).toString(), 300, currentY);
        doc.text(`₹${(item.unitPrice || 0).toFixed(2)}`, 350, currentY);
        doc.text(`₹${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}`, 450, currentY);
        currentY += 20;
      });
    } else {
      // Fallback for single test
      doc.text(testRequest.testType || 'Test', 50, currentY);
      doc.text('N/A', 200, currentY);
      doc.text('1', 300, currentY);
      doc.text(`₹${(testRequest.billing.amount || 0).toFixed(2)}`, 350, currentY);
      doc.text(`₹${(testRequest.billing.amount || 0).toFixed(2)}`, 450, currentY);
      currentY += 20;
    }
    
    // Table bottom line
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
    doc.moveDown();
    
    // Totals
    const subtotal = testRequest.billing.items ? 
      testRequest.billing.items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0) :
      (testRequest.billing.amount || 0);
    
    const taxes = testRequest.billing.taxes || 0;
    const discounts = testRequest.billing.discounts || 0;
    const grandTotal = subtotal + taxes - discounts;
    
    doc.fontSize(12);
    doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, 400, doc.y);
    doc.text(`Taxes: ₹${taxes.toFixed(2)}`, 400, doc.y + 20);
    doc.text(`Discounts: ₹${discounts.toFixed(2)}`, 400, doc.y + 40);
    doc.fontSize(14).text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 400, doc.y + 60);
    
    doc.moveDown(2);
    
    // Payment information
    if (testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received') {
      doc.fontSize(12).text('PAYMENT INFORMATION');
      doc.fontSize(10);
      doc.text(`Payment Method: ${testRequest.billing.paymentMethod || 'N/A'}`);
      doc.text(`Transaction ID: ${testRequest.billing.transactionId || 'N/A'}`);
      doc.text(`Payment Date: ${testRequest.billing.paidAt ? new Date(testRequest.billing.paidAt).toLocaleDateString() : 'N/A'}`);
      doc.moveDown();
    }
    
    // Notes
    if (testRequest.billing.notes) {
      doc.fontSize(12).text('NOTES');
      doc.fontSize(10).text(testRequest.billing.notes);
      doc.moveDown();
    }
    
    // Footer
    doc.fontSize(10).text('Thank you for choosing Chanre Hospital', { align: 'center' });
    doc.text('For any queries, please contact us at +91 1234567890', { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ message: 'Error generating invoice PDF' });
  }
};

