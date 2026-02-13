# RBAC (Role-Based Access Control) Documentation

## Overview

This document describes the complete RBAC implementation for the counseling record-keeping system. The system supports two roles: **Admin** and **Counselor**, with fine-grained permissions for accessing Records and Reports functionality.

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [Permissions](#permissions)
4. [API Endpoints](#api-endpoints)
5. [Middleware](#middleware)
6. [Frontend UI](#frontend-ui)
7. [Audit Logging](#audit-logging)
8. [Migration Guide](#migration-guide)
9. [Testing](#testing)
10. [Edge Cases & Safety](#edge-cases--safety)

---

## Architecture

### Roles

- **Admin**: Has full access to all features and can manage user permissions
- **Counselor**: Limited access based on assigned permissions

### Permission System

Permissions are stored at the user level and can be configured individually. The system supports:
- Granular permission flags
- Default permissions for new users
- Immediate permission enforcement
- Audit logging of all changes

---

## Database Schema

### User Models

All user models (`User`, `GoogleUser`, `Admin`) include a `permissions` object:

```javascript
permissions: {
  can_view_records: Boolean (default: true for counselors, true for admins)
  can_edit_records: Boolean (default: true for counselors, true for admins)
  can_view_reports: Boolean (default: true for counselors, true for admins)
  can_generate_reports: Boolean (default: false for counselors, true for admins)
  is_admin: Boolean (default: false, true for admins)
}
```

### Audit Log Model

Created in `backend/models/AuditLog.js`:

```javascript
{
  actorAdminId: ObjectId (who made the change)
  actorName: String
  actorEmail: String
  targetUserId: ObjectId (whose permissions changed)
  targetUserName: String
  targetUserEmail: String
  action: String (e.g., "permission_update")
  changedPermissions: Object (what changed: from→to)
  ipAddress: String
  userAgent: String
  metadata: Object
  timestamps: createdAt, updatedAt
}
```

---

## Permissions

### Permission Flags

| Permission | Description | Default (Counselor) | Default (Admin) |
|------------|-------------|---------------------|-----------------|
| `can_view_records` | View Records page and browse session records | ✅ true | ✅ true |
| `can_edit_records` | Create, edit, and delete session records | ✅ true | ✅ true |
| `can_view_reports` | View Reports page and browse generated reports | ✅ true | ✅ true |
| `can_generate_reports` | Generate new reports for clients | ❌ false | ✅ true |
| `is_admin` | Admin privileges (all permissions) | ❌ false | ✅ true |

### Permission Hierarchy

- Admins (`is_admin: true` or `role: "admin"`) automatically have all permissions
- `can_edit_records` requires `can_view_records` (enforced in UI)
- `can_generate_reports` requires `can_view_reports` (enforced in UI)

---

## API Endpoints

### Get User Permissions

```
GET /api/admin/users/:userId/permissions
Authorization: Bearer {adminToken}
```

**Response:**
```json
{
  "userId": "...",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "role": "counselor",
  "permissions": {
    "can_view_records": true,
    "can_edit_records": true,
    "can_view_reports": true,
    "can_generate_reports": false,
    "is_admin": false
  }
}
```

### Update User Permissions

```
PUT /api/admin/users/:userId/permissions
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "permissions": {
    "can_view_records": true,
    "can_edit_records": false,
    "can_view_reports": true,
    "can_generate_reports": true,
    "is_admin": false
  }
}
```

**Response:**
```json
{
  "message": "Permissions updated successfully",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "counselor",
    "permissions": { ... }
  },
  "changes": {
    "can_edit_records": { "from": true, "to": false },
    "can_generate_reports": { "from": false, "to": true }
  }
}
```

### Protected Endpoints

All Records and Reports endpoints now require appropriate permissions:

**Records:**
- `GET /api/records` - Requires `can_view_records`
- `POST /api/records` - Requires `can_edit_records`
- `PUT /api/records/:id` - Requires `can_edit_records`
- `DELETE /api/records/:id` - Requires `can_edit_records`

**Reports:**
- `GET /api/reports` - Requires `can_view_reports`
- `GET /api/reports/:clientName` - Requires `can_view_reports`
- `POST /api/reports/generate` - Requires `can_generate_reports`

---

## Middleware

### Authorization Middleware

Location: `backend/middleware/permissionMiddleware.js`

#### Single Permission Check

```javascript
import { authorize } from "../middleware/permissionMiddleware.js";

router.get("/records", protect, authorize("can_view_records"), getRecords);
```

#### Multiple Permissions (ALL required)

```javascript
import { authorizeAll } from "../middleware/permissionMiddleware.js";

router.post("/reports", protect, authorizeAll(["can_view_reports", "can_generate_reports"]), generateReport);
```

#### Multiple Permissions (ANY required)

```javascript
import { authorizeAny } from "../middleware/permissionMiddleware.js";

router.get("/data", protect, authorizeAny(["can_view_records", "can_view_reports"]), getData);
```

### How It Works

1. Extracts user from JWT token (via `protect` middleware)
2. Checks if user is admin (admins bypass all checks)
3. Validates required permission(s) exist
4. Logs denied access attempts to audit log
5. Returns 403 Forbidden if permission missing

---

## Frontend UI

### Admin User Management Page

Location: `frontend/src/pages/Admin/UserManagement.jsx`

#### Features

1. **Edit Permissions Button**
   - Appears in Actions column for non-admin users
   - Opens permissions modal

2. **Permissions Modal**
   - Checkboxes for each permission
   - Inline help text explaining each permission
   - Validation (edit requires view, generate requires view)
   - Confirmation dialog when removing critical access

3. **Permission Badges**
   - Visual indicators in Permissions column
   - Shows current permission status at a glance
   - Color-coded badges (green=allowed, red=restricted)

#### Modal Checkboxes

- ✅ **Allow Records Page Access** (`can_view_records`)
  - Description: "Grants access to view the Records page and browse session records."
  
- ✅ **Allow Edit Records** (`can_edit_records`)
  - Description: "Allows creating, editing, and deleting session records."
  - Disabled if Records access is removed
  
- ✅ **Allow Reports Page Access** (`can_view_reports`)
  - Description: "Grants access to view the Reports page and browse generated reports."
  
- ✅ **Allow Generate Reports** (`can_generate_reports`)
  - Description: "Allows generating new reports for clients."
  - Disabled if Reports access is removed

### Frontend Route Protection (Optional)

While backend enforces permissions, frontend can also check permissions before rendering pages:

```javascript
// Example: Check permission before accessing Records page
useEffect(() => {
  const checkPermission = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.permissions?.can_view_records) {
      Swal.fire({
        icon: "warning",
        title: "Access Denied",
        text: "You don't have permission to access the Records page.",
      });
      navigate("/dashboard");
    }
  };
  checkPermission();
}, []);
```

**Note:** Backend will still return 403 if permissions are missing, so this is optional UX improvement.

---

## Audit Logging

### What Gets Logged

1. **Permission Changes**
   - Who changed permissions (actor)
   - Whose permissions changed (target)
   - What changed (from → to)
   - IP address and user agent
   - Timestamp

2. **Denied Access Attempts**
   - User attempting access
   - Required permission
   - Endpoint attempted
   - Timestamp

### Audit Log Model

See `backend/models/AuditLog.js` for schema details.

### Querying Audit Logs

```javascript
import AuditLog from "../models/AuditLog.js";

// Get all permission changes for a user
const logs = await AuditLog.find({
  targetUserId: userId,
  action: "permission_update"
}).sort({ createdAt: -1 });

// Get all changes made by an admin
const adminLogs = await AuditLog.find({
  actorAdminId: adminId
}).sort({ createdAt: -1 });
```

---

## Migration Guide

### Running the Migration Script

The migration script adds default permissions to all existing users:

```bash
# Set MongoDB URI (optional, defaults to localhost)
export MONGODB_URI="mongodb://localhost:27017/counseling_db"

# Run migration
node backend/scripts/migratePermissions.js
```

### What the Migration Does

1. Connects to MongoDB
2. Updates all `User` documents with default permissions
3. Updates all `GoogleUser` documents with default permissions
4. Updates all `Admin` documents (sets all permissions to true)
5. Prints summary of changes

### Post-Migration

- All existing users will have default permissions set
- Admins will have all permissions enabled
- Counselors will have view/edit records, view reports (generate=false)

---

## Testing

### Manual Test Cases

#### 1. Admin Can Update Permissions

**Steps:**
1. Login as Admin
2. Navigate to User Management
3. Click "Permissions" button for a Counselor
4. Toggle permissions and click Save

**Expected:**
- Modal opens with current permissions
- Changes save successfully
- Success message appears
- User receives notification (if online)

#### 2. Permission Enforcement on Records

**Steps:**
1. As Admin, revoke `can_view_records` from a Counselor
2. Login as that Counselor
3. Navigate to `/records`

**Expected:**
- Backend returns 403 Forbidden
- Error message displayed

#### 3. Permission Enforcement on Reports

**Steps:**
1. As Admin, revoke `can_generate_reports` from a Counselor (keep view)
2. Login as that Counselor
3. Try to generate a report

**Expected:**
- Generate button disabled/hidden or shows error
- Backend returns 403 if endpoint called

#### 4. Last Admin Protection

**Steps:**
1. Ensure only one Admin exists
2. Try to remove `is_admin` from that Admin

**Expected:**
- Error message: "Cannot remove admin privileges. At least one admin must remain."
- Permission not changed

#### 5. Audit Logging

**Steps:**
1. As Admin, update a Counselor's permissions
2. Check audit log

**Expected:**
- Audit entry created with:
  - Actor (admin) details
  - Target (counselor) details
  - Changed permissions (from → to)
  - IP address and timestamp

### Unit Tests

```javascript
// Example test for permission middleware
describe("authorize middleware", () => {
  it("should allow access with correct permission", async () => {
    const user = { permissions: { can_view_records: true } };
    // Mock req.user = user
    // Call middleware
    // Expect next() to be called
  });

  it("should deny access without permission", async () => {
    const user = { permissions: { can_view_records: false } };
    // Mock req.user = user
    // Call middleware
    // Expect 403 response
  });
});
```

### Integration Tests

```javascript
// Example API test
describe("PUT /api/admin/users/:id/permissions", () => {
  it("should update permissions successfully", async () => {
    const adminToken = await getAdminToken();
    const counselorId = await createCounselor();
    
    const response = await request(app)
      .put(`/api/admin/users/${counselorId}/permissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        permissions: {
          can_view_records: true,
          can_edit_records: false,
          can_view_reports: true,
          can_generate_reports: false,
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.user.permissions.can_edit_records).toBe(false);
  });
});
```

---

## Edge Cases & Safety

### 1. Last Admin Protection

**Scenario:** Only one admin exists in the system.

**Protection:**
- API checks admin count before allowing `is_admin` removal
- Returns error: "Cannot remove admin privileges. At least one admin must remain."

**Implementation:**
```javascript
const adminCount = await Admin.countDocuments({ "permissions.is_admin": true });
const userAdminCount = await User.countDocuments({ 
  "permissions.is_admin": true, 
  role: "admin",
  _id: { $ne: userId }
});

if (adminCount + userAdminCount === 0) {
  return res.status(400).json({
    message: "Cannot remove admin privileges. This is the only admin in the system."
  });
}
```

### 2. Permission Removal During Active Session

**Scenario:** Admin removes permissions while user is actively using a page.

**Behavior:**
- Permission changes take effect on next API call
- User will receive 403 on next request
- Notification sent to user about permission change
- User should be notified and redirected

**Recommendation:**
- Implement frontend permission checks on page load
- Show warning message if permissions changed
- Redirect to dashboard if critical permission removed

### 3. Self-Demotion Protection

**Scenario:** Admin tries to remove their own admin privileges.

**Protection:**
- API checks if target user is the same as actor
- Requires additional confirmation for self-demotion
- Prevents accidental lockout

### 4. Concurrent Permission Updates

**Scenario:** Multiple admins update same user's permissions simultaneously.

**Behavior:**
- Last write wins (MongoDB default)
- Audit log records both changes
- Consider optimistic locking for production

### 5. Missing Permissions Field

**Scenario:** Old user records don't have permissions field.

**Protection:**
- Migration script adds default permissions
- Pre-save hooks set defaults for new users
- API defaults to true for missing permissions (backwards compatible)

---

## Notification System

### Permission Change Notifications

When permissions are updated, the system:

1. **Creates Notification**
   - Title: "Permission Updated"
   - Description: Details what changed
   - Priority: High
   - Category: System Alert

2. **Sends to Affected User**
   - Only for Counselors (admins don't need notifications)
   - Includes timestamp and admin name

3. **Notification Format:**
   ```
   Your access to Records Page was granted/removed by Admin [Name] on [Date/Time].
   ```

### Email Notifications (Optional)

For critical permission removals, consider sending email:
- `can_view_records` removed
- `can_view_reports` removed
- Account deactivated

---

## API Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Permission updated successfully |
| 400 | Bad Request | Invalid permission keys or values |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | User not found |
| 500 | Server Error | Database error, etc. |

---

## Security Considerations

1. **JWT Tokens**: Permissions are not stored in JWT (for security). Permissions are checked server-side on each request.

2. **Cache Invalidation**: If using token caching, invalidate on permission change or read fresh permissions from database.

3. **Rate Limiting**: Consider rate limiting on permission update endpoints to prevent abuse.

4. **IP Logging**: All permission changes log IP address for audit trail.

5. **Input Validation**: All permission values validated (must be booleans, only allowed keys).

---

## Troubleshooting

### Permission Changes Not Taking Effect

**Possible Causes:**
- User token cached (permissions checked server-side, should work)
- Browser cache (clear cache, refresh)
- User needs to logout/login

**Solution:**
- Permissions are checked server-side, so they should work immediately
- Consider forcing token refresh on permission change

### 403 Errors on All Requests

**Possible Causes:**
- User permissions not set (migration not run)
- User model doesn't have permissions field

**Solution:**
- Run migration script
- Check user document in database has permissions object

### Audit Logs Not Creating

**Possible Causes:**
- AuditLog model not registered
- Database connection issue
- Error in audit log creation (non-critical, logged to console)

**Solution:**
- Check console for audit log errors
- Verify AuditLog model is imported correctly
- Check MongoDB connection

---

## Future Enhancements

1. **Permission Templates**: Predefined permission sets (e.g., "View Only", "Full Access")
2. **Permission Groups**: Assign permissions to groups, assign users to groups
3. **Time-Based Permissions**: Temporary permissions with expiry dates
4. **Permission History UI**: Admin view of all permission changes
5. **Bulk Permission Updates**: Update multiple users at once
6. **Frontend Route Guards**: React Router guards based on permissions
7. **Permission Inheritance**: Hierarchical permission system

---

## Contact & Support

For questions or issues:
- Check audit logs for permission changes
- Review API error responses
- Check server console for detailed errors
- Verify user permissions in database

---

**Last Updated:** [Current Date]
**Version:** 1.0.0


