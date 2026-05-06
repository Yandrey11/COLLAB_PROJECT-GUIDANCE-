/**
 * Counseling Summary Report (multi-record) — PDFKit.
 * Grid layout: equal column widths, typed cell alignment, legend columns, form footer strip.
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import {
  drawBsCounselingSummaryLetterhead,
  measureBsCounselingSummaryContentStart,
} from "./pdfUtils.js";
import {
  PROBLEMS_PRESENTED_OPTIONS,
  composeProblemsPresentedString,
  parseProblemsPresentedParts,
} from "./problemsPresented.js";

export const SUMMARY_REPORT_FORM = {
  DOC_CODE: "GCS-SR-001",
  REVISION: "01",
  ISSUE_NO: "01",
  ISSUE_DATE: "February 18, 2025",
};

const mmToPt = (mm) => (mm / 25.4) * 72;

export function buildSummaryMonthLabel(startDate, endDate) {
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  try {
    if (startDate && endDate) {
      const a = new Date(startDate);
      const b = new Date(endDate);
      if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
        if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
          return fmt(a);
        }
        return `${fmt(a)} – ${fmt(b)}`;
      }
    }
    if (startDate) {
      const a = new Date(startDate);
      if (!Number.isNaN(a.getTime())) return fmt(a);
    }
    if (endDate) {
      const b = new Date(endDate);
      if (!Number.isNaN(b.getTime())) return fmt(b);
    }
  } catch {
    /* ignore */
  }
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function buildSummaryMonthLabelFromRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return buildSummaryMonthLabel("", "");
  }
  const ts = records
    .map((r) => (r && r.date ? new Date(r.date).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (ts.length === 0) return buildSummaryMonthLabel("", "");
  const min = new Date(Math.min(...ts));
  const max = new Date(Math.max(...ts));
  return buildSummaryMonthLabel(min.toISOString().slice(0, 10), max.toISOString().slice(0, 10));
}

export function inferSummarySchoolYear(records) {
  if (!Array.isArray(records) || records.length === 0) return "—";
  const years = records
    .map((r) => (r && r.schoolYear != null ? String(r.schoolYear).trim() : ""))
    .filter(Boolean);
  if (years.length === 0) return "—";
  const uniq = [...new Set(years)];
  return uniq.length === 1 ? uniq[0] : uniq.join(" · ");
}

function formatTableDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function courseYearCell(record) {
  const c = record.course != null && String(record.course).trim() ? String(record.course).trim() : "";
  const y = record.yearLevel != null && String(record.yearLevel).trim() ? String(record.yearLevel).trim() : "";
  if (c && y) return `${c} / ${y}`;
  return c || y || "—";
}

function problemsAbbrevCell(record) {
  const raw = composeProblemsPresentedString(record) || record.problemsPresented || "";
  const { codes, rest } = parseProblemsPresentedParts(String(raw));
  const main = codes.join(", ");
  const r = rest.trim();
  const s = r ? (main ? `${main}; ${r}` : r) : main;
  return s || "—";
}

function remarksCell(record) {
  const r = record.remarks != null && String(record.remarks).trim() ? String(record.remarks).trim() : "—";
  return r.length > 120 ? `${r.slice(0, 117)}…` : r;
}

function drawSummaryFooterStrip(doc, pageNum, totalPages) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const sidePadding = 36;
  const innerW = pageWidth - 2 * sidePadding;
  const cells = [
    `Document Code: ${SUMMARY_REPORT_FORM.DOC_CODE}`,
    `Revision No.: ${SUMMARY_REPORT_FORM.REVISION}`,
    `Issue No.: ${SUMMARY_REPORT_FORM.ISSUE_NO}`,
    `Issue Date: ${SUMMARY_REPORT_FORM.ISSUE_DATE}`,
    `Page ${pageNum} of ${totalPages}`,
  ];
  const slotW = innerW / cells.length;
  const metaBaselineY = pageHeight - mmToPt(11);
  doc.font("Times-Roman").fontSize(7).fillColor("#000000");
  cells.forEach((text, i) => {
    doc.text(text, sidePadding + i * slotW, metaBaselineY, {
      width: slotW,
      align: "center",
      lineBreak: false,
    });
  });
}

