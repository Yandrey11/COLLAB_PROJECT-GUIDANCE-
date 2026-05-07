import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { formatProblemsPresentedDisplay } from "./problemsPresented.js";
import { resolveRecommendationAuthorName } from "./recommendationAuthor.js";

const mmToPt = (mm) => (mm / 25.4) * 72;

/** Max logo width (pt) on summary letterhead — height scales with aspect ratio. */
const BS_SUMMARY_LOGO_MAX_W_PT = 50;
const BS_SUMMARY_MARGIN_X_PT = 36;
const BS_SUMMARY_MARGIN_TOP_PT = 22;
const BS_HEADER_LOGO_GAP_PT = 14;
const BS_HEADER_TEXT_TARGET_W_PT = 360;

/**
 * Compact BSU letterhead for Counseling Summary Report (no colored banner).
 * @returns Y position (pt) where body content should begin.
 */
export function drawBsCounselingSummaryLetterhead(doc, opts) {
  const pageWidth = doc.page.width;
  const {
    monthLabel = "—",
    schoolYear = "—",
    firstPage = true,
  } = opts;

  const monthUpper = String(monthLabel).trim().toUpperCase();
  const schoolUpper = String(schoolYear).trim().toUpperCase();
  const monthText = `FOR THE MONTH OF ${monthUpper}`;
  const schoolText = `SCHOOL YEAR: ${schoolUpper}`;
  const innerW = pageWidth - 2 * BS_SUMMARY_MARGIN_X_PT;
  const half = innerW / 2;
  const lineTight = 1.5;

  const drawMetaRow = (yStart) => {
    let y = yStart;
    doc.fillColor("#000000");
    doc.font("Times-Roman").fontSize(9);
    doc.text(monthText, BS_SUMMARY_MARGIN_X_PT, y, { width: half - 8, align: "left" });
    doc.text(schoolText, BS_SUMMARY_MARGIN_X_PT + half + 8, y, { width: half - 8, align: "right" });
    const metaH = Math.max(
      doc.heightOfString(monthText, { width: half - 8 }),
      doc.heightOfString(schoolText, { width: half - 8 })
    );
    // Space below month / school year row (no divider line — keep a single compact gap before the table)
    y += metaH + mmToPt(2);
    doc.fillColor("#000000");
    return y;
  };

  if (!firstPage) {
    let y = BS_SUMMARY_MARGIN_TOP_PT;
    doc.fillColor("#000000");
    doc.font("Times-Bold").fontSize(11);
    doc.text("COUNSELING SUMMARY REPORT", 0, y, { width: pageWidth, align: "center" });
    y += doc.currentLineHeight() + mmToPt(1.5);
    return drawMetaRow(y);
  }

  let y = BS_SUMMARY_MARGIN_TOP_PT;
  const logoPath = path.join(process.cwd(), "assets", "buksu-logo.png");
  const hasLogo = fs.existsSync(logoPath);
  let logoH = 0;
  if (hasLogo) {
    try {
      const img = doc.openImage(logoPath);
      logoH = img.height * (BS_SUMMARY_LOGO_MAX_W_PT / img.width);
    } catch {
      logoH = 0;
    }
  }

  const logoW = hasLogo && logoH > 0 ? BS_SUMMARY_LOGO_MAX_W_PT : 0;
  const maxTextW = pageWidth - 2 * BS_SUMMARY_MARGIN_X_PT;
  const textW = Math.min(BS_HEADER_TEXT_TARGET_W_PT, maxTextW);
  const textX = (pageWidth - textW) / 2;
  const logoX = hasLogo && logoW > 0
    ? Math.max(BS_SUMMARY_MARGIN_X_PT, textX - BS_HEADER_LOGO_GAP_PT - logoW)
    : BS_SUMMARY_MARGIN_X_PT;

  const addr = "Fortich Street, Malaybalay City, Bukidnon 8700";
  const tel = "Tel (088) 813-5661 to 5663; Telefax (088) 813-2717";
  const web = "www.buksu.edu.ph";

  doc.font("Times-Bold").fontSize(10.5);
  const hUni = doc.heightOfString("BUKIDNON STATE UNIVERSITY", { width: textW, align: "center" });
  doc.font("Times-Roman").fontSize(8.5);
  const hAddr = doc.heightOfString(addr, { width: textW, align: "center" });
  const hTel = doc.heightOfString(tel, { width: textW, align: "center" });
  const hWeb = doc.heightOfString(web, { width: textW, align: "center", underline: true });
  const textBlockH = hUni + lineTight + hAddr + lineTight + hTel + lineTight + hWeb;
  const rowH = Math.max(textBlockH, logoH);
  const textTop = y + (rowH - textBlockH) / 2;
  const logoTop = y + (rowH - logoH) / 2;

  if (hasLogo && logoH > 0) {
    try {
      doc.image(logoPath, logoX, logoTop, { width: BS_SUMMARY_LOGO_MAX_W_PT });
    } catch {
      // Keep rendering text even if logo fails.
    }
  }

  let yText = textTop;
  doc.fillColor("#000000");
  doc.font("Times-Bold").fontSize(10.5);
  doc.text("BUKIDNON STATE UNIVERSITY", textX, yText, { width: textW, align: "center" });
  yText += hUni + lineTight;

  doc.font("Times-Roman").fontSize(8.5);
  doc.text(addr, textX, yText, { width: textW, align: "center" });
  yText += hAddr + lineTight;

  doc.text(tel, textX, yText, { width: textW, align: "center" });
  yText += hTel + lineTight;

  doc.fillColor("#0000EE");
  doc.fontSize(8.5);
  doc.text(web, textX, yText, {
    width: textW,
    align: "center",
    link: "https://www.buksu.edu.ph/",
    underline: true,
  });

  const afterUni = y + rowH + mmToPt(4);

  y = afterUni;
  doc.fillColor("#000000");
  doc.font("Times-Bold").fontSize(11);
  doc.text("COUNSELING SUMMARY REPORT", 0, y, { width: pageWidth, align: "center" });
  y += doc.currentLineHeight() + mmToPt(1.5);
  return drawMetaRow(y);
}

