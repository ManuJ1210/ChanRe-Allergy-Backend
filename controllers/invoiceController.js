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
    
    // Header - Left side: INVOICE with attractive styling
    doc.fillColor('#1e40af')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('INVOICE', 15, 15);
    
    // Add a decorative line under INVOICE
    doc.strokeColor('#1e40af')
       .lineWidth(3)
       .moveTo(15, 45)
       .lineTo(120, 45)
       .stroke();
    
    // Header - Right side: Hospital details with attractive styling
    const hospitalName = testRequest.centerId?.name || 'Chanre Hospital';
    const hospitalAddress = testRequest.centerId?.address || 'Rajajinagar, Bengaluru';
    const hospitalPhone = testRequest.centerId?.phone || '08040810611';
    const hospitalFax = testRequest.centerId?.fax || '080-42516600';
    const hospitalWebsite = testRequest.centerId?.website || 'www.chanreallergy.com';
    
    // Hospital info box with border
    doc.rect(320, 10, 265, 85).fill('#f8fafc').stroke('#e2e8f0');
    
    doc.fillColor('#1e40af')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(hospitalName, 330, 25);
    
    doc.fillColor('#475569')
       .fontSize(11)
       .font('Helvetica')
       .text(hospitalAddress, 330, 45)
       .text(`PH: ${hospitalPhone} | Fax: ${hospitalFax}`, 330, 60)
       .text(`Website: ${hospitalWebsite}`, 330, 75);
    
    // Main title - INPATIENT BILL with attractive styling
    doc.fillColor('#dc2626')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('INPATIENT BILL', 330, 100, { align: 'center', width: 265 });
    
    doc.fillColor('#059669')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('LAB REPORTS INVOICE', 330, 120, { align: 'center', width: 265 });
    
    // Patient and Consultant Information Section with attractive styling
    const detailsY = 150;
    
    // Patient info box with border
    doc.rect(15, detailsY - 10, 280, 100).fill('#fefefe').stroke('#d1d5db');
    doc.fillColor('#1e40af')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('PATIENT INFORMATION', 25, detailsY + 5);
    
    // Left column - Patient details with better styling
    doc.fillColor('#374151')
       .fontSize(11)
       .font('Helvetica')
       .text(`Name: ${testRequest.patientName || testRequest.patientId?.name || 'N/A'}`, 25, detailsY + 20)
       .text(`Date: ${testRequest.billing.generatedAt ? new Date(testRequest.billing.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`, 25, detailsY + 35)
       .text(`Bill No: ${testRequest.billing.invoiceNumber || 'N/A'}`, 25, detailsY + 50)
       .text(`File No: ${testRequest._id}`, 25, detailsY + 65)
       .text(`Sex: ${testRequest.patientId?.gender || 'N/A'}`, 25, detailsY + 80);
    
    // Consultant info box with border
    doc.rect(310, detailsY - 10, 275, 100).fill('#fefefe').stroke('#d1d5db');
    doc.fillColor('#1e40af')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('CONSULTANT INFORMATION', 320, detailsY + 5);
    
    // Right column - Consultant details with better styling
    doc.fillColor('#374151')
       .fontSize(11)
       .font('Helvetica')
       .text(`Consultant Name: ${testRequest.doctorName || testRequest.doctorId?.name || 'N/A'}`, 320, detailsY + 20)
       .text(`Department: ${testRequest.doctorId?.specializations?.[0] || 'MD (Physiology)'}`, 320, detailsY + 35)
       .text(`Ref. Doctor:`, 320, detailsY + 50);
    
    // Calculate totals first
    const subtotal = testRequest.billing.items ? 
      testRequest.billing.items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0) :
      (testRequest.billing.amount || 0);
    
    const taxes = testRequest.billing.taxes || 0;
    const discounts = testRequest.billing.discounts || 0;
    const grandTotal = subtotal + taxes - discounts;
    const paidAmount = testRequest.billing.paidAmount || 0;
    const remainingAmount = grandTotal - paidAmount;
    
    // Service Items Table with attractive styling
    const serviceTableY = 270;
    
    // Table header with attractive styling
    doc.rect(15, serviceTableY, 570, 30).fill('#1e40af');
    doc.fillColor('#ffffff')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('S.NO', 25, serviceTableY + 10)
       .text('SERVICE NAME', 60, serviceTableY + 10)
       .text('QTY', 240, serviceTableY + 10)
       .text('CHARGES', 300, serviceTableY + 10)
       .text('PAID', 380, serviceTableY + 10)
       .text('BALANCE', 450, serviceTableY + 10)
       .text('STATUS', 520, serviceTableY + 10);
    
    let currentY = serviceTableY + 30;
    
    // Add billing items - Fixed to show proportional payments
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach((item, index) => {
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        
        // Calculate proportional payment for each item
        const itemPaymentRatio = itemTotal / grandTotal;
        const itemPaidAmount = paidAmount * itemPaymentRatio;
        const itemBalance = itemTotal - itemPaidAmount;
        
        const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                      testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
        
        // Alternate row colors for better readability
        const rowColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(15, currentY - 5, 570, 25).fill(rowColor);
        
        doc.fillColor('#374151')
           .fontSize(9)
           .font('Helvetica')
           .text((index + 1).toString(), 25, currentY + 5)
           .text(item.name || 'Lab Test', 60, currentY + 5, { width: 170, ellipsis: true })
           .text((item.quantity || 1).toString(), 240, currentY + 5)
           .text(`₹${(item.unitPrice || 0).toFixed(2)}`, 300, currentY + 5)
           .text(`₹${itemPaidAmount.toFixed(2)}`, 380, currentY + 5)
           .text(`₹${itemBalance.toFixed(2)}`, 450, currentY + 5);
        
        // Status with color coding
        if (status === 'Paid') {
          doc.fillColor('#059669').text(status, 520, currentY + 5);
        } else if (status === 'Pending') {
          doc.fillColor('#d97706').text(status, 520, currentY + 5);
        } else {
          doc.fillColor('#dc2626').text(status, 520, currentY + 5);
        }
        currentY += 20;
      });
    } else {
      // Fallback for single test
      const totalAmount = testRequest.billing.amount || 0;
      const paidAmount = testRequest.billing.paidAmount || 0;
      const balance = totalAmount - paidAmount;
      const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                    testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
      
      // Single test row with styling
      doc.rect(15, currentY - 5, 570, 25).fill('#f8fafc');
      
      doc.fillColor('#374151')
         .fontSize(9)
         .font('Helvetica')
         .text('1', 25, currentY + 5)
         .text(testRequest.testType || 'Lab Test', 60, currentY + 5, { width: 170, ellipsis: true })
         .text('1', 240, currentY + 5)
         .text(`₹${totalAmount.toFixed(2)}`, 300, currentY + 5)
         .text(`₹${paidAmount.toFixed(2)}`, 380, currentY + 5)
         .text(`₹${balance.toFixed(2)}`, 450, currentY + 5);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 520, currentY + 5);
      } else if (status === 'Pending') {
        doc.fillColor('#d97706').text(status, 520, currentY + 5);
      } else {
        doc.fillColor('#dc2626').text(status, 520, currentY + 5);
      }
      currentY += 20;
    }
    
    // Bill Status and Payment Information (Left Side)
    const statusY = currentY + 20;
    
    // Determine bill status
    let billStatus = 'PENDING';
    if (testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received') {
      billStatus = 'PAID';
    } else if (testRequest.billing.status === 'refunded') {
      billStatus = 'REFUNDED';
    } else if (paidAmount > 0 && paidAmount < grandTotal) {
      billStatus = 'PARTIAL';
    }
    
    // Bill Status
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica')
       .text(`Bill Status: `, 15, statusY)
       .font('Helvetica-Bold')
       .text(billStatus, 15 + 80, statusY);
    
    // Payment Details with attractive styling
    if (paidAmount > 0) {
      doc.fillColor('#374151')
         .fontSize(11)
         .font('Helvetica')
         .text(`Amount Paid: ₹${paidAmount.toFixed(2)}`, 15, statusY + 20)
         .text(`Amount Paid: (Rs.) ${numberToWords(paidAmount)} Only`, 15, statusY + 35);
      
      if (billStatus === 'PARTIAL') {
        doc.fillColor('#d97706')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text(`Remaining Amount: ₹${remainingAmount.toFixed(2)}`, 15, statusY + 50)
           .text(`Percentage Paid: ${Math.round((paidAmount / grandTotal) * 100)}%`, 15, statusY + 65);
      }
    } else {
      doc.fillColor('#dc2626')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`Amount Due: ₹${grandTotal.toFixed(2)}`, 15, statusY + 20);
    }
    
    // Summary of Charges with attractive styling
    const summaryY = statusY;
    const summaryX = 400;
    
    // Summary box with border
    doc.rect(summaryX - 10, summaryY - 10, 195, 120).fill('#fefefe').stroke('#d1d5db');
    
    doc.fillColor('#1e40af')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('SUMMARY OF CHARGES', summaryX, summaryY + 5);
    
    doc.fillColor('#374151')
       .fontSize(11)
       .font('Helvetica')
       .text(`Total Amount: ₹${grandTotal.toFixed(2)}`, summaryX, summaryY + 25)
       .text(`Discount(-): ₹${discounts.toFixed(2)}`, summaryX, summaryY + 40)
       .text(`Tax Amount: ₹${taxes.toFixed(2)}`, summaryX, summaryY + 55)
       .text(`Grand Total: ₹${grandTotal.toFixed(2)}`, summaryX, summaryY + 70)
       .text(`Amount Paid: ₹${paidAmount.toFixed(2)}`, summaryX, summaryY + 85);
    
    // Status with color coding and background
    let statusBgColor = '#f3f4f6';
    let statusTextColor = '#374151';
    
    if (billStatus === 'PAID') {
      statusBgColor = '#d1fae5';
      statusTextColor = '#059669';
    } else if (billStatus === 'PARTIAL') {
      statusBgColor = '#fef3c7';
      statusTextColor = '#d97706';
    } else if (billStatus === 'REFUNDED') {
      statusBgColor = '#f3e8ff';
      statusTextColor = '#7c3aed';
    } else {
      statusBgColor = '#fee2e2';
      statusTextColor = '#dc2626';
    }
    
    doc.rect(summaryX, summaryY + 95, 175, 15).fill(statusBgColor);
    doc.fillColor(statusTextColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(`Status: ${billStatus}`, summaryX + 5, summaryY + 105);
    
    // Payment History Table with attractive styling
    const paymentHistoryY = statusY + 140;
    doc.fillColor('#1e40af')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('PAYMENT HISTORY', 15, paymentHistoryY);
    
    // Payment history table header with attractive styling
    doc.rect(15, paymentHistoryY + 10, 570, 30).fill('#059669');
    doc.fillColor('#ffffff')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('DATE', 25, paymentHistoryY + 20)
       .text('SERVICE', 90, paymentHistoryY + 20)
       .text('AMOUNT', 180, paymentHistoryY + 20)
       .text('PAID', 250, paymentHistoryY + 20)
       .text('METHOD', 320, paymentHistoryY + 20)
       .text('REFUND', 390, paymentHistoryY + 20)
       .text('BALANCE', 460, paymentHistoryY + 20)
       .text('STATUS', 530, paymentHistoryY + 20);
    
    let paymentRowY = paymentHistoryY + 35;
    
    // Add payment history rows - Fixed logic to match the image
    if (testRequest.billing.items && testRequest.billing.items.length > 0) {
      testRequest.billing.items.forEach((item, index) => {
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        const paidAmount = testRequest.billing.paidAmount || 0;
        const grandTotal = subtotal + taxes - discounts;
        
        // Calculate proportional payment for each item
        const itemPaymentRatio = itemTotal / grandTotal;
        const itemPaidAmount = paidAmount * itemPaymentRatio;
        const itemBalance = itemTotal - itemPaidAmount;
        
        const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                      testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
        const paymentDate = testRequest.billing.paidAt ? new Date(testRequest.billing.paidAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
        const paymentMethod = testRequest.billing.paymentMethod || 'Cash';
        
        // Alternate row colors for payment history
        const paymentRowColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(15, paymentRowY - 5, 570, 25).fill(paymentRowColor);
        
        doc.fillColor('#374151')
           .fontSize(8)
           .font('Helvetica')
           .text(paymentDate, 25, paymentRowY + 5)
           .text(item.name || 'Lab Test', 90, paymentRowY + 5, { width: 80, ellipsis: true })
           .text(`₹${itemTotal.toFixed(2)}`, 180, paymentRowY + 5)
           .text(`₹${itemPaidAmount.toFixed(2)}`, 250, paymentRowY + 5)
           .text(paymentMethod, 320, paymentRowY + 5)
           .text('₹0.00', 390, paymentRowY + 5)
           .text(`₹${itemBalance.toFixed(2)}`, 460, paymentRowY + 5);
        
        // Status with color coding
        if (status === 'Paid') {
          doc.fillColor('#059669').text(status, 530, paymentRowY + 5);
        } else if (status === 'Pending') {
          doc.fillColor('#d97706').text(status, 530, paymentRowY + 5);
        } else {
          doc.fillColor('#dc2626').text(status, 530, paymentRowY + 5);
        }
        paymentRowY += 20;
      });
    } else {
      // Single test payment history
      const totalAmount = testRequest.billing.amount || 0;
      const paidAmount = testRequest.billing.paidAmount || 0;
      const balance = totalAmount - paidAmount;
      const status = testRequest.billing.status === 'paid' || testRequest.billing.status === 'payment_received' ? 'Paid' : 
                    testRequest.billing.status === 'refunded' ? 'Refunded' : 'Pending';
      const paymentDate = testRequest.billing.paidAt ? new Date(testRequest.billing.paidAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
      const paymentMethod = testRequest.billing.paymentMethod || 'Cash';
      
      // Single test payment history row with styling
      doc.rect(15, paymentRowY - 5, 570, 25).fill('#f8fafc');
      
      doc.fillColor('#374151')
         .fontSize(8)
         .font('Helvetica')
         .text(paymentDate, 25, paymentRowY + 5)
         .text(testRequest.testType || 'Lab Test', 90, paymentRowY + 5, { width: 80, ellipsis: true })
         .text(`₹${totalAmount.toFixed(2)}`, 180, paymentRowY + 5)
         .text(`₹${paidAmount.toFixed(2)}`, 250, paymentRowY + 5)
         .text(paymentMethod, 320, paymentRowY + 5)
         .text('₹0.00', 390, paymentRowY + 5)
         .text(`₹${balance.toFixed(2)}`, 460, paymentRowY + 5);
      
      // Status with color coding
      if (status === 'Paid') {
        doc.fillColor('#059669').text(status, 530, paymentRowY + 5);
      } else if (status === 'Pending') {
        doc.fillColor('#d97706').text(status, 530, paymentRowY + 5);
      } else {
        doc.fillColor('#dc2626').text(status, 530, paymentRowY + 5);
      }
      paymentRowY += 20;
    }
    
    // Footer Section
    const footerY = paymentRowY + 30;
    
    // Generated By and Date/Time section (Left side)
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated By: ${testRequest.centerId?.name || 'Test Receptionist'}`, 15, footerY)
       .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 15, footerY + 15)
       .text(`Time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}`, 15, footerY + 30);
    
    // Invoice Terms section (Right side)
    const termsY = footerY;
    doc.rect(400, termsY, 185, 80).stroke('#000000');
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Invoice Terms', 410, termsY + 10);
    
    doc.fillColor('#000000')
       .fontSize(9)
       .font('Helvetica')
       .text('• Original invoice document', 410, termsY + 25)
       .text('• Payment due upon receipt', 410, termsY + 40)
       .text('• Keep for your records', 410, termsY + 55)
       .text('• No refunds after 7 days', 410, termsY + 70);
    
    // Signature section - Fixed overlapping and dynamic hospital name
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('Signature:', 410, termsY + 90)
       .text(`For ${hospitalName}`, 410, termsY + 105);
    
    // Footer information - Home Sample Collection
    const homeCollectionY = termsY + 120;
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text('"For Home Sample Collection"', 15, homeCollectionY, { align: 'center', width: 570 })
       .text('Miss Call: 080-42516666|Mobile: 9686197153', 15, homeCollectionY + 15, { align: 'center', width: 570 });
    
    // Finalize PDF
    doc.end();
    
    console.log('✅ PDF generated successfully for test request:', testRequestId);
    
  } catch (error) {
    console.error('❌ Error generating invoice PDF:', error);
    res.status(500).json({ message: 'Error generating invoice PDF', error: error.message });
  }
};


