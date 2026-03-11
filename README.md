# Guidance Counseling Record Management System

A comprehensive full-stack web application for managing guidance counseling records, analytics, and notifications with role-based access control and multi-OAuth authentication.

## System Overview

The Guidance Counseling Record Management System is a modern, secure platform designed for educational institutions to manage student guidance counseling services. It provides tools for counselors to maintain detailed records, track student progress, manage appointments, and generate reports—all while maintaining strict data privacy and audit trails.

### Key Capabilities

- **Record Management**: Create, read, update, and delete counseling records with rich metadata
- **Multi-channel Authentication**: Local auth, Google OAuth 2.0, GitHub, and Facebook
- **Role-Based Access Control (RBAC)**: Admin, counselor, and student roles with granular permissions
- **Notifications System**: Real-time counselor notifications with customizable settings
- **Google Integration**: Drive file management and Calendar synchronization
- **Analytics & Reporting**: System-wide analytics, PDF report generation, and audit logging
- **File Management**: Secure file uploads with Multer-based handling
- **Admin Dashboard**: Comprehensive admin interface for system management
- **Email Notifications**: Automated email alerts via Nodemailer

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer (Browser)                  │
│  React + Vite + Tailwind CSS + Responsive UI Components    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/WebSocket
┌────────────────────▼────────────────────────────────────────┐
│              Express.js REST API (Backend)                   │
│     Controllers → Middleware → Routes → Authentication      │
└────────────────────┬────────────────────────────────────────┘
                     │ Drivers/Protocols
┌────────────────────▼────────────────────────────────────────┐
│                  Data & External Services                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  MongoDB     │  │  Google APIs │  │   Nodemailer │      │
│  │  (Persistent)│  │ (Drive/OAuth)│  │   (Email)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Hooks/Context
- **HTTP Client**: Axios
- **Routing**: React Router

### Backend
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js v5.1.0
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js (Local, OAuth strategies)
- **Session Management**: express-session with MongoDB store
- **File Uploads**: Multer
- **Email**: Nodemailer
- **PDF Generation**: PDFKit
- **Async HTTP**: Axios
- **Environment Config**: dotenv

### Infrastructure
- **Database**: MongoDB (local or Atlas cloud)
- **Authentication**: Passport.js + OAuth providers (Google, GitHub, Facebook)
- **File Storage**: Server uploads directory
- **Email Service**: SMTP-compatible email provider

## Project Structure

```
COLLAB_PROJECT/
├── README.md                              # Root documentation
├── API_DOCUMENTATION.md                   # API endpoints reference
├── RBAC_DOCUMENTATION.md                  # Role-based access control guide
├── INTEGRATIONS_SETUP_GUIDE.md           # OAuth and Google setup
├── various_documentation_files.md         # Additional guides and reports
│
├── backend/                               # Node.js/Express Backend
│   ├── app.js                            # Main application entry point
│   ├── package.json                      # Dependencies & scripts
│   ├── .env                              # Environment variables (not in repo)
│   │
│   ├── config/                           # Configuration modules
│   │   ├── db.js                         # MongoDB connection
│   │   ├── googleDrive.js
│   │   ├── googleOAuth.js
│   │   ├── passport.js
│   │   ├── adminPassport.js
│   │   └── google-service-account.json
│   │
│   ├── controllers/                      # Request handlers
│   │   ├── authController.js
│   │   ├── recordController.js
│   │   ├── profileController.js
│   │   ├── counselorNotificationController.js
│   │   ├── counselorSettingsController.js
│   │   ├── googleAuthController.js
│   │   ├── googleCalendarController.js
│   │   ├── googleDriveAuthController.js
│   │   ├── reportController.js
│   │   └── admin/                        # Admin-specific controllers
│   │
│   ├── models/                           # Mongoose schemas
│   │   ├── User.js
│   │   ├── Record.js
│   │   ├── Admin.js
│   │   ├── CounselorSettings.js
│   │   ├── CounselorNotification.js
│   │   ├── AuditLog.js
│   │   ├── AnalyticsEvent.js
│   │   └── ... (15+ data models)
│   │
│   ├── routes/                           # API route definitions
│   │   ├── auth.js
│   │   ├── records.js
│   │   ├── profile.js
│   │   └── ... (organized by feature)
│   │
│   ├── middleware/                       # Custom middleware
│   │   ├── authMiddleware.js             # Protected routes
│   │   ├── permissionMiddleware.js       # Role-based access
│   │   ├── uploadMiddleware.js           # File upload handling
│   │   ├── inactivityMiddleware.js       # Session management
│   │   └── admin/                        # Admin middleware
│   │
│   ├── utils/                            # Utility functions
│   ├── scripts/                          # One-off scripts
│   ├── temp/                             # Temporary files
│   └── uploads/                          # User file storage
│
└── frontend/                              # React/Vite Frontend
    ├── package.json                      # Dependencies & scripts
    ├── vite.config.js                    # Vite configuration
    ├── tailwind.config.js                # Tailwind CSS config
    ├── postcss.config.js
    ├── eslint.config.js
    ├── index.html                        # HTML entry point
    ├── LoginSignup.jsx                   # Auth component
    │
    ├── src/                              # Source code
    │   ├── main.jsx                      # React app entry point
    │   ├── App.jsx                       # Main App component
    │   ├── pages/                        # Page components
    │   ├── components/                   # Reusable components
    │   ├── hooks/                        # Custom React hooks
    │   ├── context/                      # Context providers
    │   ├── services/                     # API service functions
    │   ├── utils/                        # Helper functions
    │   ├── styles/                       # Global styles
    │   └── assets/                       # Images, icons, etc.
    │
    ├── public/                           # Static assets
    └── docs/                             # Frontend documentation
```

