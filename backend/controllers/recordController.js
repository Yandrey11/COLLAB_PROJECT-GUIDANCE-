import Record from "../models/Record.js";
import PDFDocument from "pdfkit";
import { oauth2Client } from "./googleDriveAuthController.js";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { createNotification } from "./admin/notificationController.js";
import { createCounselorNotification } from "./counselorNotificationController.js";
import { logLockAction } from "./admin/recordLockController.js";

// Helper to get user info from request
const getUserInfo = (req) => {
  return {
    userId: req.user?._id || req.admin?._id,
    userName: req.user?.name || req.user?.email || req.admin?.name || req.admin?.email || "Unknown User",
    userRole: req.user?.role || req.admin?.role || "counselor",
    userEmail: req.user?.email || req.admin?.email || "unknown@example.com",
  };
};

// 📋 1️⃣ Fetch all records (with query filters)
export const getRecords = async (req, res) => {
  try {
    const { search, sessionType, status, startDate, endDate, sortBy, order } = req.query;
    const filter = {};

    if (search) filter.clientName = { $regex: search, $options: "i" };
    if (sessionType) filter.sessionType = sessionType;
    if (status) filter.status = status;
    if (startDate && endDate) filter.date = { $gte: startDate, $lte: endDate };

    const sortOption = {};
    if (sortBy) sortOption[sortBy] = order === "desc" ? -1 : 1;

    const records = await Record.find(filter).sort(sortOption);
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch records", error: err.message });
  }
};

// ✏️ 2️⃣ Update a record (STRICT 2PL: Lock ownership validated by middleware)
export const updateRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // STRICT 2PL: Additional lock ownership validation (defense in depth)
    const RecordLock = (await import("../models/RecordLock.js")).default;
    const { cleanupExpiredLocks } = await import("./admin/recordLockController.js");
    await cleanupExpiredLocks();

    const now = new Date();
    const lock = await RecordLock.findOne({
      recordId: req.params.id,
      isActive: true,
      expiresAt: { $gte: now },
    });

    if (lock) {
      const isLockOwner = lock.lockedBy.userId.toString() === userInfo.userId.toString();
      if (!isLockOwner) {
        return res.status(423).json({
          success: false,
          message: `Record is locked by ${lock.lockedBy.userName}. Only the lock owner can update.`,
          lockedBy: {
            userId: lock.lockedBy.userId,
            userName: lock.lockedBy.userName,
            userRole: lock.lockedBy.userRole,
          },
        });
      }
      // Lock ownership validated - lock persists (growing phase of 2PL)
    } else {
      // STRICT 2PL: Record must be locked before editing
      return res.status(423).json({
        success: false,
        message: "Record must be locked before editing. Please lock the record first.",
      });
    }

    // Track changes for audit trail
    const changes = [];
    const updateData = { ...req.body };

    // Compare old and new values
    Object.keys(updateData).forEach((key) => {
      if (key !== "auditTrail" && key !== "attachments" && record[key] !== updateData[key]) {
        changes.push({
          field: key,
          oldValue: record[key],
          newValue: updateData[key],
          changedBy: userInfo,
          changedAt: new Date(),
        });
      }
    });

    // Update record
    Object.assign(record, updateData);

    // Update audit trail
    if (!record.auditTrail) {
      record.auditTrail = {
        createdBy: userInfo,
        createdAt: record.createdAt || new Date(),
        lastModifiedBy: userInfo,
        lastModifiedAt: new Date(),
        modificationHistory: [],
      };
    } else {
      record.auditTrail.lastModifiedBy = userInfo;
      record.auditTrail.lastModifiedAt = new Date();
    }
    
    if (changes.length > 0) {
      if (!record.auditTrail.modificationHistory) {
        record.auditTrail.modificationHistory = [];
      }
      record.auditTrail.modificationHistory.push(...changes);
    }

    await record.save();

    // Log UPDATE action
    try {
      const RecordLock = (await import("../models/RecordLock.js")).default;
      const currentLock = await RecordLock.findOne({
        recordId: req.params.id,
        isActive: true,
        expiresAt: { $gte: new Date() },
      });
      
      await logLockAction(
        req.params.id,
        "UPDATE",
        userInfo,
        currentLock?.lockedBy || null,
        `Record updated by ${userInfo.userName} (${userInfo.userRole})`,
        {
          changedFields: changes.map((c) => c.field),
          changeCount: changes.length,
          clientName: record.clientName,
          sessionNumber: record.sessionNumber,
        }
      );
    } catch (logError) {
      console.error("⚠️ Failed to log UPDATE action (non-critical):", logError);
    }

    // ✅ Create notification for admins
    try {
      await createNotification({
        title: "Record Updated",
        description: `${userInfo.userName} (${userInfo.userRole}) updated record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          clientName: record.clientName,
          recordId: record._id.toString(),
          updatedBy: userInfo.userName,
          updatedByRole: userInfo.userRole,
          changes: changes.map((c) => c.field),
        },
        relatedId: record._id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for the counselor who updated the record
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Updated Successfully",
          description: `Your record for ${record.clientName} (Session ${record.sessionNumber}) has been updated.`,
          category: "Updated Record",
          priority: "medium",
          metadata: {
            clientName: record.clientName,
            recordId: record._id.toString(),
            sessionNumber: record.sessionNumber,
            updatedFields: changes.map((c) => c.field),
          },
          relatedId: record._id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: "Failed to update record", error: err.message });
  }
};

// Helper function to generate tracking number
const generateTrackingNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DOC-${timestamp}-${random}`;
};

// Helper function to add header and footer for single record PDF
const addRecordHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate) => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const headerHeight = 55;
  const footerHeight = 60;

  // Header - Blue background
  doc.fillColor('#667eea');
  doc.rect(0, 0, pageWidth, headerHeight).fill();
  
  // Header text in white
  doc.fillColor('#ffffff');
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text("COUNSELING RECORD", pageWidth / 6, 6, { align: 'left' });
  
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#ffffff');
  doc.text(`Document Tracking: ${trackingNumber}`, 14, 38);
  doc.text(`Date: ${reportDate}`, 14, 38, { 
    width: pageWidth - 28, 
    align: 'right' 
  });
  
  // Footer - Blue background
  doc.fillColor('#667eea');
  doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight).fill();
  
  // Footer text in white
  doc.fillColor('#ffffff');
  doc.fontSize(8)
     .font('Helvetica')
     .text("CONFIDENTIAL - This document contains sensitive information and is protected under client confidentiality agreements.", 
       pageWidth / 2, pageHeight - footerHeight + 8, { align: 'left', width: pageWidth - 28 });
  
  doc.fontSize(7)
     .fillColor('#ffffff');
  doc.text("Counseling Services Management System", 14, pageHeight - footerHeight + 25);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - footerHeight + 25, { align: 'center' });
  doc.text(`Tracking: ${trackingNumber}`, 14, pageHeight - footerHeight + 25, { 
    width: pageWidth - 28, 
    align: 'right' 
  });
  
  doc.fontSize(6)
     .fillColor('#ffffff');
  doc.text("For inquiries, contact your system administrator. This report is generated electronically.", 
    pageWidth / 2, pageHeight - footerHeight + 38, { align: 'center', width: pageWidth - 28 });
  
  // CRITICAL: Reset fillColor to black after header/footer
  doc.fillColor(0, 0, 0);
};

