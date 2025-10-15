import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Helper function to convert numbers to words
function numberToWords(num) {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  function convertHundreds(n) {
    let result = '';
    if (n > 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n > 9) {
      result += teens[n - 10] + ' ';
      return result;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  }
  
  let result = '';
  if (num >= 10000000) {
    result += convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  if (num >= 100) {
    result += convertHundreds(Math.floor(num / 100)) + 'Hundred ';
    num %= 100;
  }
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

// Generate PDF invoice with professional design matching the image
export const generateInvoicePDF = async (req, res) => {
  try {
    const { id, billingId } = req.params;
    
    // Use either id or billingId parameter
    const testRequestId = id || billingId;
    
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
      return res.status(404).json({ message: 'Test request not found' });
    }
    
    if (!testRequest.billing) {
      return res.status(400).json({ message: 'No billing information found for this test request' });
    }
    
    // Create PDF document with professional layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,
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
    
    // ===== HEADER SECTION =====
    // Hospital Information (Top Left)
    const hospitalName = testRequest.centerId?.name || 'Chanre Hospital';
    const hospitalAddress = testRequest.centerId?.address || 'Rajajinagar, Bengaluru';
    const hospitalPhone = testRequest.centerId?.phone || '1234567890';
    const hospitalEmail = testRequest.centerId?.email || 'chanrehospital@gmail.com';
    
    doc.fillColor('#000000')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(hospitalName, 20, 20);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(hospitalAddress, 20, 45)
       .text(`Phone: ${hospitalPhone}`, 20, 58)
       .text(`Email: ${hospitalEmail}`, 20, 71);
    
    // Bill Title & Details (Top Right)
    doc.fillColor('#1e40af')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('OUTPATIENT BILL', 400, 20, { align: 'right', width: 170 });
    
    const billNumber = testRequest.billing.invoiceNumber || `BILL-${Date.now()}`;
    const billDate = testRequest.billing.generatedAt ? 
      new Date(testRequest.billing.generatedAt).toLocaleDateString('en-GB') : 
      new Date().toLocaleDateString('en-GB');
    const billTime = testRequest.billing.generatedAt ? 
      new Date(testRequest.billing.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }) : 
      new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Bill No: ${billNumber}`, 400, 45, { align: 'right', width: 170 })
       .text(`Date: ${billDate}, ${billTime}`, 400, 58, { align: 'right', width: 170 });
    
    // ===== PATIENT & CONSULTANT INFORMATION =====
    const infoY = 100;
    
    // Patient Information (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information', 20, infoY);
    
    const patientName = testRequest.patientName || testRequest.patientId?.name || 'N/A';
    const patientAge = testRequest.patientId?.age || 'N/A';
    const patientGender = testRequest.patientId?.gender || 'N/A';
    const patientPhone = testRequest.patientId?.phone || 'N/A';
    const fileNumber = testRequest._id.toString().slice(-7);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${patientName}`, 20, infoY + 20)
       .text(`Age: ${patientAge} | Gender: ${patientGender}`, 20, infoY + 35)
       .text(`Contact: ${patientPhone}`, 20, infoY + 50)
       .text(`File No: ${fileNumber}`, 20, infoY + 65);
    
    // Consultant Information (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Consultant Information', 300, infoY);
    
    const doctorName = testRequest.doctorName || testRequest.doctorId?.name || 'Dr. Doctor';
    const department = testRequest.doctorId?.specializations?.[0] || 'General Medicine';
    const userId = testRequest.doctorId?._id?.toString().slice(-7) || '09485dd';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Doctor: ${doctorName}`, 300, infoY + 20)
       .text(`Department: ${department}`, 300, infoY + 35)
       .text(`User ID: ${userId}`, 300, infoY + 50)
       .text(`Ref. Doctor: N/A`, 300, infoY + 65);
    
    // ===== CURRENT SERVICES BILLED SECTION =====
    const servicesY = infoY + 100;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Services Billed', 20, servicesY);
    
    // Calculate totals
    const subtotal = testRequest.billing.items ? 
      testRequest.billing.items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0) :
      (testRequest.billing.amount || 0);
    
    const taxes = testRequest.billing.taxes || 0;
    const discounts = testRequest.billing.discounts || 0;
    const grandTotal = subtotal + taxes - discounts;
    const paidAmount = testRequest.billing.paidAmount || 0;
    const remainingAmount = grandTotal - paidAmount;
    
    // Services Table Header
    const tableY = servicesY + 20;
    doc.rect(20, tableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('S.NO', 30, tableY + 8)
       .text('SERVICE NAME', 70, tableY + 8)
       .text('QTY', 200, tableY + 8)
       .text('CHARGES', 250, tableY + 8)
       .text('PAID', 350, tableY + 8)
       .text('BAL', 420, tableY + 8)
       .text('STATUS', 480, tableY + 8);
    
    let currentRowY = tableY + 25;
    
    // Add service items
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach((item, index) => {
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        const itemPaymentRatio = itemTotal / grandTotal;
        const itemPaidAmount = paidAmount * itemPaymentRatio;
        const itemBalance = itemTotal - itemPaidAmount;
        
        const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                      testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
        
        // Service row
        doc.rect(20, currentRowY, 550, 20).stroke('#000000');
        
        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica')
           .text((index + 1).toString(), 30, currentRowY + 6)
           .text(item.name || 'Lab Test', 70, currentRowY + 6, { width: 120, ellipsis: true })
           .text((item.quantity || 1).toString(), 200, currentRowY + 6)
           .text(`₹${itemTotal.toFixed(2)}`, 250, currentRowY + 6)
           .text(`₹${itemPaidAmount.toFixed(2)}`, 350, currentRowY + 6)
           .text(`₹${itemBalance.toFixed(2)}`, 420, currentRowY + 6);
        
        // Status with color coding
        if (status === 'Paid') {
          doc.fillColor('#059669').text(status, 480, currentRowY + 6);
        } else if (status === 'Pending') {
          doc.fillColor('#d97706').text(status, 480, currentRowY + 6);
        } else {
          doc.fillColor('#dc2626').text(status, 480, currentRowY + 6);
        }
        
        currentRowY += 20;
      });
    } else {
      // Single service
      const totalAmount = testRequest.billing.amount || 0;
      const balance = totalAmount - paidAmount;
      const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                    testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
      
      doc.rect(20, currentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text('1', 30, currentRowY + 6)
         .text(testRequest.testType || 'Lab Test', 70, currentRowY + 6, { width: 120, ellipsis: true })
         .text('1', 200, currentRowY + 6)
         .text(`₹${totalAmount.toFixed(2)}`, 250, currentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 350, currentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 420, currentRowY + 6);
      
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, currentRowY + 6);
      } else if (status === 'Pending') {
        doc.fillColor('#d97706').text(status, 480, currentRowY + 6);
      } else {
        doc.fillColor('#dc2626').text(status, 480, currentRowY + 6);
      }
      
      currentRowY += 20;
    }
    
    // ===== BILL SUMMARY SECTIONS =====
    const summaryY = currentRowY + 20;
    
    // Current Bill Summary (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Bill Summary', 20, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 20)
       .text(`Discount(-): ₹${discounts.toFixed(2)}`, 20, summaryY + 35)
       .text(`Tax Amount: ₹${taxes.toFixed(2)}`, 20, summaryY + 50)
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 65)
       .font('Helvetica-Bold')
       .text(`Amount Paid: ₹${paidAmount.toFixed(2)}`, 20, summaryY + 80);
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received') {
      billStatus = 'PAID';
    } else if (testRequest.billing.status === 'refunded') {
      billStatus = 'REFUNDED';
    } else if (testRequest.billing.status === 'cancelled') {
      billStatus = 'CANCELLED';
    } else if (paidAmount > 0 && paidAmount < grandTotal) {
      billStatus = 'PARTIAL';
    }
    
    // Status with color coding
    if (billStatus === 'PAID') {
      doc.fillColor('#059669').text(`Status: ${billStatus}`, 20, summaryY + 95);
    } else if (billStatus === 'CANCELLED') {
      doc.fillColor('#dc2626').text(`Status: ${billStatus}`, 20, summaryY + 95);
    } else {
      doc.fillColor('#d97706').text(`Status: ${billStatus}`, 20, summaryY + 95);
    }
    
    // Payment Summary (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment Summary', 300, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Bill Amount: ₹${grandTotal.toFixed(2)}`, 300, summaryY + 20)
       .text(`Bill Status: ${billStatus}`, 300, summaryY + 35)
       .text(`Amount Paid: ₹${paidAmount.toFixed(2)}`, 300, summaryY + 50);
    
    // Generation Details
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Generation Details', 300, summaryY + 80);
    
    const generatedBy = testRequest.centerId?.name || 'Receptionist 01';
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const generatedTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${generatedBy}`, 300, summaryY + 100)
       .text(`Date: ${generatedDate}`, 300, summaryY + 115)
       .text(`Time: ${generatedTime}`, 300, summaryY + 130);
    
    // Paid Amount in Words
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Paid Amount (in words): (Rs.) ${numberToWords(paidAmount)} Only`, 20, summaryY + 150);
    
    // ===== PAYMENT HISTORY SECTION =====
    const paymentHistoryY = summaryY + 180;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment History', 20, paymentHistoryY);
    
    // Payment History Table Header
    const paymentTableY = paymentHistoryY + 20;
    doc.rect(20, paymentTableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('DATE', 30, paymentTableY + 8)
       .text('SERVICE', 80, paymentTableY + 8)
       .text('AMOUNT', 180, paymentTableY + 8)
       .text('PAID', 250, paymentTableY + 8)
       .text('REFUNDED', 320, paymentTableY + 8)
       .text('BALANCE', 400, paymentTableY + 8)
       .text('STATUS', 480, paymentTableY + 8);
    
    let paymentRowY = paymentTableY + 25;
    
    // Add payment history rows
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach((item, index) => {
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        const itemPaymentRatio = itemTotal / grandTotal;
        const itemPaidAmount = paidAmount * itemPaymentRatio;
        const itemBalance = itemTotal - itemPaidAmount;
        
        const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                      testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
        const paymentDate = testRequest.billing.paidAt ? 
          new Date(testRequest.billing.paidAt).toLocaleDateString('en-GB') : 
          new Date().toLocaleDateString('en-GB');
        
        // Payment history row
        doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
        
        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica')
           .text(paymentDate, 30, paymentRowY + 6)
           .text(item.name || 'Lab Test', 80, paymentRowY + 6, { width: 90, ellipsis: true })
           .text(`₹${itemTotal.toFixed(2)}`, 180, paymentRowY + 6)
           .text(`₹${itemPaidAmount.toFixed(2)}`, 250, paymentRowY + 6)
           .text('₹0.00', 320, paymentRowY + 6)
           .text(`₹${itemBalance.toFixed(2)}`, 400, paymentRowY + 6);
        
        // Status with color coding
        if (status === 'Paid') {
          doc.fillColor('#059669').text(status, 480, paymentRowY + 6);
        } else if (status === 'Pending') {
          doc.fillColor('#d97706').text(status, 480, paymentRowY + 6);
        } else {
          doc.fillColor('#dc2626').text(status, 480, paymentRowY + 6);
        }
        
        paymentRowY += 20;
      });
    } else {
      // Single service payment history
      const totalAmount = testRequest.billing.amount || 0;
      const balance = totalAmount - paidAmount;
      const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                    testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
      const paymentDate = testRequest.billing.paidAt ? 
        new Date(testRequest.billing.paidAt).toLocaleDateString('en-GB') : 
        new Date().toLocaleDateString('en-GB');
      
      doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text(paymentDate, 30, paymentRowY + 6)
         .text(testRequest.testType || 'Lab Test', 80, paymentRowY + 6, { width: 90, ellipsis: true })
         .text(`₹${totalAmount.toFixed(2)}`, 180, paymentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 250, paymentRowY + 6)
         .text('₹0.00', 320, paymentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 400, paymentRowY + 6);
      
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, paymentRowY + 6);
      } else if (status === 'Pending') {
        doc.fillColor('#d97706').text(status, 480, paymentRowY + 6);
      } else {
        doc.fillColor('#dc2626').text(status, 480, paymentRowY + 6);
      }
      
      paymentRowY += 20;
    }
    
    // ===== FOOTER SECTION =====
    const footerY = paymentRowY + 30;
    
    // Invoice Terms (Bottom Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 20, footerY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('• Original invoice document', 20, footerY + 20)
       .text('• Payment due upon receipt', 20, footerY + 35)
       .text('• Keep for your records', 20, footerY + 50)
       .text('• No refunds after 7 days', 20, footerY + 65);
    
    // Signature Area (Bottom Right)
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('For Chanre Hospital', 400, footerY + 50, { align: 'right', width: 170 })
       .text('Authorized Signature', 400, footerY + 70, { align: 'right', width: 170 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    res.status(500).json({ message: 'Error generating invoice PDF', error: error.message });
  }
};

