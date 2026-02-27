import AdminReport from "../../models/AdminReport.js";
import Record from "../../models/Record.js";
import Counselor from "../../models/Counselor.js";
import Admin from "../../models/Admin.js";
import Session from "../../models/Session.js";
import AnalyticsEvent from "../../models/AnalyticsEvent.js";
import ActivityLog from "../../models/ActivityLog.js";
import Notification from "../../models/Notification.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { getDriveClientFromRequest, getOrCreateReportsFolder } from "../../utils/driveUtils.js";
import mongoose from "mongoose";

// Helper function to generate tracking number
const generateTrackingNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `DOC-${timestamp}-${random}`;
};

// Helper function to add header and footer (matching report format)
const addHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate, reportTitle) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Header - Blue background rgb(102, 126, 234) = #667eea (large size)
  const headerHeight = 55;
  doc.fillColor('#667eea');
  doc.rect(0, 0, pageWidth, headerHeight).fill();
  
  // Header text in white
  doc.fillColor('#ffffff');
  
  // Main title - centered at top
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text(reportTitle || "COUNSELING RECORDS REPORT", pageWidth / 6 , 6, { align: 'left' });
  
  // Tracking and Date on separate line below title - properly spaced
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#ffffff');
  // Document Tracking - left aligned
  doc.text(`Document Tracking: ${trackingNumber}`, 14, 38);
  // Date - right aligned
  doc.text(`Date: ${reportDate}`, 14, 38, { 
    width: pageWidth - 28, 
    align: 'right' 
  });

  // Footer - Blue background rgb(102, 126, 234) = #667eea (large size)
  const footerHeight = 60;
  doc.fillColor('#667eea');
  doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight).fill();
  
  // Footer text in white - properly spaced to avoid overlap
  doc.fillColor('#ffffff');
  
  // Line 1: Confidential notice (top of footer)
  doc.fontSize(8)
     .font('Helvetica')
     .text("CONFIDENTIAL - This document contains sensitive information and is protected under client confidentiality agreements.", 
       pageWidth / 2, pageHeight - footerHeight + 8, { align: 'left', width: pageWidth - 28 });
  
  // Line 2: System name (left), Page number (center), Tracking (right) - same line
  doc.fontSize(7)
     .fillColor('#ffffff');
  doc.text("Counseling Services Management System", 14, pageHeight - footerHeight + 25);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - footerHeight + 25, { align: 'left' });
 
  
  // Line 3: Bottom notice
  doc.fontSize(6)
     .fillColor('#ffffff');
  doc.text("For inquiries, contact your system administrator. This report is generated electronically.", 
    pageWidth / 2, pageHeight - footerHeight + 38, { align: 'center', width: pageWidth - 28 });
  
  // CRITICAL: Reset fillColor to black after header/footer
  doc.fillColor('#000000');
};

// Helper to get user info from request
const getUserInfo = (req) => {
  return {
    userId: req.admin?._id || req.user?._id,
    userName: req.admin?.name || req.admin?.email || req.user?.name || req.user?.email || "Unknown Admin",
    userEmail: req.admin?.email || req.user?.email || "unknown@example.com",
    userModel: req.admin?._id ? "Admin" : "Counselor",
  };
};

// Helper to log activity
const logActivity = async (req, activityType, description, metadata = {}) => {
  try {
    const userInfo = getUserInfo(req);
    const activityLog = new ActivityLog({
      userId: userInfo.userId,
      userModel: userInfo.userModel === "Admin" ? "Admin" : "Counselor",
      userEmail: userInfo.userEmail,
      userName: userInfo.userName,
      activityType,
      description,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      metadata,
    });
    await activityLog.save();
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging should not break the main flow
  }
};

/**
 * Get Reports Dashboard Overview
 */
