import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { formatProblemsPresentedDisplay } from "./problemsPresented.js";

const getUniversityLogoPath = () => {
  const candidates = [
    path.join(process.cwd(), "assets", "buksu-logo.png"),
    path.join(process.cwd(), "assets", "buksu-logo.jpg"),
    path.join(process.cwd(), "assets", "buksu-logo.jpeg"),
    path.join(process.cwd(), "public", "buksu-logo.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

/** Total letterhead height (pt) including top margin band — body starts below this + gap in record PDFs */
export const RECORD_PDF_HEADER_HEIGHT_PT = 168;

// Helper to add header/footer (BUKSU letterhead + SWEU / GCS; used by counselor & admin PDFs)
export const addRecordHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const headerHeight = RECORD_PDF_HEADER_HEIGHT_PT;
  const footerHeight = 92;
  const sidePadding = 36;
  /** Whitespace strip above the letterhead (page background shows through). */
  const headerTopMargin = 14;
  const innerHeaderHeight = headerHeight - headerTopMargin;
  const y0 = headerTopMargin;
  const logoSize = 70;
  const logoX = sidePadding;
  const logoY = y0 + 12;
  /** Full usable width — text is centered on the page (not in the column beside the logo). */
  const fullTextWidth = pageWidth - 2 * sidePadding;
  const fullTextX = sidePadding;
  void reportDate;

  // University letterhead header
  doc.fillColor('#ffffff');
  doc.rect(0, headerTopMargin, pageWidth, innerHeaderHeight).fill();

  let textY = y0 + 16;
  doc.font('Times-Bold').fontSize(15).fillColor('#000000');
  doc.text('BUKIDNON STATE UNIVERSITY', fullTextX, textY, {
    width: fullTextWidth,
    align: 'center',
  });
  textY += 20;

  doc.font('Times-Roman').fontSize(11).fillColor('#000000');
  doc.text('Fortich Street, Malaybalay City, Bukidnon 8700', fullTextX, textY, {
    width: fullTextWidth,
    align: 'center',
  });
  textY += 16;
  doc.text('Tel (088) 813-5661 to 5663; Telefax (088) 813-2717', fullTextX, textY, {
    width: fullTextWidth,
    align: 'center',
  });
  textY += 16;

  doc.font('Times-Roman').fontSize(11).fillColor('#1e40af');
  doc.text('www.buksu.edu.ph', fullTextX, textY, {
    width: fullTextWidth,
    align: 'center',
    link: 'http://www.buksu.edu.ph/',
    underline: true,
  });
  textY += 18;

  doc.strokeColor('#000000').lineWidth(0.75);
  doc.moveTo(sidePadding, textY).lineTo(pageWidth - sidePadding, textY).stroke();
  textY += 10;

  doc.fillColor('#000000').font('Times-Bold').fontSize(11);
  doc.text('STUDENT WELFARE AND ENGAGEMENT UNIT', fullTextX, textY, {
    width: fullTextWidth,
    align: 'center',
  });
  textY += 14;
  doc.font('Times-Italic').fontSize(10);
  doc.text('GUIDANCE AND COUNSELING SERVICES', fullTextX, textY, {
    width: fullTextWidth,
    align: 'center',
  });
  textY += 14;

  // Logo drawn last so it stays fixed on the left while text is visually page-centered
  const logoPath = getUniversityLogoPath();
  if (logoPath) {
    doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
  } else {
    doc
      .lineWidth(1)
      .strokeColor('#667085')
      .circle(logoX + logoSize / 2, logoY + logoSize / 2, 32)
      .stroke();
    doc
      .font('Times-Bold')
      .fontSize(7)
      .fillColor('#111827')
      .text('BUKSU', logoX, logoY + logoSize * 0.38, { width: logoSize, align: 'center' });
  }

  // Footer - Blue background
  const footerY = pageHeight - footerHeight;
  doc.fillColor('#667eea');
  doc.rect(0, footerY, pageWidth, footerHeight).fill();
  doc.fillColor('#ffffff');

  // Footer rows use centered lines with safe lengths to avoid clipping.
  // Line 1: Confidential notice
  doc.fontSize(8)
     .font('Times-Roman')
     .text("CONFIDENTIAL - Sensitive information protected by confidentiality policy.", sidePadding, footerY + 10, {
       align: 'center',
       width: pageWidth - sidePadding * 2,
       lineBreak: true,
     });

  // Line 3: System name
  doc.fontSize(7)
     .fillColor('#ffffff');
  doc.text("Counseling Services Management System", sidePadding, footerY + 34, {
    width: pageWidth - sidePadding * 2,
    align: 'center',
    lineBreak: true,
  });

  // Line 4: Page and tracking
  doc.fontSize(6.5)
     .fillColor('#ffffff');
  doc.text(`Page ${pageNum} of ${totalPages} | Tracking: ${trackingNumber}`, sidePadding, footerY + 48, {
    width: pageWidth - sidePadding * 2,
    align: 'center',
    lineBreak: true,
  });

  // Line 5: footer note
  doc.fontSize(6)
     .fillColor('#ffffff');
  doc.text("For inquiries, contact your system administrator. This report is generated electronically.", sidePadding, footerY + 63, {
    align: 'center',
    width: pageWidth - sidePadding * 2,
    lineBreak: true,
  });

  doc.fillColor(0, 0, 0);
};

// Function to generate a counseling record PDF
export const generateCounselingRecordPDF = async (recordData, sanitizedCounselorName) => {
      const trackingNumber = generateTrackingNumber();

      // Create temporary directory for PDF storage
      const tempDir = path.join(process.cwd(), "temp");
      fs.mkdirSync(tempDir, { recursive: true });
      const pdfPath = path.join(tempDir, `${sanitizedCounselorName}_${recordData.clientName.replace(/\s+/g, '_')}_${trackingNumber}.pdf`);

      const doc = new PDFDocument({ 
         margin: 0,
         size: 'A4'
      });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Page dimensions and margins
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginBottom = 72;
      const marginLeft = 72;
      const marginRight = 72;
      const headerHeight = RECORD_PDF_HEADER_HEIGHT_PT;
      const footerHeight = 92;
      const contentStartX = marginLeft;
      const contentWidth = pageWidth - marginLeft - marginRight;
      const contentStartY = headerHeight + 24;

      // Add header and footer
      const reportDate = recordData.date ? new Date(recordData.date).toLocaleDateString() : new Date().toLocaleDateString();
      addRecordHeaderFooter(doc, 1, 1, trackingNumber, reportDate);

      // Reset fill color to black
      doc.fillColor('black');
      doc.fillColor(0, 0, 0);

      // Start content
      let finalY = contentStartY;

      finalY += 12;

      // Client Details Section
      const labelWidth = 130;
      const valueStartX = contentStartX + labelWidth;

      const maxContentY = pageHeight - marginBottom - footerHeight - 80;

      const row = (label, value) => {
        if (value === undefined || value === null || String(value).trim() === "") return;
        doc.fontSize(12).font('Times-Bold').fillColor(0, 0, 0);
        doc.text(label, contentStartX, finalY);
        doc.font('Times-Roman').text(String(value), valueStartX, finalY);
        finalY += 22;
      };

      doc.fontSize(12).font('Times-Bold').fillColor(0, 0, 0);
      doc.text("Student name:", contentStartX, finalY);
      doc.font('Times-Roman').text(String(recordData.clientName || "N/A"), valueStartX, finalY);
      finalY += 22;

      row("School Year:", recordData.schoolYear);
      row("Gender:", recordData.gender);
      row("Course:", recordData.course);
      row("Year:", recordData.yearLevel);
      row("Section:", recordData.section);

      doc.fontSize(12).font('Times-Bold').fillColor(0, 0, 0);
      doc.text("Date:", contentStartX, finalY);
      doc.font('Times-Roman').text(recordData.date ? new Date(recordData.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A", valueStartX, finalY);
      finalY += 22;

      if (recordData.sessionNumber != null && recordData.sessionNumber !== "") {
        doc.font('Times-Bold').text("Session Number:", contentStartX, finalY);
        doc.font('Times-Roman').text(String(recordData.sessionNumber), valueStartX, finalY);
        finalY += 22;
      }

      doc.font('Times-Bold').text("Session Type:", contentStartX, finalY);
      doc.font('Times-Roman').text(String(recordData.sessionType || "N/A"), valueStartX, finalY);
      finalY += 22;

      doc.font('Times-Bold').text("Status:", contentStartX, finalY);
      doc.font('Times-Roman').text(String(recordData.status || "N/A"), valueStartX, finalY);
      finalY += 22;

      doc.font('Times-Bold').text("Counselor:", contentStartX, finalY);
      doc.font('Times-Roman').text(String(recordData.counselor || sanitizedCounselorName), valueStartX, finalY);
      finalY += 28;

      const renderParagraph = (title, body, emptyFallback) => {
        const text = (body && String(body).trim()) ? String(body) : emptyFallback;
        doc.fillColor(0, 0, 0);
        doc.fontSize(12).font('Times-Bold').text(`${title}:`, contentStartX, finalY);
        finalY += 22;
        const estimatedH = doc.heightOfString(text, { width: contentWidth, lineGap: 5 });
        if (finalY + estimatedH + 80 > maxContentY) {
          doc.addPage();
          addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
          doc.fillColor(0, 0, 0);
          finalY = contentStartY;
        }
        doc.fontSize(12).font('Times-Roman').text(text, contentStartX, finalY, {
          width: contentWidth,
          align: 'left',
          lineGap: 5,
        });
        const h = doc.heightOfString(text, { width: contentWidth, lineGap: 5 });
        finalY += h + 20;
      };

      renderParagraph(
        "Problems presented",
        formatProblemsPresentedDisplay(recordData),
        "—"
      );

      // Session Notes Section
      doc.fillColor(0, 0, 0);
      doc.fontSize(12).font('Times-Bold').text("Session Notes:", contentStartX, finalY);
      finalY += 25;

      const notesText = recordData.notes || "No notes available.";
      const estimatedNotesHeight = doc.heightOfString(notesText, {
         width: contentWidth,
         lineGap: 5
      });
      if (finalY + estimatedNotesHeight + 100 > maxContentY) {
         doc.addPage();
         addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
         doc.fillColor(0, 0, 0);
         finalY = contentStartY;
      }
      doc.fontSize(12).font('Times-Roman').text(notesText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
      });
      const notesHeight = doc.heightOfString(notesText, {
         width: contentWidth,
         lineGap: 5
      });
      finalY += notesHeight + 30;

      // Outcome Section
      doc.fillColor(0, 0, 0);
      doc.fontSize(12).font('Times-Bold').text("Outcome of counseling session:", contentStartX, finalY);
      finalY += 25;

      const outcomeText = recordData.outcomes || recordData.outcome || "No outcome recorded.";
      const estimatedOutcomeHeight = doc.heightOfString(outcomeText, {
         width: contentWidth,
         lineGap: 5
      });
      if (finalY + estimatedOutcomeHeight + 100 > maxContentY) {
         doc.addPage();
         addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
         doc.fillColor(0, 0, 0);
         finalY = contentStartY;
      }
      doc.fontSize(12).font('Times-Roman').text(outcomeText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
      });
      const outcomeHeight = doc.heightOfString(outcomeText, {
        width: contentWidth,
        lineGap: 5
      });
      finalY += outcomeHeight + 16;

      renderParagraph("Remarks", recordData.remarks, "—");
      renderParagraph("Administrative recommendation", recordData.recommendation, "—");

      doc.end();

      await new Promise((resolve, reject) => {
         writeStream.on("finish", resolve);
         writeStream.on("error", reject);
      });

      return pdfPath;
};

// Generate a unique tracking number
const generateTrackingNumber = () => {
    return `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};