/** Signature block width: proportional, capped for a shorter rule (print-ready). */
function signatureLineWidthPt(pageWidth) {
  return Math.min(pageWidth * 0.375, 200);
}

const SUMMARY_SIG_NAME_TO_RULE = mmToPt(2);
const SUMMARY_SIG_RULE_TO_LABEL = mmToPt(2.5);

function measureSummaryGeneratorSignatureHeight(doc, generatorName, lineW) {
  const name = String(generatorName || "").trim();
  let h = 0;
  if (name) {
    doc.font("Times-Italic").fontSize(9);
    h += doc.heightOfString(name, { width: lineW, lineGap: 1 }) + SUMMARY_SIG_NAME_TO_RULE;
  } else {
    h += SUMMARY_SIG_NAME_TO_RULE;
  }
  h += SUMMARY_SIG_RULE_TO_LABEL;
  doc.font("Times-Roman").fontSize(8.5);
  h += doc.heightOfString("Name and Signature", { width: lineW, align: "center" });
  return h + mmToPt(2);
}

/** Right-aligned: generator name (italic) above rule, then "Name and Signature" only. */
function drawSignatureBlock(doc, pageWidth, marginRight, y, generatorName) {
  const lineW = signatureLineWidthPt(pageWidth);
  const lineRight = pageWidth - marginRight;
  const lineLeft = lineRight - lineW;
  const name = String(generatorName || "").trim();

  let yy = y;
  doc.fillColor("#000000");
  if (name) {
    doc.font("Times-Italic").fontSize(9);
    doc.text(name, lineLeft, yy, { width: lineW, align: "center" });
    yy += doc.heightOfString(name, { width: lineW, lineGap: 1 }) + SUMMARY_SIG_NAME_TO_RULE;
  } else {
    yy += SUMMARY_SIG_NAME_TO_RULE;
  }

  doc.strokeColor("#000000").lineWidth(0.55);
  doc.moveTo(lineLeft, yy).lineTo(lineRight, yy).stroke();
  yy += SUMMARY_SIG_RULE_TO_LABEL;

  doc.font("Times-Roman").fontSize(8.5);
  doc.text("Name and Signature", lineLeft, yy, { width: lineW, align: "center" });
}

const LEGEND_BODY_FONT_PT = 11;
const LEGEND_TITLE_FONT_PT = 11;
/** Abbreviation column width (≈40–60 pt) for tabular legend alignment. */
const LEGEND_ABBR_COL_W_PT = 52;

function drawLegendRowSingle(doc, opt, marginLeft, contentWidth, y, abbrColW, dashStr, dashW) {
  if (!opt) return;
  doc.font("Times-Roman").fontSize(LEGEND_BODY_FONT_PT).fillColor(0, 0, 0);
  doc.text(opt.code, marginLeft, y, { width: abbrColW, align: "right" });
  const dashX = marginLeft + abbrColW;
  doc.text(dashStr, dashX, y, { lineBreak: false });
  const descX = dashX + dashW;
  doc.text(opt.label, descX, y, {
    width: Math.max(60, marginLeft + contentWidth - descX),
    align: "left",
    lineBreak: false,
  });
}

/**
 * @param {object[]} records — lean Mongoose docs
 * @param {{ monthLabel: string; schoolYear: string; trackingNumber: string; reportDate?: string; generatedByName?: string }} meta
 * @returns {Promise<string>} temp file path
 */