// Generate consultation fee invoice with professional design
export const generateConsultationInvoicePDF = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }
    
    // Find the patient with billing information
    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findById(patientId)
      .populate('centerId', 'name code address phone email')
      .populate('currentDoctor', 'name specializations')
      .populate('assignedDoctor', 'name specializations');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    if (!patient.billing || patient.billing.length === 0) {
      return res.status(400).json({ message: 'No billing information found for this patient' });
    }
    
    // Create PDF document with professional layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,
      info: {
        Title: `Consultation Invoice - ${patient.name}`,
        Author: 'Chanre Hospital',
        Subject: `Consultation Invoice for ${patient.name}`,
        Creator: 'Hospital Management System'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=consultation-invoice-${patient._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ===== HEADER SECTION =====
    // Hospital Information (Top Left)
    const hospitalName = patient.centerId?.name || 'Chanre Hospital';
    const hospitalAddress = patient.centerId?.address || 'Rajajinagar, Bengaluru';
    const hospitalPhone = patient.centerId?.phone || '1234567890';
    const hospitalEmail = patient.centerId?.email || 'chanrehospital@gmail.com';
    
    doc.fillColor('#000000')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(hospitalName, 20, 20);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(hospitalAddress, 20, 45)
       .text(`Phone: ${hospitalPhone}`, 20, 58)
       .text(`Email: ${hospitalEmail}`, 20, 71);
    
    // Bill Title & Details (Top Right)
    doc.fillColor('#1e40af')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('OUTPATIENT BILL', 400, 20, { align: 'right', width: 170 });
    
    const billNumber = `CONSULT-${Date.now()}`;
    const billDate = new Date().toLocaleDateString('en-GB');
    const billTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Bill No: ${billNumber}`, 400, 45, { align: 'right', width: 170 })
       .text(`Date: ${billDate}, ${billTime}`, 400, 58, { align: 'right', width: 170 });
    
    // ===== PATIENT & CONSULTANT INFORMATION =====
    const infoY = 100;
    
    // Patient Information (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information', 20, infoY);
    
    const patientName = patient.name || 'N/A';
    const patientAge = patient.age || 'N/A';
    const patientGender = patient.gender || 'N/A';
    const patientPhone = patient.phone || 'N/A';
    const fileNumber = patient.uhId || patient._id.toString().slice(-7);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${patientName}`, 20, infoY + 20)
       .text(`Age: ${patientAge} | Gender: ${patientGender}`, 20, infoY + 35)
       .text(`Contact: ${patientPhone}`, 20, infoY + 50)
       .text(`File No: ${fileNumber}`, 20, infoY + 65);
    
    // Consultant Information (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Consultant Information', 300, infoY);
    
    const doctorName = patient.currentDoctor?.name || patient.assignedDoctor?.name || 'Dr. Doctor';
    const department = patient.currentDoctor?.specializations?.[0] || patient.assignedDoctor?.specializations?.[0] || 'General Medicine';
    const userId = patient.currentDoctor?._id?.toString().slice(-7) || patient.assignedDoctor?._id?.toString().slice(-7) || '09485dd';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Doctor: ${doctorName}`, 300, infoY + 20)
       .text(`Department: ${department}`, 300, infoY + 35)
       .text(`User ID: ${userId}`, 300, infoY + 50)
       .text(`Ref. Doctor: N/A`, 300, infoY + 65);
    
    // ===== CURRENT SERVICES BILLED SECTION =====
    const servicesY = infoY + 100;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Services Billed', 20, servicesY);
    
    // Calculate totals from billing records
    let grandTotal = 0;
    let totalPaid = 0;
    
    patient.billing.forEach(bill => {
      grandTotal += bill.amount || 0;
      if (bill.status === 'paid' || bill.status === 'payment_received') {
        totalPaid += bill.amount || 0;
      }
    });
    
    const remainingAmount = grandTotal - totalPaid;
    
    // Services Table Header
    const tableY = servicesY + 20;
    doc.rect(20, tableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('S.NO', 30, tableY + 8)
       .text('SERVICE NAME', 70, tableY + 8)
       .text('QTY', 200, tableY + 8)
       .text('CHARGES', 250, tableY + 8)
       .text('PAID', 350, tableY + 8)
       .text('BAL', 420, tableY + 8)
       .text('STATUS', 480, tableY + 8);
    
    let currentRowY = tableY + 25;
    
    // Add billing items
    patient.billing.forEach((bill, index) => {
      const amount = bill.amount || 0;
      const isPaid = bill.status === 'paid' || bill.status === 'payment_received';
      const paidAmount = isPaid ? amount : 0;
      const balance = amount - paidAmount;
      const status = isPaid ? 'Paid' : 'Pending';
      
      // Service row
      doc.rect(20, currentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text((index + 1).toString(), 30, currentRowY + 6)
         .text(bill.description || bill.type || 'Consultation', 70, currentRowY + 6, { width: 120, ellipsis: true })
         .text('1', 200, currentRowY + 6)
         .text(`₹${amount.toFixed(2)}`, 250, currentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 350, currentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 420, currentRowY + 6);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, currentRowY + 6);
      } else {
        doc.fillColor('#d97706').text(status, 480, currentRowY + 6);
      }
      
      currentRowY += 20;
    });
    
    // ===== BILL SUMMARY SECTIONS =====
    const summaryY = currentRowY + 20;
    
    // Current Bill Summary (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Bill Summary', 20, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 20)
       .text(`Discount(-): ₹0.00`, 20, summaryY + 35)
       .text(`Tax Amount: ₹0.00`, 20, summaryY + 50)
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 65)
       .font('Helvetica-Bold')
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 20, summaryY + 80);
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (totalPaid >= grandTotal) {
      billStatus = 'PAID';
    } else if (totalPaid > 0) {
      billStatus = 'PARTIAL';
    }
    
    // Status with color coding
    if (billStatus === 'PAID') {
      doc.fillColor('#059669').text(`Status: ${billStatus}`, 20, summaryY + 95);
    } else {
      doc.fillColor('#d97706').text(`Status: ${billStatus}`, 20, summaryY + 95);
    }
    
    // Payment Summary (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment Summary', 300, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Bill Amount: ₹${grandTotal.toFixed(2)}`, 300, summaryY + 20)
       .text(`Bill Status: ${billStatus}`, 300, summaryY + 35)
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 300, summaryY + 50);
    
    // Generation Details
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Generation Details', 300, summaryY + 80);
    
    const generatedBy = patient.centerId?.name || 'Receptionist 01';
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const generatedTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${generatedBy}`, 300, summaryY + 100)
       .text(`Date: ${generatedDate}`, 300, summaryY + 115)
       .text(`Time: ${generatedTime}`, 300, summaryY + 130);
    
    // Paid Amount in Words
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Paid Amount (in words): (Rs.) ${numberToWords(totalPaid)} Only`, 20, summaryY + 150);
    
    // ===== PAYMENT HISTORY SECTION =====
    const paymentHistoryY = summaryY + 180;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment History', 20, paymentHistoryY);
    
    // Payment History Table Header
    const paymentTableY = paymentHistoryY + 20;
    doc.rect(20, paymentTableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('DATE', 30, paymentTableY + 8)
       .text('SERVICE', 80, paymentTableY + 8)
       .text('AMOUNT', 180, paymentTableY + 8)
       .text('PAID', 250, paymentTableY + 8)
       .text('REFUNDED', 320, paymentTableY + 8)
       .text('BALANCE', 400, paymentTableY + 8)
       .text('STATUS', 480, paymentTableY + 8);
    
    let paymentRowY = paymentTableY + 25;
    
    // Add payment history rows
    patient.billing.forEach((bill, index) => {
      const amount = bill.amount || 0;
      const isPaid = bill.status === 'paid' || bill.status === 'payment_received';
      const paidAmount = isPaid ? amount : 0;
      const balance = amount - paidAmount;
      const status = isPaid ? 'Paid' : 'Pending';
      const paymentDate = bill.paidAt ? 
        new Date(bill.paidAt).toLocaleDateString('en-GB') : 
        new Date().toLocaleDateString('en-GB');
      
      // Payment history row
      doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text(paymentDate, 30, paymentRowY + 6)
         .text(bill.description || bill.type || 'Consultation', 80, paymentRowY + 6, { width: 90, ellipsis: true })
         .text(`₹${amount.toFixed(2)}`, 180, paymentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 250, paymentRowY + 6)
         .text('₹0.00', 320, paymentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 400, paymentRowY + 6);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, paymentRowY + 6);
      } else {
        doc.fillColor('#d97706').text(status, 480, paymentRowY + 6);
      }
      
      paymentRowY += 20;
    });
    
    // ===== FOOTER SECTION =====
    const footerY = paymentRowY + 30;
    
    // Invoice Terms (Bottom Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 20, footerY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('• Original invoice document', 20, footerY + 20)
       .text('• Payment due upon receipt', 20, footerY + 35)
       .text('• Keep for your records', 20, footerY + 50)
       .text('• No refunds after 7 days', 20, footerY + 65);
    
    // Signature Area (Bottom Right)
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('For Chanre Hospital', 400, footerY + 50, { align: 'right', width: 170 })
       .text('Authorized Signature', 400, footerY + 70, { align: 'right', width: 170 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    res.status(500).json({ message: 'Error generating consultation invoice PDF', error: error.message });
  }
};

