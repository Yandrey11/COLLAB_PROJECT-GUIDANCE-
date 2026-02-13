# System Integrations Setup & Implementation Guide

This document provides detailed setup instructions, implementation details, and troubleshooting guides for all major integrations in the Counseling Services Management System.

---

## Table of Contents

1. [PDF Generation Integration](#1-pdf-generation-integration)
2. [Google Authentication Login](#2-google-authentication-login)
3. [Google reCAPTCHA](#3-google-recaptcha)
4. [Google Drive Integration](#4-google-drive-integration)
5. [Google Calendar Integration](#5-google-calendar-integration)
6. [Configuration Checklist](#configuration-checklist)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. PDF Generation Integration

### Overview

The system uses **two PDF libraries** for different purposes:
- **PDFKit** (Backend): Server-side PDF generation for counseling records
- **jsPDF** (Frontend): Client-side PDF generation for reports and exports

---

### 1.1 PDFKit (Backend) - Record PDFs

**Purpose**: Generate professional PDF documents for counseling session records that are automatically uploaded to Google Drive.

**Package**: `pdfkit` (v0.17.2)

**Location**: `backend/controllers/recordController.js`

#### Features

- Single-page PDF format
- Professional header with tracking number
- Footer with confidentiality notice
- Client details section
- Session notes with text wrapping
- Outcomes section
- Automatic file naming: `{CounselorName}_{ClientName}_record_{TrackingNumber}.pdf`

#### Implementation Details

**PDF Structure**:
```
┌─────────────────────────────────────────┐
│ Header: Tracking Number & Date          │
├─────────────────────────────────────────┤
│ Main Title: "Counseling Record"         │
│                                          │
│ Client Details:                          │
│ - Client Name                            │
│ - Date                                   │
│ - Session Type                           │
│ - Status                                 │
│ - Counselor                              │
│                                          │
│ Session Notes:                           │
│ [Full notes with word wrap]              │
│                                          │
│ Outcomes:                                │
│ [Outcome text with word wrap]            │
├─────────────────────────────────────────┤
│ Footer: Confidentiality Notice          │
│ Page Number & Tracking                   │
└─────────────────────────────────────────┘
```

**Key Code Snippet**:
```javascript
// Generate tracking number
const generateTrackingNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DOC-${timestamp}-${random}`;
};

// Create PDF document
const doc = new PDFDocument({ 
  margin: 72, // 1 inch margins
  size: 'LETTER'
});

// Add content sections
doc.fontSize(24).font('Helvetica-Bold')
   .text("Counseling Record", pageWidth / 2, 100, { align: 'center' });

// ... rest of PDF content
```

#### Usage Flow

1. **Record Creation** (`POST /api/records`)
   - User creates a new counseling record
   - Record is saved to MongoDB
   - `uploadRecordToDrive()` function is automatically called
   - PDF is generated using PDFKit
   - PDF is uploaded to Google Drive
   - Drive link is stored in record document

2. **Manual Upload** (`POST /api/records/:id/upload-drive`)
   - User can manually trigger PDF generation for existing records
   - Same PDF generation process as above

#### Environment Setup

No additional environment variables required for PDFKit itself. However, Google Drive integration is needed for automatic uploads.

#### File Locations

- **Main Implementation**: `backend/controllers/recordController.js`
  - Function: `uploadRecordToDrive()`
  - Function: `generateTrackingNumber()`
  - Function: `addHeaderFooter()` (if used for multi-page PDFs)

#### Dependencies

```json
{
  "pdfkit": "^0.17.2",
  "fs": "built-in",
  "path": "built-in"
}
```

---

### 1.2 jsPDF (Frontend) - Report Generation

**Purpose**: Generate PDF reports on the client side for filtered record exports.

**Packages**: 
- `jspdf` (v3.0.3)
- `jspdf-autotable` (v5.0.2)

**Location**: `frontend/src/pages/ReportsPage.jsx`

#### Features

- Client-side PDF generation (no server round-trip)
- Table formatting with AutoTable plugin
- Custom styling and formatting
- Multiple records per PDF
- Download functionality
- Filtered data export

#### Implementation Details

**Key Code Snippet**:
```javascript
import jsPDF from "jspdf";
import "jspdf-autotable";

const generatePDF = () => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text("Counseling Records Report", 14, 22);
  
  // Add table with AutoTable
  doc.autoTable({
    head: [['Client Name', 'Date', 'Session Type', 'Status', 'Counselor']],
    body: filteredRecords.map(record => [
      record.clientName,
      new Date(record.date).toLocaleDateString(),
      record.sessionType,
      record.status,
      record.counselor
    ]),
    startY: 30
  });
  
  // Save PDF
  doc.save(`counseling-records-${Date.now()}.pdf`);
};
```

#### Usage Flow

1. User navigates to Reports page
2. Applies filters (client name, date range, status)
3. Clicks "Generate PDF" button
4. PDF is generated client-side
5. PDF is automatically downloaded

#### File Locations

- **Main Implementation**: `frontend/src/pages/ReportsPage.jsx`
- **Dependencies**: `frontend/package.json`

---

## 2. Google Authentication Login

### Overview

The system supports Google OAuth 2.0 authentication for both regular users (counselors) and administrators. This provides seamless login using Google accounts.

**Package**: `passport-google-oauth20` (v2.0.0)

**Location**: 
- `backend/config/passport.js` (User OAuth)
- `backend/config/adminPassport.js` (Admin OAuth)

---

### 2.1 User Google Authentication

#### Implementation

**Configuration File**: `backend/config/passport.js`

**Key Features**:
- Automatic user creation in `GoogleUser` collection
- Calendar access tokens stored automatically
- Token syncing to `User` model if email matches
- Session management via Passport.js
- JWT token generation after successful authentication

#### OAuth Flow

```
1. User clicks "Sign in with Google" button
   ↓
2. Frontend redirects to: /auth/google
   ↓
3. Backend redirects to Google OAuth consent screen
   ↓
4. User grants permissions (profile, email, calendar)
   ↓
5. Google redirects to: /auth/google/callback
   ↓
6. Passport strategy processes callback
   ↓
7. User created/updated in GoogleUser collection
   ↓
8. Calendar tokens saved automatically
   ↓
9. JWT token generated
   ↓
10. Frontend redirects with token to Dashboard
```

#### Code Structure

```javascript
// backend/config/passport.js
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      // 1. Extract email from profile
      const email = profile.emails?.[0]?.value;
      
      // 2. Find or create GoogleUser
      let user = await GoogleUser.findOne({ googleId: profile.id });
      
      if (!user) {
        user = await GoogleUser.create({
          googleId: profile.id,
          name: profile.displayName,
          email,
          googleCalendarAccessToken: accessToken,
          googleCalendarRefreshToken: refreshToken,
        });
      } else {
        // Update existing user
        user.name = profile.displayName;
        user.googleCalendarAccessToken = accessToken;
        // ... update tokens
        await user.save();
      }
      
      // 3. Sync to User model if email matches
      const regularUser = await User.findOne({ email });
      if (regularUser) {
        regularUser.googleCalendarAccessToken = accessToken;
        // ... sync tokens
        await regularUser.save();
      }
      
      return done(null, user);
    }
  )
);
```

#### Routes

- **Initiate OAuth**: `GET /auth/google`
- **Callback**: `GET /auth/google/callback`
- **Success Handler**: `backend/controllers/googleAuthController.js`

#### Environment Variables

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
```

#### Google Cloud Console Setup

1. **Create OAuth 2.0 Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`

2. **Enable Required APIs**:
   - Google+ API (for profile access)
   - Google Calendar API (for calendar integration)

3. **OAuth Consent Screen**:
   - Configure app information
   - Add scopes:
     - `profile`
     - `email`
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar`

4. **Save Credentials**:
   - Copy Client ID → `GOOGLE_CLIENT_ID`
   - Copy Client Secret → `GOOGLE_CLIENT_SECRET`

---

### 2.2 Admin Google Authentication

#### Implementation

**Configuration File**: `backend/config/adminPassport.js`

**Key Differences from User Auth**:
- Uses separate strategy: `"admin-google"`
- Verifies admin exists in `Admin` collection by email
- Rejects authentication if email not found in Admin collection
- Links Google ID to existing admin account

#### Routes

- **Initiate OAuth**: `GET /auth/admin/google`
- **Callback**: `GET /auth/admin/google/callback`
- **Success Handler**: `backend/controllers/admin/adminGoogleAuthController.js`

#### Environment Variables

```env
GOOGLE_CLIENT_ID=your_google_client_id (same as user)
GOOGLE_CLIENT_SECRET=your_google_client_secret (same as user)
GOOGLE_ADMIN_CALLBACK_URL=http://localhost:5000/auth/admin/google/callback
```

#### Google Cloud Console Setup

**Same as User Auth**, but add additional redirect URI:
- Authorized redirect URIs: 
  - `http://localhost:5000/auth/google/callback`
  - `http://localhost:5000/auth/admin/google/callback`

---

### 2.3 Frontend Integration

**Location**: `frontend/src/pages/Login.jsx`

**Implementation**:
```javascript
const handleGoogleLogin = () => {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  window.location.href = `${baseUrl}/auth/google`;
};
```

**Button**:
```jsx
<button onClick={handleGoogleLogin}>
  Sign in with Google
</button>
```

---

## 3. Google reCAPTCHA

### Overview

Google reCAPTCHA v2 is integrated to prevent bot attacks and spam on login forms, particularly for admin authentication.

**Package**: `react-google-recaptcha` (v3.1.0)

**Location**:
- Frontend: `frontend/src/pages/Admin/AdminLogin.jsx`
- Backend: `backend/controllers/admin/adminLoginController.js`

---

### 3.1 Frontend Implementation

#### Setup

**Installation**:
```bash
npm install react-google-recaptcha
```

**Component Usage**:
```javascript
import ReCAPTCHA from "react-google-recaptcha";

const [captchaToken, setCaptchaToken] = useState("");

<ReCAPTCHA
  sitekey="6Lf-8vErAAAAAGohFk-EE6OaLY60jkwo1gTH05B7"
  onChange={(token) => setCaptchaToken(token)}
  onExpired={() => setCaptchaToken("")}
  onError={() => setCaptchaToken("")}
/>
```

#### Features

- "I'm not a robot" checkbox
- Token generation on verification
- Token expiration handling
- Error handling

#### Code Structure

```javascript
// frontend/src/pages/Admin/AdminLogin.jsx
import ReCAPTCHA from "react-google-recaptcha";

const AdminLogin = () => {
  const [captchaToken, setCaptchaToken] = useState("");
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!captchaToken) {
      setMessage("⚠️ Please verify that you are not a robot.");
      return;
    }
    
    const res = await axios.post("/api/admin/login", {
      email,
      password,
      captchaToken, // Send token to backend
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Email and Password fields */}
      
      <ReCAPTCHA
        sitekey="6Lf-8vErAAAAAGohFk-EE6OaLY60jkwo1gTH05B7"
        onChange={(token) => setCaptchaToken(token)}
      />
      
      <button type="submit">Login</button>
    </form>
  );
};
```

---

### 3.2 Backend Verification

#### Implementation

**Location**: `backend/controllers/admin/adminLoginController.js`

**Verification Function**:
```javascript
const verifyRecaptcha = async (token) => {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const { data } = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`
    );
    return data.success;
  } catch (error) {
    console.error("❌ reCAPTCHA verification error:", error);
    return false;
  }
};