export const getReportsOverview = async (req, res) => {
  try {
    // Total Counseling Records
    const totalRecords = await Record.countDocuments();

    // Total Completed Sessions
    const completedSessions = await Record.countDocuments({ status: "Completed" });

    // Total Ongoing Sessions
    const ongoingSessions = await Record.countDocuments({ status: "Ongoing" });

    // Total Counselors
    const totalCounselors = await Counselor.countDocuments({ role: "counselor" });

    // Total Generated PDFs (records with driveLink)
    const totalPDFs = await Record.countDocuments({
      driveLink: { $exists: true, $ne: null, $ne: "" },
    });

    // Files Uploaded to Google Drive (same as PDFs for now)
    const filesUploaded = await Record.countDocuments({
      driveLink: { $exists: true, $ne: null, $ne: "" },
    });

    res.status(200).json({
      success: true,
      overview: {
        totalRecords,
        completedSessions,
        ongoingSessions,
        totalCounselors,
        totalPDFs,
        filesUploaded,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching reports overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports overview",
      error: error.message,
    });
  }
};

/**
 * Get filtered records for report generation
 */
export const getFilteredRecords = async (req, res) => {
  try {
    const {
      reportType,
      clientName,
      counselorName,
      status,
      recordType,
      sessionType,
      startDate,
      endDate,
      counselorId,
      page = 1,
      limit = 3,
    } = req.query;

    const filter = {};

    if (clientName) filter.clientName = { $regex: clientName, $options: "i" };
    if (counselorName) filter.counselor = { $regex: counselorName, $options: "i" };
    if (status) filter.status = status;
    if (recordType) filter.status = recordType; // recordType maps to status
    if (sessionType) filter.sessionType = sessionType;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      filter.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.date = { $lte: new Date(endDate) };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Record.countDocuments(filter);

    // Get records
    const records = await Record.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      filter,
    });
  } catch (error) {
    console.error("❌ Error fetching filtered records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch filtered records",
      error: error.message,
    });
  }
};

/**
 * Generate PDF Report
 */
