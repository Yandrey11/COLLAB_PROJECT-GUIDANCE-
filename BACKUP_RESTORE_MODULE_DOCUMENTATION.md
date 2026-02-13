# Backup & Restore Module Documentation

## Overview

The Backup & Restore module provides a comprehensive system for creating full database backups and restoring from previous backup points. This module is exclusively available to administrators and provides ACID-safe transactional backup and restore operations.

## Features

### ✅ Core Features

1. **Full System Backup**
   - Creates complete backups of all critical data collections
   - Includes: Records, Users, Admins, Google Users, Reports, Notifications, Activity Logs, Audit Logs
   - ACID-safe transactions ensure data consistency
   - Automatic size calculation and metadata tracking

2. **Backup Management**
   - View all backups with pagination
   - Filter backups by status (success, failed, in_progress, pending)
   - Delete old backups to free up storage
   - Detailed backup information including:
     - Backup ID and name
     - Creation timestamp and admin
     - Backup size
     - Record counts per collection
     - Status indicators

3. **Restore Functionality**
   - Restore system from any successful backup
   - Two-step confirmation process to prevent accidental restores
   - Overwrites current data with backup data
   - Transaction-safe restore operations

4. **Admin-Only Access**
   - All backup/restore operations require admin authentication
   - Protected by `protectAdmin` middleware
   - Audit logging for all backup and restore operations

## Technical Architecture

### Database Schema

#### Backup Model (`backend/models/Backup.js`)

Stores metadata about each backup:

```javascript
{
  backupId: String (unique),
  backupName: String,
  status: Enum (pending, in_progress, success, failed),
  createdBy: {
    adminId: ObjectId,
    adminModel: String,
    adminName: String,
    adminEmail: String
  },
  backupSize: Number (bytes),
  recordCount: Number,
  userCount: Number,
  adminCount: Number,
  reportCount: Number,
  notificationCount: Number,
  activityLogCount: Number,
  auditLogCount: Number,
  collections: [String], // List of backup collection names
  restoredAt: Date,
  restoredBy: {...},
  errorMessage: String,
  metadata: Object,
  timestamps: true
}
```

#### Backup Collections

Backups are stored in separate MongoDB collections with the naming pattern:
- `backup_records_<backupId>`
- `backup_users_<backupId>`
- `backup_admins_<backupId>`
- `backup_googleusers_<backupId>`
- `backup_reports_<backupId>`
- `backup_notifications_<backupId>`
- `backup_activitylogs_<backupId>`
- `backup_auditlogs_<backupId>`

### API Endpoints

#### Create Backup
- **Endpoint:** `POST /api/admin/backups`
- **Auth:** Admin only (JWT token)
- **Response:**
  ```json
  {
    "success": true,
    "message": "Backup created successfully",
    "backup": {
      "backupId": "backup_1234567890_abc123",
      "backupName": "Backup_2024-01-15T10-30-00",
      "status": "success",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "backupSize": 1048576,
      "recordCount": 100,
      "userCount": 50,
      ...
    }
  }
  ```

#### Get All Backups
- **Endpoint:** `GET /api/admin/backups?page=1&limit=10&status=success`
- **Auth:** Admin only
- **Query Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `status`: Filter by status (optional)
- **Response:**
  ```json
  {
    "success": true,
    "backups": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
  ```

#### Get Backup by ID
- **Endpoint:** `GET /api/admin/backups/:backupId`
- **Auth:** Admin only
- **Response:**
  ```json
  {
    "success": true,
    "backup": {...}
  }
  ```

#### Restore Backup
- **Endpoint:** `POST /api/admin/backups/:backupId/restore`
- **Auth:** Admin only
- **Response:**
  ```json
  {
    "success": true,
    "message": "Backup restored successfully",
    "backup": {
      "backupId": "...",
      "backupName": "...",
      "restoredAt": "2024-01-15T11:00:00.000Z"
    }
  }
  ```

#### Delete Backup
- **Endpoint:** `DELETE /api/admin/backups/:backupId`
- **Auth:** Admin only
- **Response:**
  ```json
  {
    "success": true,
    "message": "Backup deleted successfully"
  }
  ```

### Frontend UI

#### Backup & Restore Page (`frontend/src/pages/Admin/BackupRestore.jsx`)

**Features:**
- **Backup Now Button**: Creates a new backup immediately
- **Backup History Table**: Shows all backups with:
  - Backup name and ID
  - Status indicators (✅ Success, ❌ Failed, ⏳ In Progress, ⏸️ Pending)
  - File size
  - Record counts
  - Creation date and admin
  - Action buttons (Restore, Delete)
- **Status Filter**: Filter backups by status
- **Pagination**: Navigate through multiple pages of backups
- **Confirmation Modals**: 
  - Simple confirmation for backup creation
  - Two-step confirmation for restore (with warning modal + type-to-confirm)
  - Confirmation for backup deletion

**Status Colors:**
- 🟢 Green: Successful backup
- 🔴 Red: Failed backup
- 🟡 Yellow: In progress or pending

### Security Features

1. **Admin-Only Access**
   - All routes protected by `protectAdmin` middleware
   - JWT token verification required
   - Automatic redirect to login if unauthorized

2. **Audit Logging**
   - All backup operations logged to AuditLog
   - All restore operations logged to AuditLog
   - All delete operations logged to AuditLog
   - Includes admin info, timestamp, IP address, user agent

3. **Transaction Safety**
   - MongoDB transactions ensure ACID compliance
   - Rollback on any error during backup creation
   - Rollback on any error during restore
   - Prevents partial backups/restores