/** Accurate body top (pt) for a given page type — uses PDFKit layout matching `drawBsCounselingSummaryLetterhead`. */
export function measureBsCounselingSummaryContentStart(opts) {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  return drawBsCounselingSummaryLetterhead(doc, opts);
}

/** Default banner title for per-record (counselor) PDF downloads. */
export const INDIVIDUAL_COUNSELING_REPORT_TITLE = "INDIVIDUAL COUNSELING REPORT";

/** Form footer strip — Individual Counseling Report (GCS-F-004). */
export const INDIVIDUAL_REPORT_FORM = {
  DOC_CODE: "GCS-F-004",
  REVISION: "04",
  ISSUE_DATE: "February 18, 2025",
};

/**
 * BSU letterhead for Individual Counseling Report: logo + university block, title, school year.
 * @returns Y (pt) where body content should begin.
 */
export function drawBsIndividualCounselingLetterhead(doc, opts = {}) {
  const pageWidth = doc.page.width;
  const {
    schoolYear = "—",
    reportTitle = INDIVIDUAL_COUNSELING_REPORT_TITLE,
    firstPage = true,
  } = opts;

  const rawSchool = String(schoolYear ?? "").trim();
  const schoolUpper = rawSchool ? rawSchool.toUpperCase() : "—";
  const lineTight = 1.5;

  const finishTitleBlock = (yStart) => {
    let y = yStart;
    doc.fillColor("#000000");
    doc.font("Times-Bold").fontSize(11);
    doc.text(reportTitle, 0, y, { width: pageWidth, align: "center" });
    y += doc.currentLineHeight() + mmToPt(1);
    doc.font("Times-Bold").fontSize(10);
    doc.text(`SCHOOL YEAR: ${schoolUpper}`, 0, y, { width: pageWidth, align: "center" });
    y += doc.currentLineHeight() + mmToPt(2);
    doc.fillColor("#000000");
    return y;
  };

  if (!firstPage) {
    return finishTitleBlock(BS_SUMMARY_MARGIN_TOP_PT);
  }

  let y = BS_SUMMARY_MARGIN_TOP_PT;
  const logoPath = path.join(process.cwd(), "assets", "buksu-logo.png");
  const hasLogo = fs.existsSync(logoPath);
  let logoH = 0;
  if (hasLogo) {
    try {
      const img = doc.openImage(logoPath);
      logoH = img.height * (BS_SUMMARY_LOGO_MAX_W_PT / img.width);
    } catch {
      logoH = 0;
    }
  }

  const logoW = hasLogo && logoH > 0 ? BS_SUMMARY_LOGO_MAX_W_PT : 0;
  const maxTextW = pageWidth - 2 * BS_SUMMARY_MARGIN_X_PT;
  const textW = Math.min(BS_HEADER_TEXT_TARGET_W_PT, maxTextW);
  const textX = (pageWidth - textW) / 2;
  const logoX = hasLogo && logoW > 0
    ? Math.max(BS_SUMMARY_MARGIN_X_PT, textX - BS_HEADER_LOGO_GAP_PT - logoW)
    : BS_SUMMARY_MARGIN_X_PT;

  const addr = "Fortich Street, Malaybalay City, Bukidnon 8700";
  const tel = "Tel (088) 813-5661 to 5663; Telefax (088) 813-2717";
  const web = "www.buksu.edu.ph";

  doc.font("Times-Bold").fontSize(10.5);
  const hUni = doc.heightOfString("BUKIDNON STATE UNIVERSITY", { width: textW, align: "center" });
  doc.font("Times-Roman").fontSize(8.5);
  const hAddr = doc.heightOfString(addr, { width: textW, align: "center" });
  const hTel = doc.heightOfString(tel, { width: textW, align: "center" });
  const hWeb = doc.heightOfString(web, { width: textW, align: "center", underline: true });
  const textBlockH = hUni + lineTight + hAddr + lineTight + hTel + lineTight + hWeb;
  const rowH = Math.max(textBlockH, logoH);
  const textTop = y + (rowH - textBlockH) / 2;
  const logoTop = y + (rowH - logoH) / 2;

  if (hasLogo && logoH > 0) {
    try {
      doc.image(logoPath, logoX, logoTop, { width: BS_SUMMARY_LOGO_MAX_W_PT });
    } catch {
      // Keep rendering text even if logo fails.
    }
  }

  let yText = textTop;
  doc.fillColor("#000000");
  doc.font("Times-Bold").fontSize(10.5);
  doc.text("BUKIDNON STATE UNIVERSITY", textX, yText, { width: textW, align: "center" });
  yText += hUni + lineTight;

  doc.font("Times-Roman").fontSize(8.5);
  doc.text(addr, textX, yText, { width: textW, align: "center" });
  yText += hAddr + lineTight;

  doc.text(tel, textX, yText, { width: textW, align: "center" });
  yText += hTel + lineTight;

  doc.fillColor("#0000EE");
  doc.fontSize(8.5);
  doc.text(web, textX, yText, {
    width: textW,
    align: "center",
    link: "https://www.buksu.edu.ph/",
    underline: true,
  });

  const afterUni = y + rowH + mmToPt(4);
  return finishTitleBlock(afterUni);
}