export const generateReport = async (req, res) => {
  try {
    const {
      reportType,
      reportName,
      clientName,
      counselorName,
      status,
      recordType,
      sessionType,
      startDate,
      endDate,
      counselorId,
    } = req.body;

    if (!reportType || !reportName) {
      return res.status(400).json({
        success: false,
        message: "Report type and report name are required",
      });
    }

    const userInfo = getUserInfo(req);
    const trackingNumber = generateTrackingNumber();
    const reportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build filter for records
    const filter = {};
    if (clientName) filter.clientName = { $regex: clientName, $options: "i" };
    if (counselorName) filter.counselor = { $regex: counselorName, $options: "i" };
    if (status) filter.status = status;
    if (recordType) filter.status = recordType;
    if (sessionType) filter.sessionType = sessionType;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      filter.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.date = { $lte: new Date(endDate) };
    }

    // Fetch data based on report type
    let records = [];
    let statistics = {};

    switch (reportType) {
      case "Counseling Records Report":
        records = await Record.find(filter).sort({ date: -1 }).lean();
        statistics = {
          totalRecords: records.length,
          completedSessions: records.filter((r) => r.status === "Completed").length,
          ongoingSessions: records.filter((r) => r.status === "Ongoing").length,
          referredSessions: records.filter((r) => r.status === "Referred").length,
        };
        break;
      case "Counselor Activity Report":
        // Get all counselors and their activity
        records = await Record.find(filter)
          .sort({ date: -1 })
          .lean();
        const counselors = await Counselor.find({ role: "counselor" }).lean();
        statistics = {
          totalCounselors: counselors.length,
          totalRecords: records.length,
        };
        break;
      case "Generated Files Report":
        records = await Record.find({
          ...filter,
          driveLink: { $exists: true, $ne: null, $ne: "" },
        })
          .sort({ date: -1 })
          .lean();
        statistics = {
          totalPDFs: records.length,
        };
        break;
      case "User Account Report":
        const users = await Counselor.find().lean();
        const admins = await Admin.find().lean();
        statistics = {
          totalUsers: users.length,
          totalAdmins: admins.length,
          totalCounselors: users.filter((u) => u.role === "counselor").length,
        };
        break;
      case "System Logs Report":
        // Get recent activity logs
        const logs = await ActivityLog.find()
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        statistics = {
          totalLogs: logs.length,
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        });
    }

    // Generate PDF with normal margins and A4 size
    const tempDir = path.join(process.cwd(), "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const sanitizedName = reportName.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfPath = path.join(tempDir, `${sanitizedName}_${trackingNumber}.pdf`);

    // Moderate margins: Top/Bottom: 2.54 cm, Left/Right: 1.91 cm
    // Convert cm to points: 1 cm = 28.35 points
    // Top: 2.54 cm = 72 points, Bottom: 2.54 cm = 72 points
    // Left: 1.91 cm = 54 points, Right: 1.91 cm = 54 points
    const marginTop = 72; // 2.54 cm
    const marginBottom = 72; // 2.54 cm
    const marginLeft = 54; // 1.91 cm
    const marginRight = 54; // 1.91 cm

    const doc = new PDFDocument({ 
      margin: 0, // No automatic margins - we handle everything manually for precise control
      size: 'A4' // A4 size: 595.28 x 841.89 points
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Get page dimensions (A4 = 595.28 x 841.89 points)
    const pageWidth = doc.page.width; // Full page width: 595.28
    const pageHeight = doc.page.height; // Full page height: 841.89
    
    // Content area after margins
    const contentWidth = pageWidth - marginLeft - marginRight; // 595.28 - 54 - 54 = 487.28
    const contentStartX = marginLeft; // Content starts at 54 points from left
    const headerHeight = 55; // Large header height
    const footerHeight = 60; // Large footer height
    const contentStartY = marginTop + headerHeight + 40; // Below header + spacing
    const headerFooterSpace = headerHeight + footerHeight; // Header + Footer
    
    // Track pages
    let currentPage = 1;
    
    // Calculate estimated total pages
    // A4: available height = pageHeight - top/bottom margins - header/footer space
    const availableHeight = pageHeight - marginTop - marginBottom - headerFooterSpace;
    const recordsPerPage = Math.floor(availableHeight / 120);
    const estimatedPages = Math.max(2, Math.ceil((records.length || 1) / recordsPerPage) + 1);
    let totalPages = estimatedPages;

    // ===== PAGE 1: COVER/SUMMARY PAGE =====
    addHeaderFooter(doc, currentPage, totalPages, trackingNumber, reportDate, reportType.toUpperCase());
    
    // Start content below header with proper margins
    let finalY = contentStartY;

    // Main Title - Split into two lines, CENTERED, 20pt bold
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    
    // Handle title splitting for "Counseling Records Report"
    let titleLine1, titleLine2;
    if (reportType.toUpperCase().includes("COUNSELING RECORDS REPORT")) {
      titleLine1 = "COUNSELING RECORDS";
      titleLine2 = "REPORT";
    } else {
      const parts = reportType.toUpperCase().split(' ');
      const midPoint = Math.ceil(parts.length / 2);
      titleLine1 = parts.slice(0, midPoint).join(' ');
      titleLine2 = parts.slice(midPoint).join(' ');
    }
    
    // Center text - use width parameter for proper centering within content area
    doc.text(titleLine1, contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center' 
    });
    finalY += 28;
    doc.text(titleLine2, contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center' 
    });
    finalY += 35;

    // Report Information - 12pt font, LEFT-ALIGNED within content area
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor(0, 0, 0);
    
    const reportDateTime = new Date().toLocaleString();
    doc.text(`Report Generated: ${reportDateTime}`, contentStartX, finalY, {
      width: contentWidth,
      align: 'left'
    });
    finalY += 20;
    
    doc.text(`Document Tracking Number: ${trackingNumber}`, contentStartX, finalY, {
      width: contentWidth,
      align: 'left'
    });
    finalY += 20;

    // Total Records - LEFT-ALIGNED
    if (records.length > 0) {
      doc.text(`Total Records: ${records.length}`, contentStartX, finalY, {
        width: contentWidth,
        align: 'left'
      });
      finalY += 25;
    }

    // Summary Statistics Section - 14pt bold, CENTERED
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0)
       .text("Summary Statistics", contentStartX, finalY, { 
         width: contentWidth, 
         align: 'center' 
       });
    finalY += 23;

    // Statistics - 11pt regular, LEFT-ALIGNED
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(0, 0, 0);

    Object.entries(statistics).forEach(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      doc.text(`${label}: ${value}`, contentStartX, finalY, {
        width: contentWidth,
        align: 'left'
      });
      finalY += 20;
    });

    // ===== PAGE 2+: DETAILED RECORDS PAGES =====
    if (records.length > 0 && reportType === "Counseling Records Report") {
      doc.addPage();
      currentPage++;
      addHeaderFooter(doc, currentPage, totalPages, trackingNumber, reportDate, reportType.toUpperCase());
      finalY = contentStartY;

      // Section Title - 16pt bold, CENTERED
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(0, 0, 0)
         .text("DETAILED RECORDS", contentStartX, finalY, { 
           width: contentWidth, 
           align: 'center' 
         });
      finalY += 30;

      // Calculate maximum Y position (before footer starts)
      // Page height - bottom margin - footer height - safe buffer (80pt buffer to prevent overlap)
      const maxContentY = pageHeight - marginBottom - footerHeight - 80;
      
      records.forEach((record, index) => {
        // Check if we need a new page (leave adequate space for footer)
        if (finalY > maxContentY) {
          doc.addPage();
          currentPage++;
          totalPages = Math.max(totalPages, currentPage);
          addHeaderFooter(doc, currentPage, totalPages, trackingNumber, reportDate, reportType.toUpperCase());
          finalY = contentStartY;
        }

        // Record separator line (gray)
        if (index > 0) {
          doc.strokeColor(200, 200, 200);
          doc.moveTo(contentStartX, finalY - 5).lineTo(contentStartX + contentWidth, finalY - 5).stroke();
          finalY += 5;
        }

        // Record header - 14pt bold
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(0, 0, 0)
           .text(`Record ${index + 1}`, contentStartX, finalY);
        finalY += 18;

        // Record details - Labels bold on left, values regular on right (same line)
        const labelX = contentStartX;
        const valueX = contentStartX + 142; // Fixed position for aligned values
        
        // Client Name
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(0, 0, 0)
           .text("Client Name:", labelX, finalY);
        doc.font('Helvetica')
           .text(record.clientName || "N/A", valueX, finalY);
        finalY += 20;

        // Date
        doc.font('Helvetica-Bold')
           .text("Date:", labelX, finalY);
        doc.font('Helvetica')
           .text(record.date ? new Date(record.date).toLocaleDateString() : "N/A", valueX, finalY);
        finalY += 20;

        // Status
        doc.font('Helvetica-Bold')
           .text("Status:", labelX, finalY);
        doc.font('Helvetica')
           .text(record.status || "N/A", valueX, finalY);
        finalY += 20;

        // Counselor
        doc.font('Helvetica-Bold')
           .text("Counselor:", labelX, finalY);
        doc.font('Helvetica')
           .text(record.counselor || "N/A", valueX, finalY);
        finalY += 20;

        // Session Notes - Label bold, text below
        // Check if we have enough space for notes (label + text + buffer)
        const notesText = record.notes || "No notes available";
        const estimatedNotesHeight = doc.heightOfString(notesText, {
          width: contentWidth,
          lineGap: 5
        });
        
        // Check if we need a new page before adding notes
        if (finalY + 20 + estimatedNotesHeight + 40 > maxContentY) {
          doc.addPage();
          currentPage++;
          totalPages = Math.max(totalPages, currentPage);
          addHeaderFooter(doc, currentPage, totalPages, trackingNumber, reportDate, reportType.toUpperCase());
          finalY = contentStartY;
        }
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(0, 0, 0)
           .text("Notes:", labelX, finalY);
        finalY += 20;
        
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor(0, 0, 0)
           .text(notesText, contentStartX, finalY, {
             width: contentWidth,
             align: 'left',
             lineGap: 5
           });
        
        const notesHeight = doc.heightOfString(notesText, {
          width: contentWidth,
          lineGap: 5
        });
        finalY += notesHeight + 10;

        // Outcomes - Label bold, text below
        // Check if we have enough space for outcomes (label + text + buffer)
        const outcomeText = record.outcomes || record.outcome || "No outcome recorded";
        const estimatedOutcomeHeight = doc.heightOfString(outcomeText, {
          width: contentWidth,
          lineGap: 5
        });
        
        // Check if we need a new page before adding outcomes
        if (finalY + 20 + estimatedOutcomeHeight + 40 > maxContentY) {
          doc.addPage();
          currentPage++;
          totalPages = Math.max(totalPages, currentPage);
          addHeaderFooter(doc, currentPage, totalPages, trackingNumber, reportDate, reportType.toUpperCase());
          finalY = contentStartY;
        }
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(0, 0, 0)
           .text("Outcome:", contentStartX, finalY);
        finalY += 20;
        
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor(0, 0, 0)
           .text(outcomeText, contentStartX, finalY, {
             width: contentWidth,
             align: 'left',
             lineGap: 5
           });
        
        const outcomeHeight = doc.heightOfString(outcomeText, {
          width: contentWidth,
          lineGap: 5
        });
        finalY += outcomeHeight + 10;
      });
    } else if (reportType !== "Counseling Records Report") {
      // For other report types, add page 2 with relevant information
      doc.addPage();
      currentPage++;
      addHeaderFooter(doc, currentPage, totalPages, trackingNumber, reportDate, reportType.toUpperCase());
      finalY = contentStartY;

      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(0, 0, 0)
         .text("REPORT DETAILS", pageWidth / 2, finalY, { align: 'center' });
      finalY += 30;

      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(0, 0, 0);

      Object.entries(statistics).forEach(([key, value]) => {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        doc.text(`${label}: ${value.toLocaleString()}`, contentStartX, finalY);
        finalY += 18;
      });
    }

    // Update all page headers/footers with final page count
    // Note: PDFKit doesn't easily allow updating previous pages, so we use estimated total
    // This is a limitation - for exact counts, we'd need to generate in two passes

    doc.end();

    // Wait for PDF generation
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Get file size
    const stats = fs.statSync(pdfPath);
    const fileSize = stats.size;

    // Upload to Google Drive (uses logged-in admin's account when signed in with Google)
    let driveFileId = null;
    let driveLink = null;
    let driveUploadStatus = "failed";
    let driveUploadError = null;

    try {
      const drive = await getDriveClientFromRequest(req);
      if (drive) {
        const fileName = `${sanitizedName}_${trackingNumber}.pdf`;
        const media = {
          mimeType: "application/pdf",
          body: fs.createReadStream(pdfPath),
        };
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        let file;
        try {
          file = await drive.files.create({
            resource: {
              name: fileName,
              parents: folderId ? [folderId] : [],
            },
            media,
            fields: "id, webViewLink",
          });
        } catch (folderErr) {
          if (folderId && (folderErr.code === 404 || folderErr.code === 403 || String(folderErr.message || "").includes("not found"))) {
            const userFolderId = await getOrCreateReportsFolder(drive);
            if (userFolderId) {
              file = await drive.files.create({
                resource: { name: fileName, parents: [userFolderId] },
                media,
                fields: "id, webViewLink",
              });
            } else {
              file = await drive.files.create({
                resource: { name: fileName },
                media,
                fields: "id, webViewLink",
              });
            }
          } else {
            throw folderErr;
          }
        }

        driveFileId = file.data.id;
        driveLink = file.data.webViewLink;
        driveUploadStatus = "success";
      } else {
        driveUploadError = "Sign in with Google to upload reports to Drive";
      }
    } catch (driveError) {
      console.error("❌ Google Drive upload failed:", driveError);
      driveUploadStatus = "failed";
      driveUploadError = driveError.message || "Unknown error";
    }

    // Save report to database
    const adminReport = new AdminReport({
      reportName,
      reportType,
      trackingNumber,
      generatedBy: {
        userId: userInfo.userId,
        userName: userInfo.userName,
        userEmail: userInfo.userEmail,
        userModel: userInfo.userModel,
      },
      filterCriteria: {
        ...(clientName && typeof clientName === "string" && clientName.trim() !== "" && { clientName }),
        ...(counselorName && typeof counselorName === "string" && counselorName.trim() !== "" && { counselorName }),
        ...(status && typeof status === "string" && status.trim() !== "" && { status }),
        ...(recordType && typeof recordType === "string" && recordType.trim() !== "" && { recordType }),
        ...(sessionType && typeof sessionType === "string" && sessionType.trim() !== "" && { sessionType }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(counselorId && typeof counselorId === "string" && counselorId.trim() !== "" && mongoose.Types.ObjectId.isValid(counselorId) && { counselorId }),
      },
      statistics,
      driveFileId,
      driveLink,
      driveUploadStatus,
      driveUploadError,
      fileName: `${sanitizedName}_${trackingNumber}.pdf`,
      fileSize,
      reportData: {
        recordCount: records.length,
      },
    });

    await adminReport.save();

    // Log activity
    await logActivity(req, "report_generated", `Generated ${reportType}: ${reportName}`, {
      reportId: adminReport._id,
      trackingNumber,
      reportType,
    });

    // Clean up temp file after a delay (allow time for download)
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    }, 60000); // Delete after 1 minute

    // Return report metadata and prepare for file download
    res.status(200).json({
      success: true,
      message: "Report generated successfully",
      report: {
        id: adminReport._id,
        reportName,
        trackingNumber,
        driveLink,
        driveUploadStatus,
        driveUploadError,
        createdAt: adminReport.createdAt,
        fileName: `${sanitizedName}_${trackingNumber}.pdf`,
        downloadPath: `/api/admin/reports/${adminReport._id}/download-pdf`,
      },
    });
  } catch (error) {
    console.error("❌ Error generating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report. Please try again.",
      error: error.message,
    });
  }
};