## System Requirements

### Prerequisites

- **Node.js**: v16 or higher
- **npm** or **yarn**: Latest LTS version
- **MongoDB**: v4.4+ (local instance or MongoDB Atlas cloud)
- **Git**: For version control

### Optional Integrations

- **Google Account**: For OAuth and Google Drive/Calendar integration
- **GitHub Account**: For GitHub OAuth
- **Facebook Account**: For Facebook OAuth
- **Email Server**: SMTP credentials for email notifications

## Installation & Setup

### Step 1: Clone & Navigate

```bash
git clone <repository-url>
cd COLLAB_PROJECT
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file with required variables
cat > .env << EOF
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/counseling_system
MONGO_URI_DIRECT=
JWT_SECRET=your_secure_jwt_secret_here
SESSION_SECRET=your_secure_session_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/auth/github/callback
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EOF

# Start development server
npm run dev
# Or production: npm start
```

**Backend runs on**: `http://localhost:5000` (or the `PORT` set in your `.env`)

### Step 3: Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file for frontend (optional)
cat > .env.local << EOF
VITE_API_URL=http://localhost:5000
EOF

# Start development server
npm run dev
```

**Frontend runs on**: `http://localhost:5173` (or provided Vite URL)

If your backend runs on a different port (for example `5050`), set `VITE_API_URL` to that exact backend URL.

### Step 4: Verify Setup

1. Open frontend: `http://localhost:5173`
2. Try registering or logging in with a local account
3. Check backend logs for any connection issues

## Database Setup

### Option 1: Local MongoDB

```bash
# Start MongoDB service (Windows)
net start MongoDB

# Or on Linux/Mac
brew services start mongodb-community
# or
mongod
```

### Option 2: MongoDB Atlas (Cloud)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster and database
3. Get connection string
4. Set `MONGO_URI` in backend `.env`

## Core Features

### User Authentication
- **Local Auth**: Email/password registration and login
- **OAuth 2.0**: Google, GitHub, Facebook integrations
- **JWT Tokens**: Secure stateless authentication
- **Session Management**: Express-session with MongoDB persistence
- **Password Security**: Bcryptjs hashing with salt rounds