function drawIndividualFormFooterStrip(doc, pageNum, totalPages) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const sidePadding = BS_SUMMARY_MARGIN_X_PT;
  const innerW = pageWidth - 2 * sidePadding;
  const cells = [
    `Document Code: ${INDIVIDUAL_REPORT_FORM.DOC_CODE}`,
    `Revision No: ${INDIVIDUAL_REPORT_FORM.REVISION}`,
    `Issue Date: ${INDIVIDUAL_REPORT_FORM.ISSUE_DATE}`,
    `Page ${pageNum} of ${totalPages}`,
  ];
  const slotW = innerW / cells.length;
  const y = pageHeight - mmToPt(10);
  doc.font("Times-Roman").fontSize(7).fillColor("#000000");
  let x = sidePadding;
  for (const c of cells) {
    doc.text(c, x, y, { width: slotW, align: "center" });
    x += slotW;
  }
}

function buildCourseYearSectionLine(recordData) {
  const parts = [
    recordData.course != null && String(recordData.course).trim() ? String(recordData.course).trim() : "",
    recordData.yearLevel != null && String(recordData.yearLevel).trim() ? String(recordData.yearLevel).trim() : "",
    recordData.section != null && String(recordData.section).trim() ? String(recordData.section).trim() : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

function problemsNarrativeForIndividual(recordData) {
  let problemsText = formatProblemsPresentedDisplay(recordData);
  const extraNotes =
    recordData.notes != null && String(recordData.notes).trim() ? String(recordData.notes).trim() : "";
  if (extraNotes) {
    if (!problemsText || problemsText === "—") problemsText = extraNotes;
    else problemsText = `${problemsText}\n\n${extraNotes}`;
  }
  if (!problemsText || problemsText === "—") return "—";
  return problemsText;
}

const SIG_BLOCK_W = 200;
const SIG_LINE_PAD = 14;
const SIG_NAME_TO_RULE = mmToPt(2);
const SIG_RULE_TO_LABELS = mmToPt(2.5);

function counselorSignatureBlockMeasuredHeight(doc, counselorName) {
  const blockW = SIG_BLOCK_W;
  const name = String(counselorName || "").trim() || "—";
  doc.font("Times-Italic").fontSize(10);
  let h = doc.heightOfString(name, { width: blockW, lineGap: 1 }) + SIG_NAME_TO_RULE;
  h += SIG_RULE_TO_LABELS;
  doc.font("Times-Roman").fontSize(9);
  h += doc.currentLineHeight() + 2 + doc.currentLineHeight();
  return h + mmToPt(3);
}

function directorSignatureBlockMeasuredHeight(doc, directorName) {
  const blockW = SIG_BLOCK_W;
  const name = String(directorName || "").trim();
  let h = 0;
  if (name) {
    doc.font("Times-Italic").fontSize(10);
    h += doc.heightOfString(name, { width: blockW, lineGap: 1 }) + SIG_NAME_TO_RULE;
  } else {
    h += SIG_NAME_TO_RULE;
  }
  h += SIG_RULE_TO_LABELS;
  doc.font("Times-Roman").fontSize(9);
  h += doc.currentLineHeight() + 2 + doc.currentLineHeight();
  return h + mmToPt(3);
}

function drawIndividualCounselorSignatureBlock(doc, counselorName, margin, pageWidth, startY) {
  const blockW = SIG_BLOCK_W;
  const x = pageWidth - margin - blockW;
  let cy = startY;
  const name = String(counselorName || "").trim() || "—";

  doc.fillColor("#000000");
  doc.font("Times-Italic").fontSize(10);
  doc.text(name, x, cy, { width: blockW, align: "center" });
  cy += doc.heightOfString(name, { width: blockW, lineGap: 1 }) + SIG_NAME_TO_RULE;

  doc.strokeColor("#000000").lineWidth(0.75);
  doc.moveTo(x + SIG_LINE_PAD, cy).lineTo(x + blockW - SIG_LINE_PAD, cy).stroke();
  cy += SIG_RULE_TO_LABELS;

  doc.font("Times-Roman").fontSize(9);
  doc.text("Name and Signature", x, cy, { width: blockW, align: "center" });
  cy += doc.currentLineHeight() + 2;
  doc.text("Guidance Designate/Counselor", x, cy, { width: blockW, align: "center" });
  return cy + mmToPt(3);
}

function drawIndividualDirectorSignatureBlock(doc, directorName, margin, pageWidth, startY) {
  const blockW = SIG_BLOCK_W;
  const x = pageWidth - margin - blockW;
  let cy = startY;
  const name = String(directorName || "").trim();

  doc.fillColor("#000000");
  if (name) {
    doc.font("Times-Italic").fontSize(10);
    doc.text(name, x, cy, { width: blockW, align: "center" });
    cy += doc.heightOfString(name, { width: blockW, lineGap: 1 }) + SIG_NAME_TO_RULE;
  } else {
    cy += SIG_NAME_TO_RULE;
  }

  doc.strokeColor("#000000").lineWidth(0.75);
  doc.moveTo(x + SIG_LINE_PAD, cy).lineTo(x + blockW - SIG_LINE_PAD, cy).stroke();
  cy += SIG_RULE_TO_LABELS;

  doc.font("Times-Roman").fontSize(9);
  doc.text("Name and Signature", x, cy, { width: blockW, align: "center" });
  cy += doc.currentLineHeight() + 2;
  doc.text("Director, SWEU", x, cy, { width: blockW, align: "center" });
  return cy + mmToPt(3);
}

// Helper to add header/footer (admin / legacy synthesized PDF — blue banner)
export const addRecordHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate, opts = {}) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const headerHeight = 68;
  const footerHeight = 92;
  const sidePadding = 14;

  const headline =
    opts.title != null && String(opts.title).trim() !== ""
      ? String(opts.title)
      : INDIVIDUAL_COUNSELING_REPORT_TITLE;

  // Header - Blue background
  doc.fillColor('#667eea');
  doc.rect(0, 0, pageWidth, headerHeight).fill();
  doc.fillColor('#ffffff');
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .text(headline, 0, 10, { width: pageWidth, align: 'center' });
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#ffffff');
  const trackingText = `Document Tracking: ${trackingNumber}`;
  const dateText = `Date: ${reportDate}`;
  const columnY = 47;
  const leftColumnX = sidePadding;
  const leftColumnWidth = Math.floor(pageWidth / 2) - sidePadding;
  const rightColumnX = Math.floor(pageWidth / 2);
  const rightColumnWidth = Math.floor(pageWidth / 2) - sidePadding;
  doc.text(trackingText, leftColumnX, columnY, { width: leftColumnWidth, align: 'left', lineBreak: false });
  doc.text(dateText, rightColumnX, columnY, { width: rightColumnWidth, align: 'right', lineBreak: false });

  if (opts.omitSystemFooter) {
    doc.fillColor(0, 0, 0);
    return;
  }

  // Footer - Blue background
  const footerY = pageHeight - footerHeight;
  doc.fillColor('#667eea');
  doc.rect(0, footerY, pageWidth, footerHeight).fill();
  doc.fillColor('#ffffff');

  // Footer rows use centered lines with safe lengths to avoid clipping.
  // Line 1: Confidential notice
  doc.fontSize(8)
     .font('Helvetica')
     .text("CONFIDENTIAL - Sensitive information protected by confidentiality policy.", sidePadding, footerY + 10, { align: 'center', width: pageWidth - sidePadding * 2 });

  // Line 3: System name
  doc.fontSize(7)
     .fillColor('#ffffff');
  doc.text("Counseling Services Management System", sidePadding, footerY + 34, { width: pageWidth - sidePadding * 2, align: 'center' });

  // Line 4: Page and tracking
  doc.fontSize(7)
     .fillColor('#ffffff');
  doc.text(`Page ${pageNum} of ${totalPages} | Tracking: ${trackingNumber}`, sidePadding, footerY + 48, { width: pageWidth - sidePadding * 2, align: 'center' });

  // Line 5: footer note
  doc.fontSize(6)
     .fillColor('#ffffff');
  doc.text("For inquiries, contact your system administrator. This report is generated electronically.", sidePadding, footerY + 63, { align: 'center', width: pageWidth - sidePadding * 2 });

  doc.fillColor(0, 0, 0);
};