// Helper function to add header and footer (matching report format)
const addHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate, reportTitle = "COUNSELING RECORDS REPORT") => {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Header - Blue background (#667eea = rgb(102, 126, 234))
  // Set blue fill color and draw rectangle
  doc.fillColor(102, 126, 234);
  doc.rect(0, 0, pageWidth, 30).fill();
  
  // Header text in white (use numeric RGB for reliability)
  doc.fillColor(255, 255, 255);
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text("COUNSELING RECORDS REPORT", pageWidth / 2, 12, { align: 'center' });
  
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor(255, 255, 255);
  doc.text(`Document Tracking: ${trackingNumber}`, 14, 22);
  doc.fillColor(255, 255, 255);
  doc.text(`Date: ${reportDate}`, pageWidth - 14, 22, { align: 'right' });

  // Footer - Blue background
  // Set blue fill color and draw rectangle
  doc.fillColor(102, 126, 234);
  doc.rect(0, pageHeight - 35, pageWidth, 35).fill();
  
  // Footer text in white
  doc.fillColor(255, 255, 255);
  doc.fontSize(8)
     .font('Helvetica')
     .text("CONFIDENTIAL - This document contains sensitive information and is protected under client confidentiality agreements.", 
       pageWidth / 2, pageHeight - 28, { align: 'center', width: pageWidth - 28 });
  
  doc.fontSize(7)
     .fillColor(255, 255, 255);
  doc.text("Counseling Services Management System", 14, pageHeight - 18);
  doc.fillColor(255, 255, 255);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 18, { align: 'center' });
  doc.fillColor(255, 255, 255);
  doc.text(`Tracking: ${trackingNumber}`, pageWidth - 14, pageHeight - 18, { align: 'right' });
  
  doc.fontSize(6)
     .fillColor(255, 255, 255);
  doc.text("For inquiries, contact your system administrator. This report is generated electronically.", 
    pageWidth / 2, pageHeight - 10, { align: 'center', width: pageWidth - 28 });
  
  // CRITICAL: Reset fillColor to black after header/footer (which uses white)
  // This ensures all subsequent content text is visible
  doc.fillColor(0, 0, 0);
};