export async function generateCounselingSummaryPdf(records, meta) {
  const { monthLabel, schoolYear, trackingNumber, reportDate, generatedByName } = meta;
  const tempDir = path.join(process.cwd(), "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const safeName = `summary_${Date.now()}_${Math.floor(Math.random() * 10000)}.pdf`;
  const pdfPath = path.join(tempDir, safeName);

  const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginLeft = 36;
  const marginRight = 36;
  const marginBottom = mmToPt(38);
  const contentWidth = pageWidth - marginLeft - marginRight;
  const maxContentY = pageHeight - marginBottom - mmToPt(6);
  const rd = reportDate || new Date().toLocaleDateString();

  const letterOptsBase = {
    monthLabel: monthLabel || "—",
    schoolYear: schoolYear || "—",
    trackingNumber,
    reportDate: rd,
  };
  const contentTopFirst = measureBsCounselingSummaryContentStart({
    ...letterOptsBase,
    firstPage: true,
  });
  const contentTopNext = measureBsCounselingSummaryContentStart({
    ...letterOptsBase,
    firstPage: false,
  });
  let activeContentTop = contentTopFirst;

  /** Title and letterhead are drawn after buffered pages complete. */
  let finalY = activeContentTop;
  doc.fillColor(0, 0, 0);

  const NUM_COLS = 7;
  const baseColW = contentWidth / NUM_COLS;
  const colWidths = Array.from({ length: NUM_COLS }, (_, i) =>
    i === NUM_COLS - 1 ? contentWidth - baseColW * (NUM_COLS - 1) : baseColW
  );
  /** Center: No., Date, Gender — left: name, course, problems, remarks */
  const colAligns = ["center", "center", "left", "left", "center", "left", "left"];
  const headers = [
    "No.",
    "Date",
    "Name of Student",
    "Course & Year",
    "Gender",
    "Problems Presented",
    "Remarks",
  ];

  const CELL_PAD_H = 5;
  const CELL_PAD_V = 6;
  const HEADER_ROW_H = 28;
  const DATA_ROW_MIN_H = 22;
  const DATA_FONT_SIZE = 8.5;
  const DATA_LINE_GAP = 2;

  const drawTableHeader = () => {
    doc.font("Times-Bold").fontSize(9).fillColor(0, 0, 0);
    let x = marginLeft;
    const rowTop = finalY;
    headers.forEach((h, i) => {
      doc.rect(x, rowTop, colWidths[i], HEADER_ROW_H).stroke();
      const innerW = Math.max(0, colWidths[i] - 2 * CELL_PAD_H);
      const blockH = doc.heightOfString(h, { width: innerW, align: "center", lineGap: 1 });
      const textY = rowTop + Math.max(CELL_PAD_V, (HEADER_ROW_H - blockH) / 2);
      doc.text(h, x + CELL_PAD_H, textY, {
        width: innerW,
        align: "center",
        lineGap: 1,
      });
      x += colWidths[i];
    });
    finalY = rowTop + HEADER_ROW_H;
  };

  /** Natural row height for one data row (max of cell text blocks + padding). */
  const measureDataRowHeight = (cells) => {
    doc.font("Times-Roman").fontSize(DATA_FONT_SIZE);
    const innerHeights = cells.map((text, i) => {
      const innerW = Math.max(0, colWidths[i] - 2 * CELL_PAD_H);
      return doc.heightOfString(String(text), {
        width: innerW,
        lineGap: DATA_LINE_GAP,
        align: colAligns[i],
      });
    });
    const textBlockH = Math.max(...innerHeights, 0);
    return Math.max(textBlockH + 2 * CELL_PAD_V, DATA_ROW_MIN_H);
  };

  const dataRows = records.map((record, idx) => [
    String(idx + 1),
    formatTableDate(record.date),
    record.clientName != null && String(record.clientName).trim()
      ? String(record.clientName).trim()
      : "—",
    courseYearCell(record),
    record.gender != null && String(record.gender).trim() ? String(record.gender).trim() : "—",
    problemsAbbrevCell(record),
    remarksCell(record),
  ]);

  const maxRowFitsBody = maxContentY - contentTopFirst - HEADER_ROW_H - 1;
  const maxNatural =
    dataRows.length === 0 ? DATA_ROW_MIN_H : Math.max(...dataRows.map(measureDataRowHeight), DATA_ROW_MIN_H);
  let uniformRowH = maxNatural;
  if (maxRowFitsBody > DATA_ROW_MIN_H && uniformRowH > maxRowFitsBody) {
    uniformRowH = maxRowFitsBody;
  }

  const drawDataRow = (cells, rowH) => {
    doc.font("Times-Roman").fontSize(DATA_FONT_SIZE);
    if (finalY + rowH > maxContentY) {
      doc.addPage();
      activeContentTop = contentTopNext;
      finalY = activeContentTop;
      drawTableHeader();
    }
    let x = marginLeft;
    cells.forEach((text, i) => {
      doc.rect(x, finalY, colWidths[i], rowH).stroke();
      const innerW = Math.max(0, colWidths[i] - 2 * CELL_PAD_H);
      const th = doc.heightOfString(String(text), {
        width: innerW,
        lineGap: DATA_LINE_GAP,
        align: colAligns[i],
      });
      const textY = finalY + Math.max(CELL_PAD_V, (rowH - th) / 2);
      doc.save();
      doc.rect(x + 0.25, finalY + 0.25, colWidths[i] - 0.5, rowH - 0.5).clip();
      doc.text(String(text), x + CELL_PAD_H, textY, {
        width: innerW,
        lineGap: DATA_LINE_GAP,
        align: colAligns[i],
      });
      doc.restore();
      x += colWidths[i];
    });
    finalY += rowH;
  };

  drawTableHeader();
  dataRows.forEach((cells) => drawDataRow(cells, uniformRowH));

  finalY += mmToPt(8);
  if (finalY + mmToPt(50) > maxContentY) {
    doc.addPage();
    activeContentTop = contentTopNext;
    finalY = activeContentTop;
  }

  const totalBaseY = finalY;
  const totalLabel = "Total No. of Students Counseled:";
  const gapAfterColonPt = 6;
  const countStr = String(records.length);
  doc.font("Times-Bold").fontSize(10).fillColor(0, 0, 0);
  doc.text(totalLabel, marginLeft, totalBaseY, { lineBreak: false });
  const xField = marginLeft + doc.widthOfString(totalLabel) + gapAfterColonPt;
  const countW = doc.widthOfString(countStr);
  doc.text(countStr, xField, totalBaseY, { lineBreak: false });

  /** Short rule centered under the count: slightly wider than digits; 1–2 digits capped ~20–30 CSS px; 2–3 mm below baseline. */
  const pxToPt = (px) => (px / 96) * 72;
  const minRuleW = pxToPt(20);
  const maxRuleW = pxToPt(30);
  const padded = countW + mmToPt(1.5);
  let underlineLenPt = Math.max(minRuleW, padded);
  if (countStr.length <= 2) {
    underlineLenPt = Math.min(maxRuleW, underlineLenPt);
  }
  const countCenterX = xField + countW / 2;
  const lineStartX = countCenterX - underlineLenPt / 2;
  const gapBelowNumber = mmToPt(2.5);
  const inlineRuleY = totalBaseY + gapBelowNumber;
  doc.strokeColor("#000000").lineWidth(0.5);
  doc.moveTo(lineStartX, inlineRuleY).lineTo(lineStartX + underlineLenPt, inlineRuleY).stroke();

  /** Space before legend heading */
  finalY = totalBaseY + mmToPt(8.5);

  doc.font("Times-Bold").fontSize(LEGEND_TITLE_FONT_PT).fillColor(0, 0, 0);
  doc.text("Legend (abbreviations)", marginLeft, finalY);
  finalY += mmToPt(5);

  const LEGEND_LINE_SP = mmToPt(5);
  doc.font("Times-Roman").fontSize(LEGEND_BODY_FONT_PT).fillColor(0, 0, 0);
  const dashStr = " - ";
  const dashW = doc.widthOfString(dashStr);
  const abbrColW = LEGEND_ABBR_COL_W_PT;

  let legY = finalY;
  for (let i = 0; i < PROBLEMS_PRESENTED_OPTIONS.length; i++) {
    if (legY + LEGEND_LINE_SP > maxContentY - mmToPt(30)) {
      doc.addPage();
      activeContentTop = contentTopNext;
      legY = activeContentTop;
    }
    drawLegendRowSingle(doc, PROBLEMS_PRESENTED_OPTIONS[i], marginLeft, contentWidth, legY, abbrColW, dashStr, dashW);
    legY += LEGEND_LINE_SP;
  }
  finalY = legY;

  finalY += mmToPt(4);
  const sigLineW = signatureLineWidthPt(pageWidth);
  const sigBlockH = measureSummaryGeneratorSignatureHeight(
    doc,
    generatedByName || "",
    sigLineW
  );
  if (finalY + sigBlockH > maxContentY) {
    doc.addPage();
    activeContentTop = contentTopNext;
    finalY = activeContentTop;
  }
  drawSignatureBlock(doc, pageWidth, marginRight, finalY, generatedByName || "");

  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    drawBsCounselingSummaryLetterhead(doc, {
      ...letterOptsBase,
      firstPage: i === 0,
    });
    drawSummaryFooterStrip(doc, i + 1, total);
  }

  doc.end();
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return pdfPath;
}