// In login handler
export const adminLogin = async (req, res) => {
  const { email, password, captchaToken } = req.body;
  
  // Verify reCAPTCHA
  const captchaValid = await verifyRecaptcha(captchaToken);
  if (!captchaValid) {
    return res.status(400).json({ 
      message: "reCAPTCHA verification failed" 
    });
  }
  
  // Continue with login logic...
};
```

#### Verification Endpoint

**API**: `POST https://www.google.com/recaptcha/api/siteverify`

**Parameters**:
- `secret`: Your reCAPTCHA secret key
- `response`: Token from frontend

**Response**:
```json
{
  "success": true,
  "challenge_ts": "2024-01-01T12:00:00Z",
  "hostname": "localhost"
}
```

---

### 3.3 Setup Instructions

#### 1. Create reCAPTCHA Site

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Click "Create" to create a new site
3. Configure:
   - **Label**: Your site name (e.g., "Counseling System")
   - **reCAPTCHA type**: reCAPTCHA v2 > "I'm not a robot" Checkbox
   - **Domains**: Add your domains
     - `localhost` (for development)
     - `yourdomain.com` (for production)
4. Accept terms and submit

#### 2. Get Keys

- **Site Key**: `6Lf-8vErAAAAAGohFk-EE6OaLY60jkwo1gTH05B7` (public, used in frontend)
- **Secret Key**: `your_secret_key_here` (private, used in backend)