// Helper function to upload record to drive
const uploadRecordToDrive = async (record, req) => {
  try {
    if (!oauth2Client.credentials?.access_token) {
      console.warn("⚠️ Google Drive not connected — skipping auto-upload");
      return null;
    }

    // ✅ Fetch record from database to ensure all fields are populated
    let recordData;
    if (record._id) {
      const fetchedRecord = await Record.findById(record._id);
      if (!fetchedRecord) {
        console.error("❌ Record not found in database");
        return null;
      }
      // Convert to plain object to ensure all fields are accessible
      recordData = {
        _id: fetchedRecord._id,
        clientName: fetchedRecord.clientName || "N/A",
        date: fetchedRecord.date,
        sessionType: fetchedRecord.sessionType || "N/A",
        status: fetchedRecord.status || "N/A",
        counselor: fetchedRecord.counselor || "Unknown Counselor",
        sessionNumber: fetchedRecord.sessionNumber,
        notes: fetchedRecord.notes || null,
        outcomes: fetchedRecord.outcomes || fetchedRecord.outcome || null,
      };
    } else {
      // If record is already a plain object, use it directly
      recordData = {
        _id: record._id,
        clientName: record.clientName || "N/A",
        date: record.date,
        sessionType: record.sessionType || "N/A",
        status: record.status || "N/A",
        counselor: record.counselor || "Unknown Counselor",
        sessionNumber: record.sessionNumber,
        notes: record.notes || null,
        outcomes: record.outcomes || record.outcome || null,
      };
    }

    // Get counselor name for filename
    const counselorName = recordData.counselor || req.user?.name || req.user?.email || "Unknown_Counselor";
    const sanitizedCounselorName = counselorName.replace(/[^a-zA-Z0-9]/g, '_');

    // Generate tracking number
    const trackingNumber = generateTrackingNumber();

    // ✅ Generate PDF file locally with same format as reports PDF
    const tempDir = path.join(process.cwd(), "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const pdfPath = path.join(tempDir, `${sanitizedCounselorName}_${recordData.clientName.replace(/\s+/g, '_')}_${trackingNumber}.pdf`);

    const doc = new PDFDocument({ 
      margin: 0,
      size: 'A4'
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Get page dimensions (A4 = 595.28 x 841.89 points)
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    // Use the same margins as reports PDF
    const marginTop = 72;
    const marginBottom = 72;
    const marginLeft = 54;
    const marginRight = 54;
    const headerHeight = 55;
    const footerHeight = 60;
    
    const contentStartX = marginLeft;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const contentStartY = marginTop + headerHeight + 40;

    // Add header and footer using helper function (with blue background and white text)
    const reportDate = recordData.date ? new Date(recordData.date).toLocaleDateString() : new Date().toLocaleDateString();
    addRecordHeaderFooter(doc, 1, 1, trackingNumber, reportDate);

    // CRITICAL: Reset fillColor to black after header/footer - use both formats for reliability
    doc.fillColor('black');
    doc.fillColor(0, 0, 0);

    // Start content
    let finalY = contentStartY;

    // Main Title - Split into two lines like reports PDF
    doc.fillColor(0, 0, 0);
    doc.strokeColor(0, 0, 0);
    
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    
    // First line: "COUNSELING RECORDS"
    doc.text("COUNSELING RECORDS", contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center',
      lineGap: 0
    });
    finalY += 28;
    
    // Second line: "REPORT"
    doc.fillColor(0, 0, 0);
    doc.text("REPORT", contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center',
      lineGap: 0
    });
    finalY += 35;
    
    // Add a separator line after title
    doc.strokeColor(200, 200, 200)
       .lineWidth(1)
       .moveTo(contentStartX, finalY - 5)
       .lineTo(contentStartX + contentWidth, finalY - 5)
       .stroke();
    finalY += 20;

    // Client Details Section - Formatted like a table
    const labelWidth = 130;
    const valueStartX = contentStartX + labelWidth;
    
    // Force black color for all content
    doc.fillColor(0, 0, 0);
    
    // Client Name
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Client Name:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.clientName || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Date
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Date:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    const dateValue = record.date ? new Date(record.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : "N/A";
    doc.text(dateValue, valueStartX, finalY);
    finalY += 22;
    
    // Session Number
    if (record.sessionNumber) {
      doc.font('Helvetica-Bold')
         .fillColor(0, 0, 0);
      doc.text("Session Number:", contentStartX, finalY);
      doc.font('Helvetica')
         .fillColor(0, 0, 0);
      doc.text(String(record.sessionNumber), valueStartX, finalY);
      finalY += 22;
    }
    
    // Session Type
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Session Type:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.sessionType || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Status
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Status:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.status || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Counselor
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Counselor:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.counselor || "Unknown Counselor"), valueStartX, finalY);
    finalY += 30;

    // Session Notes Section
    doc.fillColor(0, 0, 0);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text("Session Notes:", contentStartX, finalY);
    finalY += 25;
    
    const notesText = record.notes || "No notes available.";
    
    // Check if we need a new page for notes
    const estimatedNotesHeight = doc.heightOfString(notesText || "No notes available.", {
      width: contentWidth,
      lineGap: 5
    });
    const maxContentY = pageHeight - marginBottom - footerHeight - 80;
    
    if (finalY + estimatedNotesHeight + 100 > maxContentY) {
      // Add new page if needed
      doc.addPage();
      addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      doc.fillColor(0, 0, 0);
      finalY = contentStartY;
    }
    
    // Notes text
    doc.fillColor(0, 0, 0);
    doc.fontSize(11)
       .font('Helvetica')
       .text(notesText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
       });
    
    const notesHeight = doc.heightOfString(notesText, {
      width: contentWidth,
      lineGap: 5
    });
    finalY += notesHeight + 30;

    // Outcomes Section
    doc.fillColor(0, 0, 0);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text("Outcomes:", contentStartX, finalY);
    finalY += 25;
    
    const outcomeText = record.outcomes || record.outcome || "No outcome recorded.";
    
    // Check if we need a new page for outcomes
    const estimatedOutcomeHeight = doc.heightOfString(outcomeText || "No outcome recorded.", {
      width: contentWidth,
      lineGap: 5
    });
    
    if (finalY + estimatedOutcomeHeight + 100 > maxContentY) {
      // Add new page if needed
      doc.addPage();
      addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      doc.fillColor(0, 0, 0);
      finalY = contentStartY;
    }
    
    // Outcome text
    doc.fillColor(0, 0, 0);
    doc.fontSize(11)
       .font('Helvetica')
       .text(outcomeText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
       });

    doc.end();

    // Wait for PDF generation
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // ✅ Upload PDF to Google Drive with counselor name in filename
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const fileName = `${sanitizedCounselorName}_${record.clientName.replace(/\s+/g, '_')}_record_${trackingNumber}.pdf`;
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };
    const media = {
      mimeType: "application/pdf",
      body: fs.createReadStream(pdfPath),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, webViewLink",
    });

    const driveLink = file.data.webViewLink;

    // ✅ Update record in DB
    record.driveLink = driveLink;
    await record.save();

    // ✅ Create notification for admin about PDF generation
    try {
      const userRole = req.user?.role || "counselor";
      const userName = req.user?.name || req.user?.email || record.counselor || "Unknown User";
      
      await createNotification({
        title: "PDF Generated and Uploaded",
        description: `${userName} (${userRole}) has generated and uploaded a PDF for client: ${recordData.clientName} - Session ${recordData.sessionNumber}. File: ${fileName}`,
        category: "User Activity",
        priority: "low",
        metadata: {
          clientName: recordData.clientName,
          recordId: recordData._id.toString(),
          pdfFileName: fileName,
          driveLink: driveLink,
          generatedBy: userName,
          generatedByRole: userRole,
        },
        relatedId: recordData._id.toString(),
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for counselor about successful Drive upload
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Uploaded to Google Drive",
          description: `Your record for ${recordData.clientName} (Session ${recordData.sessionNumber}) has been successfully uploaded to Google Drive.`,
          category: "New Record",
          priority: "low",
          metadata: {
            clientName: recordData.clientName,
            recordId: recordData._id.toString(),
            sessionNumber: recordData.sessionNumber,
            driveLink: driveLink,
            fileName: fileName,
          },
          relatedId: recordData._id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }

    // ✅ Clean up local PDF
    fs.unlinkSync(pdfPath);

    return driveLink;
  } catch (err) {
    console.error("❌ Drive upload error:", err);
    return null;
  }
};