// Generate reassignment invoice with professional design
export const generateReassignmentInvoicePDF = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }
    
    // Find the patient with reassigned billing information
    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findById(patientId)
      .populate('centerId', 'name code address phone email')
      .populate('currentDoctor', 'name specializations')
      .populate('assignedDoctor', 'name specializations');
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    if (!patient.reassignedBilling || patient.reassignedBilling.length === 0) {
      return res.status(400).json({ message: 'No reassigned billing information found for this patient' });
    }
    
    // Create PDF document with professional layout
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20,
      info: {
        Title: `Reassignment Invoice - ${patient.name}`,
        Author: 'Chanre Hospital',
        Subject: `Reassignment Invoice for ${patient.name}`,
        Creator: 'Hospital Management System'
      }
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reassignment-invoice-${patient._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // ===== HEADER SECTION =====
    // Hospital Information (Top Left)
    const hospitalName = patient.centerId?.name || 'Chanre Hospital';
    const hospitalAddress = patient.centerId?.address || 'Rajajinagar, Bengaluru';
    const hospitalPhone = patient.centerId?.phone || '1234567890';
    const hospitalEmail = patient.centerId?.email || 'chanrehospital@gmail.com';
    
    doc.fillColor('#000000')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(hospitalName, 20, 20);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(hospitalAddress, 20, 45)
       .text(`Phone: ${hospitalPhone}`, 20, 58)
       .text(`Email: ${hospitalEmail}`, 20, 71);
    
    // Bill Title & Details (Top Right)
    doc.fillColor('#1e40af')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('OUTPATIENT BILL', 400, 20, { align: 'right', width: 170 });
    
    const billNumber = `REASSIGN-${Date.now()}`;
    const billDate = new Date().toLocaleDateString('en-GB');
    const billTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Bill No: ${billNumber}`, 400, 45, { align: 'right', width: 170 })
       .text(`Date: ${billDate}, ${billTime}`, 400, 58, { align: 'right', width: 170 });
    
    // ===== PATIENT & CONSULTANT INFORMATION =====
    const infoY = 100;
    
    // Patient Information (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Patient Information', 20, infoY);
    
    const patientName = patient.name || 'N/A';
    const patientAge = patient.age || 'N/A';
    const patientGender = patient.gender || 'N/A';
    const patientPhone = patient.phone || 'N/A';
    const fileNumber = patient.uhId || patient._id.toString().slice(-7);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Name: ${patientName}`, 20, infoY + 20)
       .text(`Age: ${patientAge} | Gender: ${patientGender}`, 20, infoY + 35)
       .text(`Contact: ${patientPhone}`, 20, infoY + 50)
       .text(`File No: ${fileNumber}`, 20, infoY + 65);
    
    // Consultant Information (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Consultant Information', 300, infoY);
    
    const doctorName = patient.currentDoctor?.name || patient.assignedDoctor?.name || 'Dr. Doctor';
    const department = patient.currentDoctor?.specializations?.[0] || patient.assignedDoctor?.specializations?.[0] || 'General Medicine';
    const userId = patient.currentDoctor?._id?.toString().slice(-7) || patient.assignedDoctor?._id?.toString().slice(-7) || '09485dd';
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Doctor: ${doctorName}`, 300, infoY + 20)
       .text(`Department: ${department}`, 300, infoY + 35)
       .text(`User ID: ${userId}`, 300, infoY + 50)
       .text(`Ref. Doctor: N/A`, 300, infoY + 65);
    
    // ===== CURRENT SERVICES BILLED SECTION =====
    const servicesY = infoY + 100;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Services Billed', 20, servicesY);
    
    // Calculate totals from reassigned billing records
    let grandTotal = 0;
    let totalPaid = 0;
    
    patient.reassignedBilling.forEach(bill => {
      grandTotal += bill.amount || 0;
      if (bill.status === 'paid' || bill.status === 'payment_received') {
        totalPaid += bill.amount || 0;
      }
    });
    
    const remainingAmount = grandTotal - totalPaid;
    
    // Services Table Header
    const tableY = servicesY + 20;
    doc.rect(20, tableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('S.NO', 30, tableY + 8)
       .text('SERVICE NAME', 70, tableY + 8)
       .text('QTY', 200, tableY + 8)
       .text('CHARGES', 250, tableY + 8)
       .text('PAID', 350, tableY + 8)
       .text('BAL', 420, tableY + 8)
       .text('STATUS', 480, tableY + 8);
    
    let currentRowY = tableY + 25;
    
    // Add reassigned billing items
    patient.reassignedBilling.forEach((bill, index) => {
      const amount = bill.amount || 0;
      const isPaid = bill.status === 'paid' || bill.status === 'payment_received';
      const paidAmount = isPaid ? amount : 0;
      const balance = amount - paidAmount;
      const status = isPaid ? 'Paid' : 'Pending';
      
      // Service row
      doc.rect(20, currentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text((index + 1).toString(), 30, currentRowY + 6)
         .text(bill.description || bill.type || 'Reassignment Service', 70, currentRowY + 6, { width: 120, ellipsis: true })
         .text('1', 200, currentRowY + 6)
         .text(`₹${amount.toFixed(2)}`, 250, currentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 350, currentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 420, currentRowY + 6);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, currentRowY + 6);
      } else {
        doc.fillColor('#d97706').text(status, 480, currentRowY + 6);
      }
      
      currentRowY += 20;
    });
    
    // ===== BILL SUMMARY SECTIONS =====
    const summaryY = currentRowY + 20;
    
    // Current Bill Summary (Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Current Bill Summary', 20, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 20)
       .text(`Discount(-): ₹0.00`, 20, summaryY + 35)
       .text(`Tax Amount: ₹0.00`, 20, summaryY + 50)
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 20, summaryY + 65)
       .font('Helvetica-Bold')
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 20, summaryY + 80);
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (totalPaid >= grandTotal) {
      billStatus = 'PAID';
    } else if (totalPaid > 0) {
      billStatus = 'PARTIAL';
    }
    
    // Status with color coding
    if (billStatus === 'PAID') {
      doc.fillColor('#059669').text(`Status: ${billStatus}`, 20, summaryY + 95);
    } else {
      doc.fillColor('#d97706').text(`Status: ${billStatus}`, 20, summaryY + 95);
    }
    
    // Payment Summary (Right)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment Summary', 300, summaryY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Total Bill Amount: ₹${grandTotal.toFixed(2)}`, 300, summaryY + 20)
       .text(`Bill Status: ${billStatus}`, 300, summaryY + 35)
       .text(`Amount Paid: ₹${totalPaid.toFixed(2)}`, 300, summaryY + 50);
    
    // Generation Details
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Generation Details', 300, summaryY + 80);
    
    const generatedBy = patient.centerId?.name || 'Receptionist 01';
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const generatedTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${generatedBy}`, 300, summaryY + 100)
       .text(`Date: ${generatedDate}`, 300, summaryY + 115)
       .text(`Time: ${generatedTime}`, 300, summaryY + 130);
    
    // Paid Amount in Words
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Paid Amount (in words): (Rs.) ${numberToWords(totalPaid)} Only`, 20, summaryY + 150);
    
    // ===== PAYMENT HISTORY SECTION =====
    const paymentHistoryY = summaryY + 180;
    
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Payment History', 20, paymentHistoryY);
    
    // Payment History Table Header
    const paymentTableY = paymentHistoryY + 20;
    doc.rect(20, paymentTableY, 550, 25).fill('#f3f4f6').stroke('#000000');
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('DATE', 30, paymentTableY + 8)
       .text('SERVICE', 80, paymentTableY + 8)
       .text('AMOUNT', 180, paymentTableY + 8)
       .text('PAID', 250, paymentTableY + 8)
       .text('REFUNDED', 320, paymentTableY + 8)
       .text('BALANCE', 400, paymentTableY + 8)
       .text('STATUS', 480, paymentTableY + 8);
    
    let paymentRowY = paymentTableY + 25;
    
    // Add payment history rows
    patient.reassignedBilling.forEach((bill, index) => {
      const amount = bill.amount || 0;
      const isPaid = bill.status === 'paid' || bill.status === 'payment_received';
      const paidAmount = isPaid ? amount : 0;
      const balance = amount - paidAmount;
      const status = isPaid ? 'Paid' : 'Pending';
      const paymentDate = bill.paidAt ? 
        new Date(bill.paidAt).toLocaleDateString('en-GB') : 
        new Date().toLocaleDateString('en-GB');
      
      // Payment history row
      doc.rect(20, paymentRowY, 550, 20).stroke('#000000');
      
      doc.fillColor('#000000')
         .fontSize(9)
         .font('Helvetica')
         .text(paymentDate, 30, paymentRowY + 6)
         .text(bill.description || bill.type || 'Reassignment Service', 80, paymentRowY + 6, { width: 90, ellipsis: true })
         .text(`₹${amount.toFixed(2)}`, 180, paymentRowY + 6)
         .text(`₹${paidAmount.toFixed(2)}`, 250, paymentRowY + 6)
         .text('₹0.00', 320, paymentRowY + 6)
         .text(`₹${balance.toFixed(2)}`, 400, paymentRowY + 6);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 480, paymentRowY + 6);
      } else {
        doc.fillColor('#d97706').text(status, 480, paymentRowY + 6);
      }
      
      paymentRowY += 20;
    });
    
    // ===== FOOTER SECTION =====
    const footerY = paymentRowY + 30;
    
    // Invoice Terms (Bottom Left)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 20, footerY);
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('• Original invoice document', 20, footerY + 20)
       .text('• Payment due upon receipt', 20, footerY + 35)
       .text('• Keep for your records', 20, footerY + 50)
       .text('• No refunds after 7 days', 20, footerY + 65);
    
    // Signature Area (Bottom Right)
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('For Chanre Hospital', 400, footerY + 50, { align: 'right', width: 170 })
       .text('Authorized Signature', 400, footerY + 70, { align: 'right', width: 170 });
    
    // Finalize PDF
    doc.end();
    
  } catch (error) {
    res.status(500).json({ message: 'Error generating reassignment invoice PDF', error: error.message });
  }
};