/**
 * Get all generated reports
 */
export const getAllReports = async (req, res) => {
  try {
    const { page = 1, limit = 3, reportType, sortBy = "createdAt", order = "desc" } = req.query;

    const filter = {};
    if (reportType) filter.reportType = reportType;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortOption = {};
    sortOption[sortBy] = order === "desc" ? -1 : 1;

    const total = await AdminReport.countDocuments(filter);
    const reports = await AdminReport.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};

/**
 * Get report by ID
 */
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await AdminReport.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Update view count
    report.viewCount = (report.viewCount || 0) + 1;
    report.lastViewedAt = new Date();
    await report.save();

    // Log activity
    await logActivity(req, "report_viewed", `Viewed report: ${report.reportName}`, {
      reportId: report._id,
      trackingNumber: report.trackingNumber,
    });

    res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("❌ Error fetching report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report",
      error: error.message,
    });
  }
};

/**
 * Download report PDF file directly
 */
export const downloadReportPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await AdminReport.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Try to get PDF from temp folder first (if still exists)
    const tempDir = path.join(process.cwd(), "temp");
    const tempPdfPath = path.join(tempDir, report.fileName);

    // Check if temp file exists
    if (fs.existsSync(tempPdfPath)) {
      // Update download count
      report.downloadCount = (report.downloadCount || 0) + 1;
      report.lastDownloadedAt = new Date();
      await report.save();

      // Log activity
      await logActivity(req, "report_downloaded", `Downloaded report: ${report.reportName}`, {
        reportId: report._id,
        trackingNumber: report.trackingNumber,
      });

      // Send PDF file
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${report.fileName}"`);
      return res.sendFile(path.resolve(tempPdfPath));
    }

    // If temp file doesn't exist, return Drive link (fallback)
    if (report.driveLink) {
      return res.status(200).json({
        success: true,
        downloadLink: report.driveLink,
        fileName: report.fileName,
        trackingNumber: report.trackingNumber,
        message: "File available in Google Drive",
      });
    }

    return res.status(404).json({
      success: false,
      message: "Report file not available",
    });
  } catch (error) {
    console.error("❌ Error downloading report PDF:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download report",
      error: error.message,
    });
  }
};