#### 3. Configure Environment

**Backend `.env`**:
```env
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

**Frontend**: Hardcoded site key in component (or use environment variable)

---

### 3.4 Routes Using reCAPTCHA

- `POST /api/admin/login` - **Required** (backend verification)
- `POST /api/auth/login` - Frontend widget present (optional backend verification)

---

## 4. Google Drive Integration

### Overview

Google Drive API is integrated to automatically upload counseling record PDFs to a shared Google Drive folder.

**Package**: `googleapis` (v164.1.0)

**Location**: 
- `backend/config/googleDrive.js`
- `backend/controllers/googleDriveAuthController.js`
- `backend/controllers/recordController.js`

---

### 4.1 Setup Instructions

#### Step 1: Google Cloud Console Configuration

1. **Enable Google Drive API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

2. **Create OAuth 2.0 Credentials** (if not already created):
   - Go to "APIs & Services" > "Credentials"
   - Create OAuth 2.0 Client ID
   - Application type: "Web application"
   - Add authorized redirect URI: `http://localhost:5000/auth/drive/callback`

3. **Create Google Drive Folder**:
   - Create a folder in Google Drive for storing PDFs
   - Right-click folder > "Share" > Get shareable link
   - Copy the Folder ID from the URL:
     ```
     https://drive.google.com/drive/folders/FOLDER_ID_HERE
     ```

