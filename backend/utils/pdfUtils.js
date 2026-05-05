import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { formatProblemsPresentedDisplay } from "./problemsPresented.js";
import { resolveRecommendationAuthorName } from "./recommendationAuthor.js";

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

/**
 * Counseling summary report: logo top-left (drawn last so it sits above text), university block
 * centered on full page width, then report title and month / school-year row.
 * Absolute Y where the white header band ends — keep close to actual artwork (no tall empty band).
 * Table `contentStartY` in counselingSummaryPdf = this + a small gap (~7–10 mm).
 */
export const SUMMARY_REPORT_HEADER_HEIGHT_PT = 158;

// Helper to add header/footer (BUKSU letterhead + SWEU / GCS; used by counselor & admin PDFs)
/** @param {{ omitSystemFooter?: boolean; individualGcsReport?: boolean; individualSchoolYear?: string|null; counselingSummaryReport?: boolean; summaryMonthLabel?: string; summarySchoolYear?: string }} [options] — individual report: pass individualSchoolYear for centered header line; summary: pass summaryMonthLabel & summarySchoolYear */
export const addRecordHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate, options = {}) => {
  const mmToPt = (mm) => (mm / 25.4) * 72;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const footerHeight = 92;
  const sidePadding = 36;
  /** Whitespace strip above the letterhead (page background shows through). */
  const headerTopMargin = 14;
  /** Full usable width — text is centered on the page (not in the column beside the logo). */
  const fullTextWidth = pageWidth - 2 * sidePadding;
  const fullTextX = sidePadding;
  void reportDate;

  if (options.counselingSummaryReport) {
    const innerHeaderHeight = SUMMARY_REPORT_HEADER_HEIGHT_PT - headerTopMargin;
    doc.fillColor("#ffffff");
    doc.rect(0, headerTopMargin, pageWidth, innerHeaderHeight).fill();

    const logoSize = 70;
    const logoX = sidePadding;
    const logoY = headerTopMargin + 10;

    /** University copy centered on the page (same box as standard letterhead), not offset by the logo. */
    let colY = logoY;
    doc.font("Times-Bold").fontSize(15).fillColor("#000000");
    const uniTitle = "BUKIDNON STATE UNIVERSITY";
    doc.text(uniTitle, fullTextX, colY, { width: fullTextWidth, align: "center" });
    colY += doc.heightOfString(uniTitle, { width: fullTextWidth }) + mmToPt(2.5);

    doc.font("Times-Roman").fontSize(10).fillColor("#000000");
    const addr = "Fortich Street, Malaybalay City, Bukidnon 8700";
    doc.text(addr, fullTextX, colY, { width: fullTextWidth, align: "center" });
    colY += doc.heightOfString(addr, { width: fullTextWidth }) + mmToPt(1.5);
    const tel = "Tel (088) 813-5661 to 5663; Telefax (088) 813-2717";
    doc.text(tel, fullTextX, colY, { width: fullTextWidth, align: "center" });
    colY += doc.heightOfString(tel, { width: fullTextWidth }) + mmToPt(1.5);

    doc.font("Times-Roman").fontSize(10).fillColor("#1e40af");
    doc.text("www.buksu.edu.ph", fullTextX, colY, {
      width: fullTextWidth,
      align: "center",
      link: "http://www.buksu.edu.ph/",
      underline: true,
    });
    colY += doc.heightOfString("www.buksu.edu.ph", { width: fullTextWidth }) + mmToPt(1);

    const logoPath = getUniversityLogoPath();
    if (logoPath) {
      doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
    } else {
      doc
        .lineWidth(1)
        .strokeColor("#667085")
        .circle(logoX + logoSize / 2, logoY + logoSize / 2, 32)
        .stroke();
      doc
        .font("Times-Bold")
        .fontSize(7)
        .fillColor("#111827")
        .text("BUKSU", logoX, logoY + logoSize * 0.38, { width: logoSize, align: "center" });
    }

    const uniBlockBottom = Math.max(logoY + logoSize, colY);
    let textY = uniBlockBottom + mmToPt(4);

    doc.font("Times-Bold").fontSize(15).fillColor("#000000");
    const reportTitle = "COUNSELING SUMMARY REPORT";
    doc.text(reportTitle, fullTextX, textY, { width: fullTextWidth, align: "center" });
    textY += doc.heightOfString(reportTitle, { width: fullTextWidth }) + mmToPt(4);

    const monthLabel =
      options.summaryMonthLabel != null && String(options.summaryMonthLabel).trim() !== ""
        ? String(options.summaryMonthLabel).trim()
        : "—";
    const schoolYear =
      options.summarySchoolYear != null && String(options.summarySchoolYear).trim() !== ""
        ? String(options.summarySchoolYear).trim()
        : "—";

    const rowBaseline = textY;
    const schoolText = `SCHOOL YEAR: ${schoolYear}`;
    doc.font("Times-Bold").fontSize(10).fillColor("#000000");
    const schoolW = doc.widthOfString(schoolText);
    const schoolLeft = pageWidth - sidePadding - schoolW;

    const monthTitle = "FOR THE MONTH OF";
    doc.text(monthTitle, sidePadding, rowBaseline, { lineBreak: false });
    const afterTitleX = sidePadding + doc.widthOfString(monthTitle);
    doc.text(" ", afterTitleX, rowBaseline, { lineBreak: false });
    const fieldStartX = afterTitleX + doc.widthOfString(" ");

    doc.text(monthLabel, fieldStartX, rowBaseline, { lineBreak: false });
    const monthValueW = doc.widthOfString(monthLabel);
    /** Underline only under the month value, width ≈ text (slightly inset), 2–3 mm below baseline. */
    const valueLineInsetPt = 0.75;
    const valueLineStartX = fieldStartX + valueLineInsetPt * 0.5;
    const valueLineEndX = fieldStartX + Math.max(2, monthValueW - valueLineInsetPt);
    const lineY = rowBaseline + mmToPt(2.5);
    doc.strokeColor("#000000").lineWidth(0.55);
    if (valueLineEndX > valueLineStartX + 1) {
      doc.moveTo(valueLineStartX, lineY).lineTo(valueLineEndX, lineY).stroke();
    }

    doc.text(schoolText, schoolLeft, rowBaseline, { lineBreak: false });

    if (!options.omitSystemFooter) {
      const footerY = pageHeight - footerHeight;
      doc.fillColor("#667eea");
      doc.rect(0, footerY, pageWidth, footerHeight).fill();
      doc.fillColor("#ffffff");

      doc
        .fontSize(8)
        .font("Times-Roman")
        .text("CONFIDENTIAL - Sensitive information protected by confidentiality policy.", sidePadding, footerY + 10, {
          align: "center",
          width: pageWidth - sidePadding * 2,
          lineBreak: true,
        });

      doc.fontSize(7).fillColor("#ffffff");
      doc.text("Counseling Services Management System", sidePadding, footerY + 34, {
        width: pageWidth - sidePadding * 2,
        align: "center",
        lineBreak: true,
      });

      doc.fontSize(6.5).fillColor("#ffffff");
      doc.text(`Page ${pageNum} of ${totalPages} | Tracking: ${trackingNumber}`, sidePadding, footerY + 48, {
        width: pageWidth - sidePadding * 2,
        align: "center",
        lineBreak: true,
      });

      doc.fontSize(6).fillColor("#ffffff");
      doc.text(
        "For inquiries, contact your system administrator. This report is generated electronically.",
        sidePadding,
        footerY + 63,
        {
          align: "center",
          width: pageWidth - sidePadding * 2,
          lineBreak: true,
        }
      );
    }

    doc.fillColor(0, 0, 0);
    return;
  }

  const headerHeight = RECORD_PDF_HEADER_HEIGHT_PT;
  const innerHeaderHeight = headerHeight - headerTopMargin;
  const y0 = headerTopMargin;
  const logoSize = 70;
  const logoX = sidePadding;
  const logoY = y0 + 12;

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

  if (!options.individualGcsReport) {
    doc.strokeColor('#000000').lineWidth(0.75);
    doc.moveTo(sidePadding, textY).lineTo(pageWidth - sidePadding, textY).stroke();
    textY += 10;
  } else {
    textY += mmToPt(9);
  }

  if (options.individualGcsReport) {
    doc.fillColor('#000000').font('Times-Bold').fontSize(14);
    doc.text('INDIVIDUAL COUNSELING REPORT', fullTextX, textY, {
      width: fullTextWidth,
      align: 'center',
    });
    const titleH = doc.heightOfString('INDIVIDUAL COUNSELING REPORT', { width: fullTextWidth });
    textY += titleH + mmToPt(7);
    const syRaw = options.individualSchoolYear;
    const sy =
      syRaw != null && String(syRaw).trim() !== '' ? String(syRaw).trim() : '—';
    const schoolLine = `SCHOOL YEAR: ${sy}`;
    doc.font('Times-Bold').fontSize(11);
    doc.text(schoolLine, fullTextX, textY, {
      width: fullTextWidth,
      align: 'center',
    });
    textY += doc.heightOfString(schoolLine, { width: fullTextWidth });
  } else {
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
  }

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

  if (!options.omitSystemFooter) {
    // Footer - Blue background (bulk / system reports only)
    const footerY = pageHeight - footerHeight;
    doc.fillColor("#667eea");
    doc.rect(0, footerY, pageWidth, footerHeight).fill();
    doc.fillColor("#ffffff");

    doc
      .fontSize(8)
      .font("Times-Roman")
      .text("CONFIDENTIAL - Sensitive information protected by confidentiality policy.", sidePadding, footerY + 10, {
        align: "center",
        width: pageWidth - sidePadding * 2,
        lineBreak: true,
      });

    doc.fontSize(7).fillColor("#ffffff");
    doc.text("Counseling Services Management System", sidePadding, footerY + 34, {
      width: pageWidth - sidePadding * 2,
      align: "center",
      lineBreak: true,
    });

    doc.fontSize(6.5).fillColor("#ffffff");
    doc.text(`Page ${pageNum} of ${totalPages} | Tracking: ${trackingNumber}`, sidePadding, footerY + 48, {
      width: pageWidth - sidePadding * 2,
      align: "center",
      lineBreak: true,
    });

    doc.fontSize(6).fillColor("#ffffff");
    doc.text(
      "For inquiries, contact your system administrator. This report is generated electronically.",
      sidePadding,
      footerY + 63,
      {
        align: "center",
        width: pageWidth - sidePadding * 2,
        lineBreak: true,
      }
    );
  }

  doc.fillColor(0, 0, 0);
};