/**
 * Download report from Google Drive (legacy method)
 */
export const downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await AdminReport.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (!report.driveLink || !report.driveFileId) {
      return res.status(400).json({
        success: false,
        message: "Report file not available in Google Drive",
      });
    }

    // Update download count
    report.downloadCount = (report.downloadCount || 0) + 1;
    report.lastDownloadedAt = new Date();
    await report.save();

    // Log activity
    await logActivity(req, "report_downloaded", `Downloaded report: ${report.reportName}`, {
      reportId: report._id,
      trackingNumber: report.trackingNumber,
    });

    // Return download link
    res.status(200).json({
      success: true,
      downloadLink: report.driveLink,
      fileName: report.fileName,
      trackingNumber: report.trackingNumber,
    });
  } catch (error) {
    console.error("❌ Error downloading report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download report",
      error: error.message,
    });
  }
};

/**
 * Get counselors list for filter dropdown
 */
export const getCounselorsList = async (req, res) => {
  try {
    const counselors = await Counselor.find({ role: "counselor" })
      .select("name email _id")
      .lean();

    res.status(200).json({
      success: true,
      counselors: counselors.map((c) => ({
        id: c._id,
        name: c.name || c.email,
        email: c.email,
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching counselors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch counselors",
      error: error.message,
    });
  }
};