### Record Management
- **CRUD Operations**: Full lifecycle management of counseling records
- **Rich Metadata**: Student info, session notes, outcomes, follow-ups
- **Session Auto-numbering**: Session number calculated automatically per client on record creation
- **Search & Filter**: Advanced filtering by date, counselor, student, status
- **Strict 2PL Locking**: Records must be locked before editing; lock ownership is validated server-side
- **Auto Google Drive Upload**: New records automatically generate a PDF and upload it to the counselor's Drive
- **Auto Google Calendar Sync**: New records sync to Google Calendar; updates to date, client, session type, or status re-sync automatically
- **PDF Generation**: Branded A4 PDFs with document tracking numbers, blue header/footer, and confidentiality footer
- **Bulk Sync**: Sync all existing records missing Drive links, or bulk-sync all records to Google Calendar

### Role-Based Access Control
- **Admin**: Full system access, user management, analytics
- **Counselor**: Record creation, profile management, notifications
- **Student**: View own records, schedule appointments
- **Guest**: Limited public information access

### Notifications
- **Real-time Alerts**: Counselor notifications for new records
- **Settings Management**: Notification preferences per user
- **Email Integration**: Automated email notifications
- **Activity Log**: Full audit trail of all system actions

### Reporting & Analytics
- **PDF Reports**: Generate downloadable counseling reports
- **System Analytics**: Dashboard with system-wide metrics
- **Audit Logs**: Track all user actions and changes
- **Daily Summaries**: Automated daily report generation

### Google Integration
- **Google Drive**: Upload counseling PDFs automatically or on demand
- **Google Calendar**: Sync sessions as calendar events; creates or updates events on record save
- **OAuth Flow**: Seamless account linking for counselors
- **Token Management**: Automatic refresh token handling with encrypted token storage
- **3-Tier Drive Auth Fallback**: 1) User's own connected Google OAuth tokens; 2) System-level OAuth via `GOOGLE_REFRESH_TOKEN` env var; 3) Service account credentials (`google-service-account.json`)
- **Drive Folder Fallback**: If the configured Drive folder is inaccessible, automatically creates or uses a "Counseling Records" folder

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `GET /auth/google` - Google OAuth initiation
- `GET /auth/google/callback` - Google OAuth callback
- `POST /auth/logout` - Logout user

### Records
- `GET /records` - List all records (supports search, sessionType, status, date range, sort)
- `POST /records` - Create new record (auto-uploads PDF to Drive, syncs to Google Calendar)
- `PUT /records/:id` - Update record (requires lock ownership via Strict 2PL)
- `DELETE /records/:id` - Delete record
- `GET /records/:id/generate-pdf` - Download record as PDF
- `POST /records/:id/upload-drive` - Upload record PDF to Google Drive
- `POST /records/:id/lock` - Lock record for editing
- `POST /records/:id/unlock` - Unlock record
- `POST /records/:id/start-editing` - Auto-lock when editing begins
- `GET /records/:id/lock-status` - Get current lock status
- `GET /records/:id/lock-logs` - Get lock/unlock history for a record
- `GET /records/lock-logs/all` - Get all recent lock/unlock logs
- `POST /records/sync-drive` - Bulk-upload records missing Drive links
- `POST /records/sync-google-calendar` - Bulk-sync all records to Google Calendar

### Profile
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `POST /profile/change-password` - Change password

### Counselor Features
- `GET /counselor/notifications` - Get notifications
- `PUT /counselor/settings` - Update settings
- `POST /counselor/report` - Generate report

### Admin
- `GET /admin/users` - List all users
- `POST /admin/users/:id/role` - Update user role
- `GET /admin/analytics` - System analytics
- `GET /admin/audit-logs` - View audit logs

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete endpoint reference.

## Environment Variables

```
# Server Configuration
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/counseling_system
MONGO_URI_DIRECT=

# Security & Sessions
JWT_SECRET=your_jwt_secret_min_32_chars
SESSION_SECRET=your_session_secret_min_32_chars

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Google Drive (optional)
# System-level refresh token for Drive uploads when users have no OAuth tokens
GOOGLE_REFRESH_TOKEN=
# Redirect URI used when obtaining Drive OAuth tokens
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5000/auth/google/callback
# Target folder ID in Google Drive for record uploads (falls back to 'Counseling Records' folder)
GOOGLE_DRIVE_FOLDER_ID=

# GitHub OAuth
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx
GITHUB_CALLBACK_URL=http://localhost:5000/auth/github/callback

# Facebook OAuth
FACEBOOK_APP_ID=xxxxx
FACEBOOK_APP_SECRET=xxxxx

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Node Environment
NODE_ENV=development
```