4. **Restore Safety**
   - Two-step confirmation process
   - Warning modal explaining consequences
   - Type-to-confirm requirement ("RESTORE")
   - Clear messaging about data overwrite

## Collections Backed Up

The following collections are included in every backup:

1. **Records** (`records`)
   - All counseling session records
   - Includes attachments, audit trails, lock status

2. **Users** (`users`)
   - All user accounts
   - Includes permissions, profile data

3. **Admins** (`admins`)
   - All admin accounts
   - Includes admin settings

4. **Google Users** (`googleusers`)
   - Google OAuth user accounts

5. **Reports** (`reports`)
   - Generated report data
   - PDF metadata

6. **Notifications** (`notifications`)
   - Admin notifications

7. **Activity Logs** (`activitylogs`)
   - User activity tracking

8. **Audit Logs** (`auditlogs`)
   - System audit trail

## Usage Guide

### Creating a Backup

1. Navigate to **Backup & Restore** in the Admin Panel
2. Click **Backup Now** button
3. Confirm the backup creation
4. Wait for the backup to complete (status will show "in_progress" then "success")
5. The backup will appear in the history table

### Restoring from a Backup

⚠️ **WARNING**: Restoring will overwrite ALL current system data. This cannot be undone.

1. Navigate to **Backup & Restore** in the Admin Panel
2. Find the backup you want to restore from (must have "success" status)
3. Click **Restore** button
4. Read the warning modal carefully
5. Click "Yes, restore (I understand the risks)"
6. Type "RESTORE" in the confirmation field
7. Click "Confirm Restore"
8. Wait for the restore to complete

### Deleting a Backup

1. Navigate to **Backup & Restore** in the Admin Panel
2. Find the backup you want to delete
3. Click **Delete** button
4. Confirm the deletion
5. The backup and all its collections will be permanently deleted

## Implementation Details

### File Structure

```
backend/
├── models/
│   └── Backup.js                    # Backup metadata model
├── controllers/
│   └── admin/
│       └── backupController.js      # Backup/restore logic
├── routes/
│   └── admin/
│       └── backupRoutes.js          # API routes
└── app.js                           # Route registration

frontend/
├── pages/
│   └── Admin/
│       └── BackupRestore.jsx        # UI component
└── components/
    └── AdminSidebar.jsx             # Updated with Backup link
```

### Key Functions

#### `createBackup(req, res)`
- Starts MongoDB transaction
- Creates backup metadata record
- Copies all collections to backup collections
- Updates backup metadata with counts and size
- Commits transaction on success
- Logs audit trail

#### `restoreBackup(req, res)`
- Starts MongoDB transaction
- Validates backup exists and is successful
- Deletes all existing data from main collections
- Restores data from backup collections
- Updates backup metadata with restore info
- Commits transaction on success
- Logs audit trail

#### `getAllBackups(req, res)`
- Fetches backups with pagination
- Supports status filtering
- Returns formatted backup list

#### `deleteBackup(req, res)`
- Deletes backup metadata
- Drops all backup collections
- Logs audit trail

## Error Handling

- **Backup Creation Errors**: Transaction rollback, status set to "failed", error message stored
- **Restore Errors**: Transaction rollback, error returned to client
- **Missing Backup**: 404 error returned
- **Invalid Status**: 400 error returned (can't restore from failed backup)
- **Network Errors**: Proper error messages displayed to admin

## Performance Considerations

1. **Backup Size**: Large databases may take several minutes to backup
2. **Restore Time**: Restore operations may take time depending on data volume
3. **Storage**: Backups use additional storage space - old backups should be deleted periodically
4. **Concurrent Operations**: Only one backup/restore operation should run at a time (not enforced yet)

## Future Enhancements

1. **Scheduled Backups**: Automatic daily/weekly backups
2. **Cloud Backup Integration**: Export to Google Drive or other cloud storage
3. **Backup Compression**: Compress backups to reduce storage
4. **Incremental Backups**: Only backup changes since last backup
5. **Backup Export**: Download backup as SQL/JSON file
6. **Backup Retention Policies**: Automatic deletion of old backups
7. **Backup Validation**: Verify backup integrity before marking as success

## Testing

### Manual Testing Checklist

- [ ] Create a backup successfully
- [ ] View backup list with pagination
- [ ] Filter backups by status
- [ ] Restore from a backup (test data overwrite)
- [ ] Delete a backup
- [ ] Test error handling (invalid backup ID, etc.)
- [ ] Verify audit logs are created
- [ ] Test admin-only access (try as non-admin)
- [ ] Test confirmation modals

### API Testing

```bash
# Create backup
curl -X POST http://localhost:5000/api/admin/backups \
  -H "Authorization: Bearer <admin_token>"

# Get all backups
curl http://localhost:5000/api/admin/backups \
  -H "Authorization: Bearer <admin_token>"

# Restore backup
curl -X POST http://localhost:5000/api/admin/backups/<backupId>/restore \
  -H "Authorization: Bearer <admin_token>"

# Delete backup
curl -X DELETE http://localhost:5000/api/admin/backups/<backupId> \
  -H "Authorization: Bearer <admin_token>"
```

## Notes

- Backups are stored in the same MongoDB database as the main data
- Backup collections are prefixed with `backup_` to avoid naming conflicts
- Restore operations overwrite ALL data in the main collections
- Backup operations are ACID-safe using MongoDB transactions
- Only successful backups can be restored from
- Failed backups retain error messages for debugging

## Support

For issues or questions about the Backup & Restore module, contact the system administrator.