#### Step 2: Environment Variables

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5000/auth/drive/callback
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
GOOGLE_REFRESH_TOKEN=optional_refresh_token
```

#### Step 3: OAuth Flow Setup

**Configuration File**: `backend/config/googleDrive.js`

```javascript
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_DRIVE_REDIRECT_URI
);

// Initialize Drive API client
const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

export default drive;
```

---

### 4.2 Authentication Flow

#### Step 1: Connect Google Drive

**Route**: `GET /auth/drive`

**Implementation**: `backend/controllers/googleDriveAuthController.js`

```javascript
export const googleDriveAuth = async (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });
  res.redirect(authUrl);
};
```

#### Step 2: OAuth Callback

**Route**: `GET /auth/drive/callback`

```javascript
export const googleDriveCallback = async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  driveTokens = tokens; // Store in memory
  
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res.redirect(`${clientUrl}/records?success=drive_connected`);
};
```

#### Step 3: Upload PDF

**Implementation**: `backend/controllers/recordController.js`

```javascript
const uploadRecordToDrive = async (record, req) => {
  // 1. Generate PDF using PDFKit
  const pdfPath = path.join(tempDir, `${fileName}.pdf`);
  const doc = new PDFDocument({ margin: 72, size: 'LETTER' });
  // ... PDF generation code ...
  
  // 2. Upload to Google Drive
  const drive = google.drive({ version: "v3", auth: oauth2Client });
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
  
  // 3. Save Drive link to record
  record.driveLink = file.data.webViewLink;
  await record.save();
  
  return file.data.webViewLink;
};
```

---

### 4.3 Usage Flow

```
1. User clicks "Connect Google Drive" button
   ↓
2. Redirects to Google OAuth consent screen
   ↓
3. User grants Drive permissions
   ↓
4. Callback stores tokens
   ↓
5. User creates/saves a record
   ↓
6. PDF is generated automatically
   ↓
7. PDF is uploaded to Google Drive
   ↓
8. Drive link is saved to record
   ↓
9. User receives notification
```

---

### 4.4 API Scopes

**Required Scope**: `https://www.googleapis.com/auth/drive.file`
- Limited to files created by the app
- Cannot access existing files in Drive
- More secure than full Drive access

---

### 4.5 File Naming Convention

**Format**: `{CounselorName}_{ClientName}_record_{TrackingNumber}.pdf`

**Example**: `John_Doe_Alice_Smith_record_DOC-1704067200000-1234.pdf`

---

## 5. Google Calendar Integration

### Overview

Google Calendar API is integrated to display user's calendar events alongside counseling records on the dashboard.