async function generateLegacyAdminCounselingPdf(recordData, sanitizedCounselorName, options = {}) {
  const trackingNumber = generateTrackingNumber();
  const reportTitle =
    options.headerTitle != null && String(options.headerTitle).trim() !== ""
      ? String(options.headerTitle).trim()
      : INDIVIDUAL_COUNSELING_REPORT_TITLE;

  const tempDir = path.join(process.cwd(), "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const pdfPath = path.join(
    tempDir,
    `${sanitizedCounselorName}_${recordData.clientName.replace(/\s+/g, "_")}_${trackingNumber}.pdf`
  );

  const doc = new PDFDocument({
    margin: 0,
    size: "A4",
  });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginBottom = 72;
  const marginLeft = 54;
  const marginRight = 54;
  const footerHeight = 48;
  const contentStartX = marginLeft;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const schoolYearVal =
    recordData.schoolYear != null && String(recordData.schoolYear).trim()
      ? String(recordData.schoolYear).trim()
      : "—";
  const letterheadOptsBase = { schoolYear: schoolYearVal, reportTitle };
  let contentStartY = drawBsIndividualCounselingLetterhead(doc, { ...letterheadOptsBase, firstPage: true });

  doc.fillColor(0, 0, 0);

  let finalY = contentStartY;

  doc.strokeColor(200, 200, 200).lineWidth(1).moveTo(contentStartX, finalY + 4).lineTo(contentStartX + contentWidth, finalY + 4).stroke();
  finalY += 24;

  const labelWidth = 130;
  const valueStartX = contentStartX + labelWidth;

  doc.fontSize(11).font("Helvetica-Bold").fillColor(0, 0, 0);
  doc.text("Client Name:", contentStartX, finalY);
  doc.font("Helvetica").text(String(recordData.clientName || "N/A"), valueStartX, finalY);
  finalY += 22;

  doc.font("Helvetica-Bold").text("Date:", contentStartX, finalY);
  doc
    .font("Helvetica")
    .text(
      recordData.date
        ? new Date(recordData.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A",
      valueStartX,
      finalY
    );
  finalY += 22;

  if (recordData.sessionNumber) {
    doc.font("Helvetica-Bold").text("Session Number:", contentStartX, finalY);
    doc.font("Helvetica").text(String(recordData.sessionNumber), valueStartX, finalY);
    finalY += 22;
  }

  doc.font("Helvetica-Bold").text("Session Type:", contentStartX, finalY);
  doc.font("Helvetica").text(String(recordData.sessionType || "N/A"), valueStartX, finalY);
  finalY += 22;

  doc.font("Helvetica-Bold").text("Status:", contentStartX, finalY);
  doc.font("Helvetica").text(String(recordData.status || "N/A"), valueStartX, finalY);
  finalY += 22;

  doc.font("Helvetica-Bold").text("Counselor:", contentStartX, finalY);
  doc.font("Helvetica").text(String(recordData.counselor || sanitizedCounselorName), valueStartX, finalY);
  finalY += 30;

  doc.fillColor(0, 0, 0);
  doc.fontSize(14).font("Helvetica-Bold").text("Session Notes:", contentStartX, finalY);
  finalY += 25;

  const notesText = recordData.notes || "No notes available.";
  const estimatedNotesHeight = doc.heightOfString(notesText, {
    width: contentWidth,
    lineGap: 5,
  });
  const maxContentY = pageHeight - marginBottom - footerHeight - 80;
  if (finalY + estimatedNotesHeight + 100 > maxContentY) {
    doc.addPage();
    contentStartY = drawBsIndividualCounselingLetterhead(doc, { ...letterheadOptsBase, firstPage: false });
    doc.fillColor(0, 0, 0);
    finalY = contentStartY;
  }
  doc.fontSize(11).font("Helvetica").text(notesText, contentStartX, finalY, {
    width: contentWidth,
    align: "left",
    lineGap: 5,
  });
  const notesHeight = doc.heightOfString(notesText, {
    width: contentWidth,
    lineGap: 5,
  });
  finalY += notesHeight + 30;

  doc.fillColor(0, 0, 0);
  doc.fontSize(14).font("Helvetica-Bold").text("Outcomes:", contentStartX, finalY);
  finalY += 25;

  const outcomeText = recordData.outcomes || recordData.outcome || "No outcome recorded.";
  const estimatedOutcomeHeight = doc.heightOfString(outcomeText, {
    width: contentWidth,
    lineGap: 5,
  });
  if (finalY + estimatedOutcomeHeight + 100 > maxContentY) {
    doc.addPage();
    contentStartY = drawBsIndividualCounselingLetterhead(doc, { ...letterheadOptsBase, firstPage: false });
    doc.fillColor(0, 0, 0);
    finalY = contentStartY;
  }
  doc.fontSize(11).font("Helvetica").text(outcomeText, contentStartX, finalY, {
    width: contentWidth,
    align: "left",
    lineGap: 5,
  });

  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    drawIndividualFormFooterStrip(doc, i + 1, total);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return pdfPath;
}

async function generateIndividualBsCounselingPdf(recordData, sanitizedCounselorName, options = {}) {
  const reportTitle =
    options.headerTitle != null && String(options.headerTitle).trim() !== ""
      ? String(options.headerTitle).trim()
      : INDIVIDUAL_COUNSELING_REPORT_TITLE;

  const tempDir = path.join(process.cwd(), "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const trackingNumber = generateTrackingNumber();
  const pdfPath = path.join(
    tempDir,
    `${sanitizedCounselorName}_${String(recordData.clientName || "record").replace(/\s+/g, "_")}_${trackingNumber}.pdf`
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
  const margin = BS_SUMMARY_MARGIN_X_PT;
  const contentW = pageWidth - 2 * margin;
  const FOOTER_RESERVE = 48;
  const maxY = pageHeight - FOOTER_RESERVE;

  const schoolYearVal =
    recordData.schoolYear != null && String(recordData.schoolYear).trim()
      ? String(recordData.schoolYear).trim()
      : "—";

  const letterheadOptsBase = { schoolYear: schoolYearVal, reportTitle };

  let y = drawBsIndividualCounselingLetterhead(doc, { ...letterheadOptsBase, firstPage: true });

  const LABEL_COL = 148;
  const ROW_MIN = 16;
  const SECTION_GAP = mmToPt(2);
  const bodyLineGap = 2;

  const ensurePage = (neededBelowY) => {
    if (y + neededBelowY <= maxY) return;
    doc.addPage();
    y = drawBsIndividualCounselingLetterhead(doc, { ...letterheadOptsBase, firstPage: false });
  };

  const drawInfoRow = (label, value) => {
    const val = value != null && String(value).trim() ? String(value).trim() : "—";
    const hVal = doc.heightOfString(val, { width: contentW - LABEL_COL, lineGap: bodyLineGap });
    const hLbl = doc.heightOfString(`${label}:`, { width: LABEL_COL, lineGap: bodyLineGap });
    const rowH = Math.max(hVal, hLbl, ROW_MIN - 4) + 4;
    ensurePage(rowH);
    doc.fillColor("#000000");
    doc.font("Times-Bold").fontSize(10).text(`${label}:`, margin, y, { width: LABEL_COL });
    doc.font("Times-Roman").fontSize(10).text(val, margin + LABEL_COL, y, {
      width: contentW - LABEL_COL,
      lineGap: bodyLineGap,
    });
    y += rowH;
  };

  const sessionDateStr = recordData.date
    ? new Date(recordData.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  drawInfoRow("Name of Student", recordData.clientName || "—");
  drawInfoRow("Gender", recordData.gender);
  drawInfoRow("Course/Year/Section", buildCourseYearSectionLine(recordData));
  drawInfoRow("Date", sessionDateStr);
  drawInfoRow("Session No.", recordData.sessionNumber != null ? String(recordData.sessionNumber) : "—");

  y += mmToPt(1);

  const drawNarrativeSection = (heading, bodyText, opts = {}) => {
    const trail = opts.trailingPad != null ? opts.trailingPad : SECTION_GAP;
    const text = bodyText != null && String(bodyText).trim() ? String(bodyText).trim() : "—";
    const headH = doc.heightOfString(heading, { width: contentW }) + 3;
    const bodyH = doc.heightOfString(text, { width: contentW, lineGap: bodyLineGap });
    ensurePage(headH + bodyH + trail);
    doc.fillColor("#000000").font("Times-Bold").fontSize(10).text(heading, margin, y, { width: contentW });
    y += headH;
    doc.font("Times-Roman").fontSize(10).text(text, margin, y, {
      width: contentW,
      lineGap: bodyLineGap,
    });
    y += bodyH + trail;
  };

  const problemsText = problemsNarrativeForIndividual(recordData);
  const outcomeText =
    recordData.outcomes != null && String(recordData.outcomes).trim()
      ? String(recordData.outcomes).trim()
      : recordData.outcome != null && String(recordData.outcome).trim()
        ? String(recordData.outcome).trim()
        : "—";
  const remarksText =
    recordData.remarks != null && String(recordData.remarks).trim() ? String(recordData.remarks).trim() : "—";
  const recommendationText = recordData.recommendation?.trim()
    ? String(recordData.recommendation).trim()
    : "(To be accomplished by the Director, SWEU.)";

  const counselorDisplay = String(recordData.counselor || sanitizedCounselorName || "").trim() || "—";

  drawNarrativeSection("Problem/s presented", problemsText);
  drawNarrativeSection("Outcome of Counseling Session", outcomeText);
  drawNarrativeSection("Remarks", remarksText, { trailingPad: mmToPt(1.5) });

  const counselorSigH = counselorSignatureBlockMeasuredHeight(doc, counselorDisplay);
  ensurePage(counselorSigH);
  y = drawIndividualCounselorSignatureBlock(doc, counselorDisplay, margin, pageWidth, y);

  drawNarrativeSection("Recommendation", recommendationText, { trailingPad: mmToPt(1.5) });

  const directorSignatoryName = resolveRecommendationAuthorName(recordData);
  const directorSigH = directorSignatureBlockMeasuredHeight(doc, directorSignatoryName);
  ensurePage(directorSigH);
  y = drawIndividualDirectorSignatureBlock(doc, directorSignatoryName, margin, pageWidth, y);

  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    drawIndividualFormFooterStrip(doc, i + 1, total);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return pdfPath;
}

// Function to generate a counseling record PDF (BSU individual form, or legacy admin banner layout)
export const generateCounselingRecordPDF = async (recordData, sanitizedCounselorName, options = {}) => {
  if (options.adminSynthesizedPdf) {
    return generateLegacyAdminCounselingPdf(recordData, sanitizedCounselorName, options);
  }
  return generateIndividualBsCounselingPdf(recordData, sanitizedCounselorName, options);
};

// Generate a unique tracking number
const generateTrackingNumber = () => {
    return `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};