## Running the System

### Development Mode (Concurrent)

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

### Production Deployment

**Backend**:
```bash
cd backend
npm install --production
npm start
```

**Frontend - Build**:
```bash
cd frontend
npm run build
# Deploy dist/ folder to static host
```

## Development Scripts

### Backend
- `npm start` - Production server
- `npm run dev` - Development with nodemon auto-reload

### Frontend
- `npm run dev` - Development server with Vite
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## File Upload & Storage

- **Upload Directory**: `backend/uploads/`
- **Max File Size**: 10MB (configurable in `uploadMiddleware.js`)
- **Allowed Types**: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
- **Storage Method**: Server filesystem

## Google Integration Setup

See [INTEGRATIONS_SETUP_GUIDE.md](INTEGRATIONS_SETUP_GUIDE.md) for detailed instructions on:
- Creating Google OAuth credentials
- Setting up Google Drive access
- Enabling Google Calendar API
- Service account configuration

## RBAC & Permissions

See [RBAC_DOCUMENTATION.md](RBAC_DOCUMENTATION.md) for:
- Permission matrix by role
- How to add new roles
- Permission validation flow
- Admin user management

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB is running: `mongosh` or `mongo`
- Check `MONGO_URI` format
- Ensure firewall allows port 27017

### CORS Errors
- Verify frontend URL matches `CLIENT_URL` in `.env`
- Check CORS middleware in `app.js`
- Browser console shows specific origin issue

### Port Already in Use
- Backend: Change `PORT` in `.env`
- Frontend: Vite will auto-select next available port

### OAuth Not Working
- Verify redirect URIs match exactly in OAuth provider settings
- Check client IDs and secrets in `.env`
- Clear browser cookies and try again

### File Upload Failures
- Verify `uploads/` directory exists and is writable
- Check file size doesn't exceed 10MB limit
- Ensure file type is in allowed list

## Database Models Overview

| Model | Purpose |
|-------|---------|
| **User** | Core user account data |
| **Record** | Counseling session records |
| **Admin** | Admin user accounts |
| **CounselorSettings** | Counselor preferences |
| **CounselorNotification** | Notification history |
| **AuditLog** | System action tracking |
| **AnalyticsEvent** | Analytics data collection |
| **Announcement** | System announcements |
| **GoogleTokenStore** | OAuth token persistence |
| **RecordLock** | Strict 2PL record locking |
| **Session** | User session data |

## Security Best Practices

1. **Never commit `.env`** to version control
2. **Use strong secrets**: Minimum 32 random characters
3. **Enable HTTPS** in production
4. **Validate all inputs** on frontend and backend
5. **Implement rate limiting** for auth endpoints
6. **Regular backups** of MongoDB data
7. **Monitor audit logs** for suspicious activity
8. **Update dependencies** regularly

## Contributing

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and test thoroughly
3. Commit with clear messages: `git commit -m "Add new feature"`
4. Push branch: `git push origin feature/new-feature`
5. If your team flow uses a shared Development branch, push with: `git push -u origin Development`
6. Create Pull Request with description

## Project Documentation

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - REST API reference
- [RBAC_DOCUMENTATION.md](RBAC_DOCUMENTATION.md) - Access control details
- [INTEGRATIONS_SETUP_GUIDE.md](INTEGRATIONS_SETUP_GUIDE.md) - OAuth & Google setup
- [ANALYTICS_INTEGRATION_GUIDE.md](ANALYTICS_INTEGRATION_GUIDE.md) - Analytics implementation

## License

[Add license information here]

## Support & Contact

For issues, feature requests, or questions:
- Create an issue in the repository
- Contact the development team
- Check documentation files in root directory

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-13 | Initial release |

## System Status

- **Status**: Active Development
- **Last Updated**: March 11, 2026
- **Maintenance Window**: None scheduled