// ➕ 3️⃣ Create a new counseling record
export const createRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    
    // Get counselor name - prioritize from authenticated user, then from request body, then fallback
    let counselorName = userInfo.userName;
    
    // If userName is "Unknown User", try to get from request body
    if (counselorName === "Unknown User" && req.body.counselor) {
      counselorName = req.body.counselor;
    }
    
    // If still unknown, try to get from req.user or req.admin directly
    if (counselorName === "Unknown User") {
      if (req.user?.name) {
        counselorName = req.user.name;
      } else if (req.user?.email) {
        counselorName = req.user.email;
      } else if (req.admin?.name) {
        counselorName = req.admin.name;
      } else if (req.admin?.email) {
        counselorName = req.admin.email;
      }
    }
    
    // Calculate session number for this client
    const existingRecordsCount = await Record.countDocuments({ 
      clientName: req.body.clientName 
    });
    const sessionNumber = existingRecordsCount + 1;
    
    const record = new Record({
      clientName: req.body.clientName,
      date: req.body.date,
      sessionType: req.body.sessionType,
      sessionNumber: sessionNumber,
      status: req.body.status,
      notes: req.body.notes,
      outcomes: req.body.outcomes,
      driveLink: req.body.driveLink,
      counselor: counselorName, // ✅ Set automatically from authenticated user
      auditTrail: {
        createdBy: userInfo,
        createdAt: new Date(),
        lastModifiedBy: userInfo,
        lastModifiedAt: new Date(),
        modificationHistory: [],
      },
    });

    await record.save();
    
    // ✅ Create notification for admins
    try {
      await createNotification({
        title: "New Record Created",
        description: `${userInfo.userName} (${userInfo.userRole}) created a new record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          clientName: record.clientName,
          recordId: record._id.toString(),
          createdBy: userInfo.userName,
          createdByRole: userInfo.userRole,
          sessionNumber: record.sessionNumber,
        },
        relatedId: record._id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for the counselor who created the record
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Created Successfully",
          description: `Your record for ${record.clientName} (Session ${record.sessionNumber}) has been created and uploaded to Google Drive.`,
          category: "New Record",
          priority: "medium",
          metadata: {
            clientName: record.clientName,
            recordId: record._id.toString(),
            sessionNumber: record.sessionNumber,
            driveLink: record.driveLink || null,
          },
          relatedId: record._id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }
    
    // ✅ Automatically upload to drive after saving
    const driveLink = await uploadRecordToDrive(record, req);
    if (driveLink) {
      console.log("✅ Record automatically uploaded to Google Drive");
      
      // ✅ Update counselor notification with drive link (if notification was created)
      try {
        if (req.user?._id || req.user?.id) {
          // Find the most recent notification for this counselor about this record
          const CounselorNotification = (await import("../models/CounselorNotification.js")).default;
          const notification = await CounselorNotification.findOne({
            counselorId: req.user._id || req.user.id,
            relatedId: record._id,
            relatedType: "record",
            category: "New Record",
          }).sort({ createdAt: -1 });

          if (notification) {
            notification.metadata.driveLink = driveLink;
            await notification.save();
          }
        }
      } catch (updateError) {
        console.error("⚠️ Failed to update notification with drive link (non-critical):", updateError);
      }
    }

    res.status(201).json(record);
  } catch (err) {
    console.error("Error creating record:", err);
    res.status(500).json({ message: "Failed to create record", error: err.message });
  }
};


// ☁️ 4️⃣ Upload to Google Drive (PDF)

// ☁️ Upload counseling session PDF to Google Drive


export const uploadToDrive = async (req, res) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    if (!oauth2Client.credentials?.access_token) {
      console.error("❌ Google Drive not connected — no tokens saved");
      return res.status(401).json({ error: "Google Drive not connected — no tokens saved" });
    }

    // Convert to plain object to ensure all fields are accessible
    const recordData = {
      _id: record._id,
      clientName: record.clientName || "N/A",
      date: record.date,
      sessionType: record.sessionType || "N/A",
      status: record.status || "N/A",
      counselor: record.counselor || "Unknown Counselor",
      sessionNumber: record.sessionNumber,
      notes: record.notes || null,
      outcomes: record.outcomes || record.outcome || null,
    };

    // Get counselor name for filename
    const counselorName = recordData.counselor || req.user?.name || req.user?.email || "Unknown_Counselor";
    const sanitizedCounselorName = counselorName.replace(/[^a-zA-Z0-9]/g, '_');

    // Generate tracking number
    const trackingNumber = generateTrackingNumber();

    // ✅ Generate PDF file locally with same format as reports PDF
    const tempDir = path.join(process.cwd(), "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const pdfPath = path.join(tempDir, `${sanitizedCounselorName}_${recordData.clientName.replace(/\s+/g, '_')}_${trackingNumber}.pdf`);

    const doc = new PDFDocument({ 
      margin: 0,
      size: 'A4'
    });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Get page dimensions (A4 = 595.28 x 841.89 points)
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    // Use the same margins as reports PDF
    const marginTop = 72;
    const marginBottom = 72;
    const marginLeft = 54;
    const marginRight = 54;
    const headerHeight = 55;
    const footerHeight = 60;
    
    const contentStartX = marginLeft;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const contentStartY = marginTop + headerHeight + 40;

    // Add header and footer using helper function (with blue background and white text)
    const reportDate = recordData.date ? new Date(recordData.date).toLocaleDateString() : new Date().toLocaleDateString();
    addRecordHeaderFooter(doc, 1, 1, trackingNumber, reportDate);

    // CRITICAL: Reset fillColor to black after header/footer - use both formats for reliability
    doc.fillColor('black');
    doc.fillColor(0, 0, 0);

    // Start content
    let finalY = contentStartY;

    // Main Title - Split into two lines like reports PDF
    doc.fillColor(0, 0, 0);
    doc.strokeColor(0, 0, 0);
    
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    
    // First line: "COUNSELING RECORDS"
    doc.text("COUNSELING RECORDS", contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center',
      lineGap: 0
    });
    finalY += 28;
    
    // Second line: "REPORT"
    doc.fillColor(0, 0, 0);
    doc.text("REPORT", contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center',
      lineGap: 0
    });
    finalY += 35;
    
    // Add a separator line after title
    doc.strokeColor(200, 200, 200)
       .lineWidth(1)
       .moveTo(contentStartX, finalY - 5)
       .lineTo(contentStartX + contentWidth, finalY - 5)
       .stroke();
    finalY += 20;

    // Client Details Section - Formatted like a table
    const labelWidth = 130;
    const valueStartX = contentStartX + labelWidth;
    
    // Force black color for all content
    doc.fillColor(0, 0, 0);
    
    // Client Name
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Client Name:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.clientName || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Date
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Date:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    const dateValue = record.date ? new Date(record.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : "N/A";
    doc.text(dateValue, valueStartX, finalY);
    finalY += 22;
    
    // Session Number
    if (record.sessionNumber) {
      doc.font('Helvetica-Bold')
         .fillColor(0, 0, 0);
      doc.text("Session Number:", contentStartX, finalY);
      doc.font('Helvetica')
         .fillColor(0, 0, 0);
      doc.text(String(record.sessionNumber), valueStartX, finalY);
      finalY += 22;
    }
    
    // Session Type
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Session Type:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.sessionType || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Status
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Status:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.status || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Counselor
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Counselor:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(record.counselor || "Unknown Counselor"), valueStartX, finalY);
    finalY += 30;

    // Session Notes Section
    doc.fillColor(0, 0, 0);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text("Session Notes:", contentStartX, finalY);
    finalY += 25;
    
    const notesText = record.notes || "No notes available.";
    
    // Check if we need a new page for notes
    const estimatedNotesHeight = doc.heightOfString(notesText || "No notes available.", {
      width: contentWidth,
      lineGap: 5
    });
    const maxContentY = pageHeight - marginBottom - footerHeight - 80;
    
    if (finalY + estimatedNotesHeight + 100 > maxContentY) {
      // Add new page if needed
      doc.addPage();
      addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      doc.fillColor(0, 0, 0);
      finalY = contentStartY;
    }
    
    // Notes text
    doc.fillColor(0, 0, 0);
    doc.fontSize(11)
       .font('Helvetica')
       .text(notesText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
       });
    
    const notesHeight = doc.heightOfString(notesText, {
      width: contentWidth,
      lineGap: 5
    });
    finalY += notesHeight + 30;

    // Outcomes Section
    doc.fillColor(0, 0, 0);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text("Outcomes:", contentStartX, finalY);
    finalY += 25;
    
    const outcomeText = record.outcomes || record.outcome || "No outcome recorded.";
    
    // Check if we need a new page for outcomes
    const estimatedOutcomeHeight = doc.heightOfString(outcomeText || "No outcome recorded.", {
      width: contentWidth,
      lineGap: 5
    });
    
    if (finalY + estimatedOutcomeHeight + 100 > maxContentY) {
      // Add new page if needed
      doc.addPage();
      addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      doc.fillColor(0, 0, 0);
      finalY = contentStartY;
    }
    
    // Outcome text
    doc.fillColor(0, 0, 0);
    doc.fontSize(11)
       .font('Helvetica')
       .text(outcomeText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
       });

    doc.end();

    // Wait for PDF generation
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // ✅ Upload PDF to Google Drive with counselor name in filename
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const fileName = `${sanitizedCounselorName}_${record.clientName.replace(/\s+/g, '_')}_record_${trackingNumber}.pdf`;
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };
    const media = {
      mimeType: "application/pdf",
      body: fs.createReadStream(pdfPath),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, webViewLink",
    });

    const driveLink = file.data.webViewLink;

    // ✅ Update record in DB
    record.driveLink = driveLink;
    await record.save();

    // ✅ Create notification for admin about PDF generation
    try {
      const userRole = req.user?.role || "counselor";
      const userName = req.user?.name || req.user?.email || record.counselor || "Unknown User";
      
      await createNotification({
        title: "PDF Generated and Uploaded",
        description: `${userName} (${userRole}) has generated and uploaded a PDF for client: ${recordData.clientName}. File: ${fileName}`,
        category: "User Activity",
        priority: "low",
        metadata: {
          clientName: recordData.clientName,
          recordId: recordData._id.toString(),
          pdfFileName: fileName,
          driveLink: driveLink,
          generatedBy: userName,
          generatedByRole: userRole,
        },
        relatedId: recordData._id.toString(),
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed (non-critical):", notificationError);
    }

    // ✅ Clean up local PDF
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      message: "Uploaded to Google Drive successfully",
      driveLink,
    });
  } catch (err) {
    console.error("❌ Drive upload error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 📄 Generate PDF for a single record (download only, no Drive upload)
export const generateRecordPDF = async (req, res) => {
  try {
    // Validate record ID
    if (!req.params.id) {
      return res.status(400).json({ error: "Record ID is required" });
    }

    // Fetch record with all fields - don't use lean() to ensure all fields are available
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    // Convert to plain object to ensure all fields are accessible
    const recordData = {
      _id: record._id,
      clientName: record.clientName || "N/A",
      date: record.date,
      sessionType: record.sessionType || "N/A",
      status: record.status || "N/A",
      counselor: record.counselor || "Unknown Counselor",
      sessionNumber: record.sessionNumber,
      notes: record.notes || null,
      outcomes: record.outcomes || record.outcome || null,
    };

    // Log record data for debugging
    console.log("📋 Generating PDF for record:", {
      id: recordData._id,
      clientName: recordData.clientName,
      date: recordData.date,
      sessionType: recordData.sessionType,
      status: recordData.status,
      counselor: recordData.counselor,
      sessionNumber: recordData.sessionNumber,
      notes: recordData.notes ? recordData.notes.substring(0, 50) + "..." : null,
      outcomes: recordData.outcomes ? recordData.outcomes.substring(0, 50) + "..." : null,
      hasNotes: !!recordData.notes,
      hasOutcomes: !!recordData.outcomes,
    });

    // Validate record has required fields
    if (!recordData.clientName || recordData.clientName === "N/A") {
      return res.status(400).json({ error: "Record is missing required information" });
    }
    
    // Use recordData for all content (avoiding conflict with const record above)

    // Get counselor name for filename
    const counselorName = recordData.counselor || req.user?.name || req.user?.email || req.admin?.name || req.admin?.email || "Unknown_Counselor";
    const sanitizedCounselorName = counselorName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedClientName = (recordData.clientName || "Unknown").replace(/[^a-zA-Z0-9]/g, '_');

    // Generate tracking number
    const trackingNumber = generateTrackingNumber();

    // Generate filename
    const fileName = `${sanitizedCounselorName}_${sanitizedClientName}_${trackingNumber}.pdf`;

    // Create PDF in memory with error handling
    let doc;
    try {
      doc = new PDFDocument({ 
        margin: 0,
        size: 'A4'
      });
    } catch (pdfError) {
      console.error("❌ Error creating PDF document:", pdfError);
      return res.status(500).json({ error: "Failed to initialize PDF generation. Please try again." });
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Handle PDF stream errors
    doc.on('error', (streamError) => {
      console.error("❌ PDF stream error:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error generating PDF. Please try again." });
      }
    });
    
    // Pipe PDF directly to response
    doc.pipe(res);

    // Get page dimensions (A4 = 595.28 x 841.89 points)
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    // Use the same margins as admin reports
    const marginTop = 72; // 2.54 cm
    const marginBottom = 72; // 2.54 cm
    const marginLeft = 54; // 1.91 cm
    const marginRight = 54; // 1.91 cm
    const headerHeight = 55;
    const footerHeight = 60;
    
    const contentStartX = marginLeft;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const contentStartY = marginTop + headerHeight + 40;

    // Add header and footer using helper function
    const reportDate = recordData.date ? new Date(recordData.date).toLocaleDateString() : new Date().toLocaleDateString();
    addRecordHeaderFooter(doc, 1, 1, trackingNumber, reportDate);

    // CRITICAL: Reset fillColor to black after header/footer
    doc.fillColor(0, 0, 0);

    // Start content - ensure we start below header (72 top margin + 55 header + 40 spacing = 167)
    let finalY = contentStartY;
    
    // Verify position is correct
    console.log("Content starting at Y:", finalY, "Page height:", pageHeight);
    
    console.log("📄 PDF Content Position:", {
      contentStartY,
      contentStartX,
      contentWidth,
      pageHeight,
      marginBottom,
      footerHeight,
      recordData: {
        clientName: recordData.clientName,
        date: recordData.date,
        sessionType: recordData.sessionType,
        status: recordData.status,
        counselor: recordData.counselor,
        hasNotes: !!recordData.notes,
        hasOutcomes: !!recordData.outcomes
      }
    });

    // Main Title - Split into two lines like admin reports - "COUNSELING RECORDS" and "REPORT"
    // Explicitly set black color and font
    doc.fillColor(0, 0, 0); // Black color
    doc.strokeColor(0, 0, 0); // Black stroke
    
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0); // Ensure black
    
    console.log("Writing title at Y:", finalY, "contentStartX:", contentStartX, "contentWidth:", contentWidth);
    
    // First line: "COUNSELING RECORDS"
    doc.text("COUNSELING RECORDS", contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center',
      lineGap: 0
    });
    console.log("Wrote 'COUNSELING RECORDS' at Y:", finalY);
    finalY += 28;
    
    // Second line: "REPORT"
    doc.fillColor(0, 0, 0); // Ensure black again
    doc.text("REPORT", contentStartX, finalY, { 
      width: contentWidth, 
      align: 'center',
      lineGap: 0
    });
    console.log("Wrote 'REPORT' at Y:", finalY);
    finalY += 35;
    
    // Add a separator line after title
    doc.strokeColor(200, 200, 200)
       .lineWidth(1)
       .moveTo(contentStartX, finalY - 5)
       .lineTo(contentStartX + contentWidth, finalY - 5)
       .stroke();
    finalY += 20;

    // Client Details Section - Formatted like a table
    const labelWidth = 130;
    const valueStartX = contentStartX + labelWidth;
    
    // Force black color for all content - CRITICAL
    doc.fillColor('black'); // Use string format as backup
    doc.fillColor(0, 0, 0); // Then use RGB
    
    // Client Name
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Client Name:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    const clientNameValue = String(recordData.clientName || "N/A");
    doc.text(clientNameValue, valueStartX, finalY);
    finalY += 22;
    
    // Date
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Date:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    const dateValue = recordData.date ? new Date(recordData.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : "N/A";
    doc.text(dateValue, valueStartX, finalY);
    finalY += 22;
    
    // Session Number
    if (recordData.sessionNumber) {
      doc.font('Helvetica-Bold')
         .fillColor(0, 0, 0);
      doc.text("Session Number:", contentStartX, finalY);
      doc.font('Helvetica')
         .fillColor(0, 0, 0);
      doc.text(String(recordData.sessionNumber), valueStartX, finalY);
      finalY += 22;
    }
    
    // Session Type
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Session Type:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(recordData.sessionType || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Status
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Status:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(recordData.status || "N/A"), valueStartX, finalY);
    finalY += 22;
    
    // Counselor
    doc.font('Helvetica-Bold')
       .fillColor(0, 0, 0);
    doc.text("Counselor:", contentStartX, finalY);
    doc.font('Helvetica')
       .fillColor(0, 0, 0);
    doc.text(String(recordData.counselor || "Unknown Counselor"), valueStartX, finalY);
    finalY += 30;

    // Session Notes Section - explicitly black
    doc.fillColor(0, 0, 0);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text("Session Notes:", contentStartX, finalY);
    finalY += 25;
    
    const notesText = record.notes || "No notes available.";
    
    // Check if we need a new page for notes
    const estimatedNotesHeight = doc.heightOfString(notesText || "No notes available.", {
      width: contentWidth,
      lineGap: 5
    });
    const maxContentY = pageHeight - marginBottom - footerHeight - 80;
    
    if (finalY + estimatedNotesHeight + 100 > maxContentY) {
      // Add new page if needed
      doc.addPage();
      addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      finalY = contentStartY;
    }
    
    // Notes text - explicitly black
    doc.fillColor(0, 0, 0);
    doc.fontSize(11)
       .font('Helvetica')
       .text(notesText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
       });
    
    const notesHeight = doc.heightOfString(notesText, {
      width: contentWidth,
      lineGap: 5
    });
    finalY += notesHeight + 30;

    // Outcomes Section - explicitly black
    doc.fillColor(0, 0, 0);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text("Outcomes:", contentStartX, finalY);
    finalY += 25;
    
    const outcomeText = record.outcomes || record.outcome || "No outcome recorded.";
    
    // Check if we need a new page for outcomes
    const estimatedOutcomeHeight = doc.heightOfString(outcomeText || "No outcome recorded.", {
      width: contentWidth,
      lineGap: 5
    });
    
    if (finalY + estimatedOutcomeHeight + 100 > maxContentY) {
      // Add new page if needed
      doc.addPage();
      addRecordHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      finalY = contentStartY;
    }
    
    // Outcome text - explicitly black
    doc.fillColor(0, 0, 0);
    doc.fontSize(11)
       .font('Helvetica')
       .text(outcomeText, contentStartX, finalY, { 
         width: contentWidth,
         align: 'left',
         lineGap: 5
       });

    // Log what was generated
    console.log("✅ PDF content generated:", {
      hasNotes: !!record.notes,
      notesLength: recordData.notes?.length || 0,
      hasOutcomes: !!recordData.outcomes,
      outcomesLength: recordData.outcomes?.length || 0,
      finalY
    });

    // Finalize PDF
    doc.end();

    // Log activity (optional)
    console.log(`✅ PDF generated for record: ${recordData._id}`);
  } catch (err) {
    console.error("❌ PDF generation error:", err);
    console.error("❌ Error stack:", err.stack);
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: err.message || "Failed to generate PDF. Please try again.",
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    } else {
      // Headers already sent, can't send JSON response
      console.error("❌ Cannot send error response - headers already sent");
      res.end();
    }
  }
};

// 🗑️ Delete a record (for counselors)
export const deleteRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Check if the record belongs to the counselor
    const counselorName = userInfo.userName;
    const counselorEmail = req.user?.email;
    
    // Allow deletion if the record's counselor matches the authenticated user
    const isOwner = record.counselor === counselorName || 
                   record.counselor === counselorEmail ||
                   (req.user?.email && record.counselor === req.user.email) ||
                   (req.user?.name && record.counselor === req.user.name);

    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({ 
        message: "You don't have permission to delete this record. Only the record owner can delete it." 
      });
    }

    // Update audit trail before deletion (soft delete approach)
    if (record.auditTrail) {
      record.auditTrail.deletedBy = userInfo;
      record.auditTrail.deletedAt = new Date();
      await record.save();
    }

    // Delete the record
    await Record.findByIdAndDelete(req.params.id);

    // ✅ Create notification for admins
    try {
      await createNotification({
        title: "Record Deleted",
        description: `${userInfo.userName} (${userInfo.userRole}) deleted record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "high",
        metadata: {
          clientName: record.clientName,
          recordId: req.params.id,
          deletedBy: userInfo.userName,
          deletedByRole: userInfo.userRole,
          sessionNumber: record.sessionNumber,
        },
        relatedId: req.params.id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for the counselor who deleted the record
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Deleted",
          description: `You have successfully deleted the record for ${record.clientName} (Session ${record.sessionNumber}).`,
          category: "System Alert",
          priority: "medium",
          metadata: {
            clientName: record.clientName,
            recordId: req.params.id,
            sessionNumber: record.sessionNumber,
            deletedAt: new Date().toISOString(),
          },
          relatedId: req.params.id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }

    res.status(200).json({ 
      message: "Record deleted successfully",
      deletedRecordId: req.params.id,
    });
  } catch (err) {
    console.error("❌ Error deleting record:", err);
    res.status(500).json({ message: "Failed to delete record", error: err.message });
  }
};