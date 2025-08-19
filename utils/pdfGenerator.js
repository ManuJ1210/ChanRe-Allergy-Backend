import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generateLabReportPDF = async (testRequest, reportData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Lab Report - ${testRequest.patientName}`,
          Author: 'Laboratory Management System',
          Subject: `Test Report for ${testRequest.testType}`,
          Creator: 'Lab Management System'
        }
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `lab-report-${testRequest._id}-${timestamp}.pdf`;
      const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');
      const filepath = path.join(uploadsDir, filename);
      
      // Ensure directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('LABORATORY TEST REPORT', { align: 'center' })
         .moveDown(1.5);

      // Report Information Box - Adjusted positioning
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Report ID: ${testRequest._id}`, 400, 100)
         .text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 400, 120)
         .text(`Status: ${testRequest.status.replace(/_/g, ' ')}`, 400, 140);

      // Patient Information Section - Increased spacing
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('PATIENT INFORMATION', 50, 200)
         .moveTo(50, 215)
         .lineTo(550, 215)
         .stroke();

      doc.fontSize(11)
         .font('Helvetica')
         .text(`Patient Name: ${testRequest.patientName || testRequest.patientId?.name || 'N/A'}`, 50, 235)
         .text(`Patient ID: ${testRequest.patientId && typeof testRequest.patientId === 'object' ? testRequest.patientId._id : testRequest.patientId || 'N/A'}`, 50, 255)
         .text(`Phone: ${testRequest.patientPhone || testRequest.patientId?.phone || 'N/A'}`, 50, 275)
         .text(`Address: ${testRequest.patientAddress || testRequest.patientId?.address || 'N/A'}`, 50, 295);

      // Doctor Information Section - Increased spacing
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('REQUESTING DOCTOR', 50, 320)
         .moveTo(50, 335)
         .lineTo(550, 335)
         .stroke();

      doc.fontSize(11)
         .font('Helvetica')
         .text(`Doctor Name: ${testRequest.doctorName || testRequest.doctorId?.name || 'N/A'}`, 50, 355)
         .text(`Doctor Email: ${testRequest.doctorId?.email || 'N/A'}`, 50, 375)
         .text(`Doctor Phone: ${testRequest.doctorId?.phone || 'N/A'}`, 50, 395);

      // Test Information Section - Increased spacing
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('TEST INFORMATION', 50, 420)
         .moveTo(50, 435)
         .lineTo(550, 435)
         .stroke();

      doc.fontSize(11)
         .font('Helvetica')
         .text(`Test Type: ${testRequest.testType || 'N/A'}`, 50, 455)
         .text(`Test Description: ${testRequest.testDescription || 'N/A'}`, 50, 475)
         .text(`Urgency: ${testRequest.urgency || 'Normal'}`, 50, 495)
         .text(`Sample Collection Date: ${testRequest.sampleCollectionActualDate ? new Date(testRequest.sampleCollectionActualDate).toLocaleDateString() : 'N/A'}`, 50, 515)
         .text(`Testing Completed Date: ${testRequest.labTestingCompletedDate ? new Date(testRequest.labTestingCompletedDate).toLocaleDateString() : 'N/A'}`, 50, 535);

      // Test Results Section - Increased spacing
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('TEST RESULTS', 50, 560)
         .moveTo(50, 575)
         .lineTo(550, 575)
         .stroke();

      let yPosition = 590;

      // Debug: Log the testRequest structure to help identify data
      console.log('Test Request Object Keys:', Object.keys(testRequest));
      console.log('Test Request resultValues:', testRequest.resultValues);
      console.log('Test Request testParameters:', testRequest.testParameters);
      console.log('Test Request parameters:', testRequest.parameters);
      console.log('Test Request results:', testRequest.results);

      if (testRequest.testResults) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Results:', 50, yPosition);
        
        yPosition += 15;
        
        doc.font('Helvetica')
           .text(testRequest.testResults, 50, yPosition, { 
             width: 500, 
             align: 'left',
             continued: false 
           });
        
        yPosition += doc.heightOfString(testRequest.testResults, { width: 500 }) + 10;
      }

      // Test Parameters (if available)
      // Check multiple possible data structures for test parameters
      const testParameters = testRequest.resultValues || 
                           testRequest.testParameters || 
                           testRequest.parameters || 
                           testRequest.results || 
                           [];
      
      if (testParameters && testParameters.length > 0) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Test Parameters:', 50, yPosition);
        
        yPosition += 20;

        // Table headers
        doc.font('Helvetica-Bold')
           .text('Parameter', 50, yPosition)
           .text('Value', 200, yPosition)
           .text('Unit', 300, yPosition)
           .text('Normal Range', 400, yPosition)
           .text('Status', 500, yPosition);

        yPosition += 15;
        
        // Draw line under headers
        doc.moveTo(50, yPosition)
           .lineTo(550, yPosition)
           .stroke();

        yPosition += 10;

        testParameters.forEach((param, index) => {
          if (yPosition > 750) { // Start new page if needed - increased threshold
            doc.addPage();
            yPosition = 50;
          }

          // Debug: Log each parameter object to see its structure
          console.log(`Parameter ${index}:`, param);
          console.log(`Parameter keys:`, Object.keys(param));

          // Handle different parameter object structures - based on actual data
          let parameterName = param.parameter || param.name || param.testName || param.paramName || param.param || param.test || '-';
          const parameterValue = param.value || param.result || param.testValue || param.paramValue || param.actualValue || '-';
          const parameterUnit = param.unit || param.measurementUnit || param.unitOfMeasure || param.unitOfMeasure || '-';
          const parameterRange = param.normalRange || param.referenceRange || param.range || param.normal || param.reference || '-';
          const parameterStatus = param.status || param.resultStatus || param.abnormal || param.flag || 'Normal';
          
          // If parameter name is still '-', try to use the first available string value or create a generic name
          if (parameterName === '-') {
            // Try to find any string value that could be a parameter name
            const possibleName = Object.values(param).find(val => 
              typeof val === 'string' && val.length > 0 && val !== 'Normal' && val !== 'Normal'
            );
            parameterName = possibleName || `Parameter ${index + 1}`;
          }

          doc.font('Helvetica')
             .text(parameterName, 50, yPosition)
             .text(parameterValue, 200, yPosition)
             .text(parameterUnit, 300, yPosition)
             .text(parameterRange, 400, yPosition)
             .text(parameterStatus, 500, yPosition);

          yPosition += 15;
        });

        yPosition += 10;
      } else {
        // Show message when no parameters are available
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Test Parameters:', 50, yPosition);
        
        yPosition += 20;
        
        // Debug information to help identify the data structure
        doc.font('Helvetica')
           .text('No specific parameters recorded for this test.', 50, yPosition);
        
        yPosition += 15;
        
        // Show available data structure for debugging
        doc.fontSize(9)
           .font('Helvetica')
           .text('Available data keys:', 50, yPosition);
        
        yPosition += 15;
        
        const availableKeys = Object.keys(testRequest).filter(key => 
          key.toLowerCase().includes('result') || 
          key.toLowerCase().includes('test') || 
          key.toLowerCase().includes('param') ||
          key.toLowerCase().includes('value')
        );
        
        if (availableKeys.length > 0) {
          doc.text(`Found keys: ${availableKeys.join(', ')}`, 50, yPosition);
        } else {
          doc.text('No parameter-related keys found', 50, yPosition);
        }
           
        yPosition += 30;
      }

      // Clinical Interpretation
      if (reportData.clinicalInterpretation || testRequest.clinicalInterpretation) {
        if (yPosition > 750) { // Start new page if needed - increased threshold
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Clinical Interpretation:', 50, yPosition);
        
        yPosition += 15;
        
        doc.font('Helvetica')
           .text(reportData.clinicalInterpretation || testRequest.clinicalInterpretation, 50, yPosition, { 
             width: 500, 
             align: 'left' 
           });
        
        yPosition += doc.heightOfString(reportData.clinicalInterpretation || testRequest.clinicalInterpretation, { width: 500 }) + 15;
      }

      // Conclusion
      if (testRequest.conclusion) {
        if (yPosition > 750) { // Start new page if needed - increased threshold
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Conclusion:', 50, yPosition);
        
        yPosition += 15;
        
        doc.font('Helvetica')
           .text(testRequest.conclusion, 50, yPosition, { 
             width: 500, 
             align: 'left' 
           });
        
        yPosition += doc.heightOfString(testRequest.conclusion, { width: 500 }) + 15;
      }

      // Recommendations
      if (testRequest.recommendations) {
        if (yPosition > 750) { // Start new page if needed - increased threshold
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Recommendations:', 50, yPosition);
        
        yPosition += 15;
        
        doc.font('Helvetica')
           .text(testRequest.recommendations, 50, yPosition, { 
             width: 500, 
             align: 'left' 
           });
        
        yPosition += doc.heightOfString(testRequest.recommendations, { width: 500 }) + 15;
      }

      // Report Summary
      if (reportData.reportSummary || testRequest.reportSummary) {
        if (yPosition > 750) { // Start new page if needed - increased threshold
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Report Summary:', 50, yPosition);
        
        yPosition += 15;
        
        doc.font('Helvetica')
           .text(reportData.reportSummary || testRequest.reportSummary, 50, yPosition, { 
             width: 500, 
             align: 'left' 
           });
        
        yPosition += doc.heightOfString(reportData.reportSummary || testRequest.reportSummary, { width: 500 }) + 15;
      }

      // Lab Information and Signature Section
      if (yPosition > 750) { // Start new page if needed - increased threshold
        doc.addPage();
        yPosition = 50;
      } else {
        yPosition += 30;
      }

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('LABORATORY INFORMATION', 50, yPosition)
         .moveTo(50, yPosition + 15)
         .lineTo(550, yPosition + 15)
         .stroke();

      yPosition += 35;

      doc.fontSize(11)
         .font('Helvetica')
         .text(`Lab Technician: ${testRequest.labTechnicianName || testRequest.assignedLabStaffId?.staffName || 'N/A'}`, 50, yPosition)
         .text(`Report Generated By: ${testRequest.reportGeneratedByName || 'Lab Staff'}`, 50, yPosition + 15)
         .text(`Report Generated Date: ${testRequest.reportGeneratedDate ? new Date(testRequest.reportGeneratedDate).toLocaleDateString() : new Date().toLocaleDateString()}`, 50, yPosition + 30);

      // Footer
      yPosition += 80;
      doc.fontSize(9)
         .font('Helvetica')
         .text('This report is computer generated and does not require a signature.', 50, yPosition, { align: 'center' })
         .text(`Generated on ${new Date().toLocaleString()}`, 50, yPosition + 15, { align: 'center' })
         .text('Laboratory Management System', 50, yPosition + 30, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        console.log('PDF generated successfully:', filepath);
        resolve({ filename, filepath });
      });

      stream.on('error', (error) => {
        console.error('Error writing PDF:', error);
        reject(error);
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(error);
    }
  });
};