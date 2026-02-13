# Analytics Integration Guide

This guide shows how to integrate analytics logging into existing controllers and components.

## Quick Integration Examples

### 1. Record Creation

**File:** `backend/controllers/recordController.js`

```javascript
import { logRecordCreated } from "../utils/analyticsLogger.js";

export const createRecord = async (req, res) => {
  try {
    // ... existing code ...
    const record = new Record({ ... });
    await record.save();
    
    // Add this line after record.save()
    await logRecordCreated(req.user, record._id, {
      clientName: record.clientName,
      sessionNumber: record.sessionNumber,
    });
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 2. Record Update

**File:** `backend/controllers/recordController.js`

```javascript
import { logRecordUpdated } from "../utils/analyticsLogger.js";

export const updateRecord = async (req, res) => {
  try {
    // ... existing code ...
    await record.save();
    
    // Add this line after record.save()
    await logRecordUpdated(req.user, record._id, {
      clientName: record.clientName,
      changes: Object.keys(req.body),
    });
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 3. Record Lock/Unlock

**File:** `backend/controllers/admin/recordLockController.js`

```javascript
import { logRecordLocked } from "../utils/analyticsLogger.js";

export const lockRecord = async (req, res) => {
  try {
    // ... existing code ...
    await lock.save();
    
    // Add this line
    await logRecordLocked(req.admin || req.user, recordId, "locked");
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};

export const unlockRecord = async (req, res) => {
  try {
    // ... existing code ...
    lock.isActive = false;
    await lock.save();
    
    // Add this line
    await logRecordLocked(req.admin || req.user, recordId, "unlocked");
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 4. PDF Generation

**File:** `backend/controllers/recordController.js` or report controller

```javascript
import { logPDFGenerated } from "../utils/analyticsLogger.js";

export const generatePDF = async (req, res) => {
  try {
    // ... PDF generation code ...
    
    // Add this line after PDF is generated
    await logPDFGenerated(req.user, {
      recordId: record._id?.toString(),
      fileName: pdfFileName,
      fileSize: pdfBuffer.length,
    });
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 5. Google Drive Upload

**File:** `backend/controllers/recordController.js`

```javascript
import { logDriveUpload } from "../utils/analyticsLogger.js";

const uploadRecordToDrive = async (record, req) => {
  try {
    // ... upload code ...
    
    // Add this line after successful upload
    await logDriveUpload(req.user, {
      recordId: record._id.toString(),
      fileId: fileId,
      fileName: fileName,
    });
    
    return driveLink;
  } catch (error) {
    // ... error handling ...
  }
};
```

### 6. User Login

**File:** `backend/controllers/admin/adminLoginController.js` or auth controller

```javascript
import { logLogin } from "../utils/analyticsLogger.js";

export const adminLogin = async (req, res) => {
  try {
    // ... login validation ...
    
    // After successful login, add this line
    await logLogin(req, admin);
    
    res.status(200).json({ success: true, token, admin });
  } catch (error) {
    // ... error handling ...
  }
};
```

### 7. User Logout

Add to logout controller or middleware:

```javascript
import { logLogout } from "../utils/analyticsLogger.js";

export const logout = async (req, res) => {
  try {
    const user = req.user || req.admin;
    
    // Log logout event
    if (user) {
      await logLogout(req, user);
    }
    
    // ... rest of logout logic ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 8. Report Generation

**File:** `backend/controllers/reportController.js`

```javascript
import { logReportGenerated } from "../utils/analyticsLogger.js";

export const generateReport = async (req, res) => {
  try {
    // ... report generation code ...
    
    // Add this line after report is generated
    await logReportGenerated(req.user, {
      reportType: "client_report",
      clientName: clientName,
      recordCount: records.length,
    });
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 9. Backup Operations

**File:** `backend/controllers/admin/backupController.js`

```javascript
import { logAnalyticsEvent } from "../utils/analyticsLogger.js";

export const createBackup = async (req, res) => {
  try {
    // ... backup creation code ...
    
    // Add this line after successful backup
    await logAnalyticsEvent({
      eventType: "backup_created",
      user: req.admin,
      metadata: {
        backupId: backup.backupId,
        backupSize: totalSize,
      },
    });
    
    // ... rest of code ...
  } catch (error) {
    // ... error handling ...
  }
};
```

### 10. Frontend Page Visits

**File:** Any frontend page component (e.g., `frontend/src/pages/Dashboard.jsx`)

```javascript
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

useEffect(() => {
  // Log page visit when component mounts
  const logPageVisit = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.post(
        `${BASE_URL}/api/analytics/log-event`,
        {
          eventType: "page_visit",
          pageName: "Dashboard",
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
    } catch (error) {
      // Fail silently - don't interrupt user experience
      console.error("Failed to log page visit:", error);
    }
  };

  logPageVisit();
}, []); // Run once on mount
```

## Integration Checklist

Add analytics logging to these controllers/components:

### Backend Controllers

- [ ] `backend/controllers/recordController.js`
  - [ ] `createRecord` - log `record_created`
  - [ ] `updateRecord` - log `record_updated`
  - [ ] PDF generation - log `pdf_generated`
  - [ ] Drive upload - log `drive_uploaded`

- [ ] `backend/controllers/admin/recordLockController.js`
  - [ ] `lockRecord` - log `record_locked`
  - [ ] `unlockRecord` - log `record_unlocked`

- [ ] `backend/controllers/admin/adminRecordController.js`
  - [ ] `deleteRecord` - log `record_deleted`

- [ ] `backend/controllers/reportController.js`
  - [ ] `generateReport` - log `report_generated`

- [ ] `backend/controllers/admin/adminLoginController.js`
  - [ ] `adminLogin` - log `user_login`

- [ ] `backend/controllers/admin/backupController.js`
  - [ ] `createBackup` - log `backup_created`
  - [ ] `restoreBackup` - log `backup_restored`

### Frontend Pages

- [ ] `frontend/src/pages/Dashboard.jsx` - log `page_visit` for "Dashboard"
- [ ] `frontend/src/pages/RecordsPage.jsx` - log `page_visit` for "Records Page"
- [ ] `frontend/src/pages/ReportsPage.jsx` - log `page_visit` for "Reports Page"
- [ ] `frontend/src/pages/NotificationCenter.jsx` - log `page_visit` for "Notification Center"
- [ ] `frontend/src/pages/SettingsPage.jsx` - log `page_visit` for "Settings"
- [ ] `frontend/src/pages/Admin/AdminDashboard.jsx` - log `page_visit` for "Admin Dashboard"
- [ ] `frontend/src/pages/Admin/UserManagement.jsx` - log `page_visit` for "User Management"
- [ ] `frontend/src/pages/Admin/AdminRecordManagement.jsx` - log `page_visit` for "Record Management"

## Notes

1. **Non-blocking**: Analytics logging is asynchronous and won't block user requests
2. **Error Handling**: Analytics failures should not interrupt normal operations
3. **Metadata**: Include relevant metadata in events for better analytics
4. **User Context**: Always pass the user object when available
5. **Page Names**: Use consistent page names across the application

## Testing

After integrating analytics logging:

1. Perform actions (create records, generate PDFs, etc.)
2. Check the Analytics Dashboard to verify events appear
3. Test different date ranges and filters
4. Verify events are logged with correct metadata

## Need Help?

Refer to `ANALYTICS_MODULE_DOCUMENTATION.md` for detailed API documentation and troubleshooting.

