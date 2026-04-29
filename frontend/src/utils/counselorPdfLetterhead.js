/**
 * BUKSU letterhead + footer for counselor jsPDF exports.
 * Matches backend `addRecordHeaderFooter` in `backend/utils/pdfUtils.js` (official letterhead layout).
 * Units: jsPDF default mm, A4.
 */

import buksuLogoUrl from "../assets/buksu-logo.png";

/** ~RECORD_PDF_HEADER_HEIGHT_PT at 72dpi → mm */
export const PDF_HEADER_MM = 59;
export const PDF_FOOTER_MM = 32;
/** Whitespace above letterhead (~14pt). */
export const PDF_HEADER_TOP_MARGIN_MM = 5;
/** Y position to start body content below header + gap */
export const PDF_CONTENT_TOP_MM = PDF_HEADER_MM + 6;

const LOGO_MM = 24.7;
const SIDE_MM = 14;

export const getPdfMaxContentY = (doc) =>
  doc.internal.pageSize.getHeight() - PDF_FOOTER_MM - 12;

let cachedLogoDataUrl = null;
let logoFetchAttempted = false;

/**
 * Loads the BUKSU logo once as a data URL for jsPDF.addImage (cached).
 * @returns {Promise<string|null>}
 */
export async function loadBuksuLogoDataUrl() {
  if (logoFetchAttempted) return cachedLogoDataUrl;
  logoFetchAttempted = true;
  try {
    const res = await fetch(buksuLogoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

/**
 * @param {unknown} doc — jsPDF instance
 * @param {string|null|undefined} logoDataUrl — from loadBuksuLogoDataUrl(); falls back to placeholder on left
 */
export const addCounselorPdfHeaderFooter = (
  doc,
  pageNum,
  totalPages,
  trackingNumber,
  reportDate,
  logoDataUrl = null
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  void reportDate;

  const m = PDF_HEADER_TOP_MARGIN_MM;
  const innerH = PDF_HEADER_MM - m;
  const logoX = SIDE_MM;
  const logoY = m + 4;
  const fullTextW = pageWidth - 2 * SIDE_MM;
  const pageCenterX = pageWidth / 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, m, pageWidth, innerH, "F");

  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("BUKIDNON STATE UNIVERSITY", pageCenterX, m + 9, {
    align: "center",
    maxWidth: fullTextW,
  });
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text("Fortich Street, Malaybalay City, Bukidnon 8700", pageCenterX, m + 16, {
    align: "center",
    maxWidth: fullTextW,
  });
  doc.text("Tel (088) 813-5661 to 5663; Telefax (088) 813-2717", pageCenterX, m + 22, {
    align: "center",
    maxWidth: fullTextW,
  });

  doc.setTextColor(30, 64, 175);
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text("www.buksu.edu.ph", pageCenterX, m + 28, {
    align: "center",
    maxWidth: fullTextW,
    underline: true,
  });
  doc.setTextColor(0, 0, 0);

  const ruleY = m + 34;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(SIDE_MM, ruleY, pageWidth - SIDE_MM, ruleY);

  let y = m + 38;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("STUDENT WELFARE AND ENGAGEMENT UNIT", pageCenterX, y, {
    align: "center",
    maxWidth: fullTextW,
  });
  y += 6;
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.text("GUIDANCE AND COUNSELING SERVICES", pageCenterX, y, {
    align: "center",
    maxWidth: fullTextW,
  });

  if (logoDataUrl && typeof logoDataUrl === "string") {
    try {
      const imgFmt = logoDataUrl.includes("image/jpeg") || logoDataUrl.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, imgFmt, logoX, logoY, LOGO_MM, LOGO_MM);
    } catch {
      drawLogoPlaceholder(doc, logoX, logoY);
    }
  } else {
    drawLogoPlaceholder(doc, logoX, logoY);
  }
  const footerY = pageHeight - PDF_FOOTER_MM;
  doc.setFillColor(102, 126, 234);
  doc.rect(0, footerY, pageWidth, PDF_FOOTER_MM, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "CONFIDENTIAL - Sensitive information protected by confidentiality policy.",
    pageWidth / 2,
    footerY + 5,
    { align: "center", maxWidth: pageWidth - 2 * SIDE_MM }
  );
  doc.setFontSize(6.5);
  doc.text("Counseling Services Management System", pageWidth / 2, footerY + 11, {
    align: "center",
  });
  doc.setFontSize(6);
  doc.text(`Page ${pageNum} of ${totalPages} | Tracking: ${trackingNumber}`, pageWidth / 2, footerY + 17, {
    align: "center",
    maxWidth: pageWidth - 2 * SIDE_MM,
  });
  doc.setFontSize(5.5);
  doc.text(
    "For inquiries, contact your system administrator. This report is generated electronically.",
    pageWidth / 2,
    footerY + 23,
    { align: "center", maxWidth: pageWidth - 2 * SIDE_MM }
  );

  doc.setTextColor(0, 0, 0);
};

function drawLogoPlaceholder(doc, logoX, logoY) {
  const cx = logoX + LOGO_MM / 2;
  const cy = logoY + LOGO_MM / 2;
  doc.setDrawColor(102, 112, 133);
  doc.setLineWidth(0.35);
  doc.circle(cx, cy, LOGO_MM / 2 - 1, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(17, 24, 39);
  doc.text("BUKSU", cx, cy + 1, { align: "center" });
}