**Package**: `googleapis` (v164.1.0)

**Location**:
- `backend/controllers/googleCalendarController.js`
- `backend/routes/googleCalendarRoutes.js`
- `frontend/src/pages/Dashboard.jsx`

---

### 5.1 Setup Instructions

#### Step 1: Google Cloud Console Configuration

1. **Enable Google Calendar API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

2. **Configure OAuth Scopes** (in passport.js):
   ```javascript
   scope: [
     "profile",
     "email",
     "https://www.googleapis.com/auth/calendar.readonly",
     "https://www.googleapis.com/auth/calendar",
   ]
   ```

3. **Add Redirect URI**:
   - Authorized redirect URIs: `http://localhost:5000/auth/google/calendar/callback`

#### Step 2: Environment Variables

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5000/auth/google/calendar/callback
GOOGLE_CALENDAR_CLIENT_ID=optional_separate_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=optional_separate_client_secret
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.readonly
```

---

### 5.2 Authentication Flow

#### Automatic Calendar Connection (via Google Login)

When users sign in with Google, calendar tokens are automatically saved:

**Location**: `backend/config/passport.js`

```javascript
// In GoogleStrategy callback
user.googleCalendarAccessToken = accessToken;
user.googleCalendarRefreshToken = refreshToken;
user.googleCalendarTokenExpires = new Date(Date.now() + 3600 * 1000);
await user.save();
```

#### Manual Calendar Connection

**Route**: `GET /auth/google/calendar/connect`

**Implementation**: `backend/controllers/googleCalendarController.js`

```javascript
export const startGoogleCalendarOAuth = async (req, res) => {
  const token = extractTokenFromRequest(req);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  const state = buildStateToken({ userId: decoded.id });
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
  
  res.redirect(authUrl);
};
```

**Callback Route**: `GET /auth/google/calendar/callback`

```javascript
export const handleGoogleCalendarCallback = async (req, res) => {
  const code = req.query.code;
  const state = decodeStateToken(req.query.state);
  
  const { tokens } = await oauth2Client.getToken({ code });
  
  // Save tokens to User or GoogleUser model
  const user = await User.findById(state.userId);
  user.googleCalendarAccessToken = tokens.access_token;
  user.googleCalendarRefreshToken = tokens.refresh_token;
  user.googleCalendarTokenExpires = new Date(tokens.expiry_date);
  await user.save();
  
  res.redirect(`${CLIENT_URL}/dashboard?calendar=connected`);
};
```

---

### 5.3 Fetching Calendar Events

**Route**: `GET /api/calendar/dashboard-events`

**Implementation**: `backend/controllers/googleCalendarController.js`

```javascript
export const getDashboardCalendarEvents = async (req, res) => {
  // 1. Get user's calendar tokens
  let user = await User.findById(req.user._id);
  const accessToken = user.googleCalendarAccessToken;
  const refreshToken = user.googleCalendarRefreshToken;
  
  // 2. Set OAuth credentials
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  
  // 3. Refresh token if expired
  if (tokenExpired) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    // Update tokens in database
  }
  
  // 4. Fetch events
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: thirtyDaysFromNow.toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: "startTime",
  });
  
  // 5. Format and return events
  const events = response.data.items.map(event => ({
    id: event.id,
    title: event.summary || "No Title",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    location: event.location || "",
    htmlLink: event.htmlLink || "",
  }));
  
  res.json({ events, connected: true });
};
```

---

### 5.4 Frontend Integration

**Location**: `frontend/src/pages/Dashboard.jsx`

**Usage**:
```javascript
const fetchCalendarEvents = async () => {
  try {
    const res = await axios.get("/api/calendar/dashboard-events", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    setCalendarEvents(res.data.events);
    setCalendarConnected(res.data.connected);
  } catch (error) {
    setCalendarConnected(false);
  }
};

// Display events in calendar view
<CalendarView 
  calendarEvents={calendarEvents}
  records={records}
/>
```

---

### 5.5 API Scopes

**Required Scopes**:
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events
- `https://www.googleapis.com/auth/calendar` - Full calendar access (if creating events)

---

### 5.6 Data Models

**User Model Fields**:
```javascript
{
  googleCalendarAccessToken: String,
  googleCalendarRefreshToken: String,
  googleCalendarTokenExpires: Date,
}
```

**GoogleUser Model Fields** (same as above):
```javascript
{
  googleCalendarAccessToken: String,
  googleCalendarRefreshToken: String,
  googleCalendarTokenExpires: Date,
}
```

---

### 5.7 Token Management

**Token Refresh**:
- Access tokens expire after 1 hour
- Refresh tokens are long-lived
- System automatically refreshes expired tokens
- Tokens are updated in database after refresh

**Token Storage**:
- Tokens stored in User or GoogleUser collection
- Encrypted in transit (HTTPS)
- Not exposed to frontend

---

## Configuration Checklist

### Required Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# Database
MONGO_URI=mongodb://localhost:27017/counseling_db

# JWT & Sessions
JWT_SECRET=your_jwt_secret_key_min_32_chars
SESSION_SECRET=your_session_secret_key_min_32_chars

# Google OAuth (for Login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
GOOGLE_ADMIN_CALLBACK_URL=http://localhost:5000/auth/admin/google/callback

# Google Drive
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5000/auth/drive/callback
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id

# Google Calendar
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5000/auth/google/calendar/callback
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.readonly

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

---

## Troubleshooting Guide

### PDF Generation Issues

**Problem**: PDF not generating
- **Solution**: Check PDFKit installation: `npm list pdfkit`
- **Solution**: Verify file write permissions in `temp/` directory
- **Solution**: Check disk space availability

**Problem**: PDF formatting issues
- **Solution**: Verify page margins and dimensions
- **Solution**: Check text wrapping settings
- **Solution**: Validate PDF content structure

---

### Google Authentication Issues

**Problem**: "redirect_uri_mismatch" error
- **Solution**: Verify redirect URI in Google Cloud Console matches exactly
- **Solution**: Check environment variables for callback URLs
- **Solution**: Ensure no trailing slashes in URLs

**Problem**: "invalid_client" error
- **Solution**: Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- **Solution**: Check credentials are for the correct project in Google Cloud Console
- **Solution**: Ensure OAuth consent screen is configured

**Problem**: User not created after Google login
- **Solution**: Check MongoDB connection
- **Solution**: Verify GoogleUser model schema
- **Solution**: Check server logs for errors

---

### reCAPTCHA Issues

**Problem**: "reCAPTCHA verification failed"
- **Solution**: Verify `RECAPTCHA_SECRET_KEY` matches the site
- **Solution**: Check domain is registered in reCAPTCHA console
- **Solution**: Ensure site key in frontend matches reCAPTCHA site

**Problem**: reCAPTCHA widget not loading
- **Solution**: Check internet connection
- **Solution**: Verify site key is correct
- **Solution**: Check browser console for errors

---

### Google Drive Issues

**Problem**: "Google Drive not connected"
- **Solution**: Verify OAuth flow completed successfully
- **Solution**: Check tokens are stored in memory/database
- **Solution**: Re-authenticate via `/auth/drive`

**Problem**: "Permission denied" when uploading
- **Solution**: Verify Drive API is enabled in Google Cloud Console
- **Solution**: Check OAuth scopes include Drive access
- **Solution**: Verify folder ID is correct and accessible

**Problem**: PDF upload fails
- **Solution**: Check file size limits (Drive allows up to 5TB)
- **Solution**: Verify folder exists and is accessible
- **Solution**: Check network connectivity

---

### Google Calendar Issues

**Problem**: "Calendar not connected"
- **Solution**: Verify calendar tokens exist in User/GoogleUser model
- **Solution**: Check OAuth scopes include calendar access
- **Solution**: Reconnect via `/auth/google/calendar/connect`

**Problem**: "Token expired" error
- **Solution**: System should auto-refresh, but check refresh token exists
- **Solution**: Re-authenticate to get new refresh token
- **Solution**: Verify token expiry date is being checked

**Problem**: Events not displaying
- **Solution**: Check API response for errors
- **Solution**: Verify date range is correct
- **Solution**: Check calendar ID is "primary"
- **Solution**: Verify user has events in their calendar

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [PDFKit Documentation](https://pdfkit.org/)
- [jsPDF Documentation](https://github.com/parallax/jsPDF)

---

**Last Updated**: 2024
**Document Version**: 2.0