/** GCS-F-004 form strip at bottom of page (when system blue footer is omitted) */
const drawIndividualFormGcsStrip = (doc, pageNum, totalPages) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const sidePadding = 36;
  const y = pageHeight - 28;
  doc.font("Times-Roman").fontSize(7.5).fillColor("#000000");
  doc.text(`Document Code: GCS-F-004`, sidePadding, y);
  doc.text(`Revision No: 04`, sidePadding + 148, y);
  doc.text(`Issue Date: February 18, 2025`, sidePadding + 248, y);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - sidePadding - 80, y, {
    width: 80,
    align: "right",
  });
};

const combineCourseYearSection = (recordData) => {
  const parts = [recordData.course, recordData.yearLevel, recordData.section].filter(
    (p) => p != null && String(p).trim() !== ""
  );
  return parts.length ? parts.map((p) => String(p).trim()).join(" / ") : "—";
};

// Function to generate a counseling record PDF (GCS-F-004 Individual Counseling Report layout)
export const generateCounselingRecordPDF = async (recordData, sanitizedCounselorName) => {
  const trackingNumber = generateTrackingNumber();

  const tempDir = path.join(process.cwd(), "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const pdfPath = path.join(
    tempDir,
    `${sanitizedCounselorName}_${recordData.clientName.replace(/\s+/g, "_")}_${trackingNumber}.pdf`
  );

  const doc = new PDFDocument({
    margin: 0,
    size: "A4",
    bufferPages: true,
  });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginBottom = 72;
  const marginLeft = 72;
  const marginRight = 72;
  const headerHeight = RECORD_PDF_HEADER_HEIGHT_PT;
  /** Bottom margin for GCS strip only (no blue system footer on this form) */
  const bottomReservePt = 40;
  const contentStartX = marginLeft;
  const contentWidth = pageWidth - marginLeft - marginRight;
  /** Body starts under letterhead; title is drawn in-header (individualGcsReport), not here */
  const contentStartY = headerHeight + 18;
  const maxContentY = pageHeight - marginBottom - bottomReservePt;
  const reportDate = recordData.date
    ? new Date(recordData.date).toLocaleDateString()
    : new Date().toLocaleDateString();

  doc.fillColor(0, 0, 0);
  let finalY = contentStartY + 8;

  const STUDENT_LABEL_W = 148;
  const STUDENT_ROW_H = 20;
  const SECTION_GAP = 16;
  const BLOCK_AFTER_BODY = 18;

  const ensureSpace = (neededPt) => {
    if (finalY + neededPt > maxContentY) {
      doc.addPage();
      finalY = contentStartY;
    }
  };

  const fieldRow = (label, value) => {
    ensureSpace(STUDENT_ROW_H + 4);
    const v = value != null && String(value).trim() !== "" ? String(value) : "—";
    doc.fontSize(11).font("Times-Bold").text(label, contentStartX, finalY);
    doc.font("Times-Roman").fontSize(11).text(v, contentStartX + STUDENT_LABEL_W, finalY, {
      width: contentWidth - STUDENT_LABEL_W,
      lineGap: 2,
    });
    finalY += STUDENT_ROW_H;
  };

  fieldRow("Name of Student:", recordData.clientName);
  fieldRow("Course/Year/Section:", combineCourseYearSection(recordData));
  fieldRow(
    "Date:",
    recordData.date
      ? new Date(recordData.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—"
  );
  fieldRow(
    "Session No.:",
    recordData.sessionNumber != null && recordData.sessionNumber !== ""
      ? String(recordData.sessionNumber)
      : "—"
  );

  finalY += SECTION_GAP;

  const problemsCore = formatProblemsPresentedDisplay(recordData);
  const notesRaw = recordData.notes && String(recordData.notes).trim();
  const problemsBody =
    problemsCore && problemsCore !== "—"
      ? problemsCore + (notesRaw ? `\n\n${notesRaw}` : "")
      : notesRaw || "—";

  const bodyBlock = (heading, text, emptyFallback) => {
    const body = text && String(text).trim() ? String(text).trim() : emptyFallback;
    ensureSpace(32);
    doc.font("Times-Bold").fontSize(12).fillColor(0, 0, 0).text(heading, contentStartX, finalY);
    finalY += 14;
    const h = doc.heightOfString(body, { width: contentWidth, lineGap: 5 });
    ensureSpace(h + 12);
    doc.font("Times-Roman").fontSize(11).text(body, contentStartX, finalY, {
      width: contentWidth,
      lineGap: 5,
    });
    finalY += h + BLOCK_AFTER_BODY;
  };

  bodyBlock("Problem/s presented:", problemsBody, "—");
  bodyBlock(
    "Outcome of Counseling Session:",
    recordData.outcomes || recordData.outcome,
    "—"
  );
  bodyBlock("Remarks:", recordData.remarks, "—");

  /** Underline ~35–40% of page width, right-aligned; tight name→rule and label stack (points). */
  const SIG_LINE_PAGE_RATIO = 0.375;
  const mmToPt = (mm) => (mm / 25.4) * 72;
  /** ~2.5mm gaps between name, rule, and first label (within 2–3mm). */
  const sigNameToRulePt = mmToPt(2.5);
  const sigLineToLabelPt = mmToPt(2.5);
  const sigLabelGapPt = mmToPt(2);
  const sigBlockTailPt = mmToPt(5);

  const drawRightMarginSignatureBlock = (displayName, roleLine2) => {
    const lineW = pageWidth * SIG_LINE_PAGE_RATIO;
    const lineRight = pageWidth - marginRight;
    const lineLeft = lineRight - lineW;

    ensureSpace(48);
    finalY += mmToPt(2);

    const nameDisplay =
      displayName != null && String(displayName).trim() ? String(displayName).trim() : "";
    doc.fillColor(0, 0, 0);
    if (nameDisplay) {
      doc.font("Times-Italic").fontSize(10);
      const nh = doc.heightOfString(nameDisplay, { width: lineW, lineGap: 2 });
      ensureSpace(nh + 32);
      doc.text(nameDisplay, lineLeft, finalY, { width: lineW, align: "center", lineGap: 2 });
      finalY += nh;
    } else {
      ensureSpace(26);
    }

    finalY += sigNameToRulePt;

    doc.strokeColor("#000000").lineWidth(0.5);
    doc.moveTo(lineLeft, finalY).lineTo(lineRight, finalY).stroke();
    finalY += sigLineToLabelPt;

    const label1 = "Name and Signature";
    doc.font("Times-Roman").fontSize(9).text(label1, lineLeft, finalY, {
      width: lineW,
      align: "center",
    });
    const hLabel1 = doc.heightOfString(label1, { width: lineW });
    finalY += hLabel1 + sigLabelGapPt;
    doc.text(roleLine2, lineLeft, finalY, {
      width: lineW,
      align: "center",
    });
    const hLabel2 = doc.heightOfString(roleLine2, { width: lineW });
    finalY += hLabel2 + sigBlockTailPt;
  };

  drawRightMarginSignatureBlock(
    recordData.counselor || sanitizedCounselorName || "—",
    "Guidance Designate/Counselor"
  );

  const recText =
    recordData.recommendation && String(recordData.recommendation).trim()
      ? String(recordData.recommendation).trim()
      : "(To be accomplished by the Director, SWEU.)";
  bodyBlock("Recommendation:", recText, "(To be accomplished by the Director, SWEU.)");

  const recommendationSignerName = resolveRecommendationAuthorName(recordData);
  drawRightMarginSignatureBlock(recommendationSignerName, "Director, SWEU");

  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    addRecordHeaderFooter(doc, i + 1, total, trackingNumber, reportDate, {
      omitSystemFooter: true,
      individualGcsReport: true,
      individualSchoolYear: recordData.schoolYear,
    });
    drawIndividualFormGcsStrip(doc, i + 1, total);
  }

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
