# Comprehensive API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication APIs](#authentication-apis)
3. [Counselor Profile APIs](#counselor-profile-apis)
4. [Counseling Records APIs](#counseling-records-apis)
5. [Admin APIs](#admin-apis)
6. [Analytics APIs](#analytics-apis)
7. [Notification APIs](#notification-apis)
8. [External Integration APIs](#external-integration-apis)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Error Handling](#error-handling)
11. [Authentication Mechanisms](#authentication-mechanisms)

---

## Overview

This Counseling Services Management System consists of multiple API endpoints organized into functional modules. The system uses:
- **Express.js** as the backend framework
- **MongoDB/Mongoose** for data persistence
- **JWT (JSON Web Tokens)** for authentication
- **RBAC (Role-Based Access Control)** for authorization
- **OAuth 2.0** for third-party authentication (Google, GitHub)
- **RESTful** architecture principles

### Base URLs
- **Backend API**: `http://localhost:5000` (configurable via `VITE_API_URL`)
- **Authentication Routes**: `/auth/*`
- **API Routes**: `/api/*`
- **Admin Routes**: `/api/admin/*`

### API Endpoint Documentation Format

All API endpoints follow a standardized documentation format:

**Method:** [GET | POST | PUT | DELETE | PATCH]

**Configurations:**

The API request should be validated using token.

**Parameters:**

_token – this is required for handling the request of this API endpoint. This should be sent through body.

**Example:**
```
Method: GET

Configurations:
	The API request should be validated using token.

Parameters:
	_token – this is required for handling the request of this API endpoint. This should be sent through body.
```

**Note:** For GET requests, the token is typically sent in the `Authorization` header as `Bearer <token>`, but can also be sent in the request body as `_token` for certain endpoints.

---

## Authentication APIs

### 2.1.1 Module Description

The Authentication Module provides endpoints for user and admin authentication, session control, and secure access management. These operations include user registration, login with email/password, OAuth authentication via Google and GitHub, password reset functionality, token refresh, and session termination. Each endpoint ensures secure access through token-based authentication (JWT), validates user input, protects data integrity, and maintains session security. The API uses comprehensive response codes: 200 (OK) for successful operations, 201 (Created) for resource creation, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, 404 (Not Found) for unavailable resources, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/api/auth/signup`
* `http://localhost:5000/api/auth/login`
* `http://localhost:5000/api/auth/logout`
* `http://localhost:5000/api/auth/me`
* `http://localhost:5000/auth/google`
* `http://localhost:5000/auth/google/callback`
* `http://localhost:5000/auth/github`
* `http://localhost:5000/auth/github/callback`
* `http://localhost:5000/api/admin/signup`
* `http://localhost:5000/api/admin/login`
* `http://localhost:5000/api/admin/refresh-token`
* `http://localhost:5000/auth/admin/google`
* `http://localhost:5000/auth/admin/google/callback`
* `http://localhost:5000/auth/admin/github`
* `http://localhost:5000/auth/admin/github/callback`
* `http://localhost:5000/auth/admin/profile`
* `http://localhost:5000/auth/admin/logout`
* `http://localhost:5000/api/reset/forgot-password`
* `http://localhost:5000/api/reset/reset-password`
* `http://localhost:5000/api/reset/set-password`

---

### 1. User Authentication (Counselor)

#### POST `/api/auth/signup`
**Purpose**: Authenticate User and Create Session - Register a new counselor account

**Description:**

This API endpoint enables the creation of user accounts and login credentials for secure access to the Guidance Counselor Record System. Error responses are generated for invalid registration attempts, including duplicate email addresses, missing required fields, or passwords that do not meet security requirements. This ensures that only properly registered counselors with valid account credentials can access the Guidance Counselor Record System.

**Endpoint URL:** `http://localhost:5000/api/auth/signup`

**Method:** POST

**Configurations:**

The API request must be authenticated to ensure secure access to the Guidance Counselor Record System user registration and session creation process. The request must include a valid token in the header to verify the identity of the user making the request. Upon successful registration, a new user account is created and a JWT token is generated for immediate authentication and session establishment.

**Parameters:**

➢ **_token** – this is optional for initial signup but may be required for handling requests to this API endpoint. The token should be sent in the request header to verify the identity of the user making the request (if applicable).

➢ **_name** – this is required to specify the user's full name. It should be included in the request body.

➢ **_email** – this is required to specify the user's email address. It should be included in the request body. The email must be unique and not already registered in the system.

➢ **_password** – this is required for the user's password. It should be included in the request body to ensure secure account creation. The password must meet security requirements (minimum length, complexity, etc.).

➢ **_role** – this is optional and defaults to "counselor". The role is automatically assigned and returned in the response body.

➢ **_errorMessage** – this is optional and is returned in the response body to provide details about any registration issues, such as "All fields are required", "Email already registered", "Password does not meet the security requirements", or "Server error during signup".

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "counselor@example.com",
  "password": "SecurePassword123!"
}
```

**Success Response (201 Created):**
```json
{
  "message": "Signup successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "counselor@example.com",
    "role": "counselor"
  }
}
```

**Error Response (400 Bad Request - Missing Fields):**
```json
{
  "message": "All fields are required"
}
```

**Error Response (400 Bad Request - Email Exists):**
```json
{
  "message": "Email already registered"
}
```

**Error Response (400 Bad Request - Password Validation):**
```json
{
  "message": "Password does not meet the security requirements.",
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter"
  ],
  "details": {
    "minLength": false,
    "hasUppercase": false,
    "hasLowercase": true,
    "hasNumber": true,
    "hasSpecialChar": true
  }
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "message": "Server error during signup"
}
```

**Component Interaction**:
- Frontend: `Signup.jsx` → Makes POST request → Stores token in localStorage → Redirects to dashboard

---

#### POST `/api/auth/login`
**Purpose**: Authenticate an existing counselor

**Description:**

This API endpoint enables the creation of login credentials for secure access to the Guidance Counselor Record System. Error responses are generated for invalid login attempts, including incorrect credentials or missing parameters. This ensures that only registered counselors with valid login details can access the Guidance Counselor Record System.

**Endpoint URL:** `http://localhost:5000/api/auth/login`

**Method:** POST

**Configurations:**

The API request must be authenticated to ensure secure access to the Guidance Counselor Record System login process. The request must include a valid token in the header to verify the identity of the user making the request.

**Parameters:**

➢ **_token** – this is required for handling requests to this API endpoint. The token should be sent in the request header to verify the identity of the user making the request.

➢ **_email** – this is required to specify the user's email address. It should be included in the request body.

➢ **_password** – this is required for the user's password. It should be included in the request body to ensure secure login credentials.

➢ **_role** – this is optional and is automatically determined from the user's account. The role is returned in the response body (e.g., "counselor", "admin").

➢ **_rememberMe** – this is optional and indicates whether the login session should be remembered for future access. It can be included in the request body (currently not implemented but reserved for future use).

➢ **_errorMessage** – this is optional and is returned in the response body to provide details about any login issues, such as "Invalid credentials", "Email and password required", or "Account is inactive. Please contact an administrator."

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <token> (optional for initial login)
```

**Request Body:**
```json
{
  "email": "counselor@example.com",
  "password": "userpassword123"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "counselor@example.com",
    "role": "counselor"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "message": "Email and password required"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "message": "Invalid credentials"
}
```

**Error Response (403 Forbidden):**
```json
{
  "message": "Account is inactive. Please contact an administrator."
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "message": "Server error during login"
}
```

**Component Interaction**:
- Frontend: `Login.jsx` → Validates credentials → Receives JWT → Stores in localStorage → Redirects

---

#### POST `/api/auth/logout`
**Purpose**: Logout current user and invalidate session

**Input**: None (uses JWT from Authorization header)

**Output**:
```json
{
  "message": "Logged out successfully"
}
```

**Authentication**: Required (JWT Bearer token)

**Component Interaction**:
- Frontend: Calls endpoint → Clears localStorage → Redirects to login

---

#### GET `/api/auth/me`
**Purpose**: Get current authenticated user information

**Method:** GET

**Configurations:**

The API request should be validated using token.

**Parameters:**

_token – this is required for handling the request of this API endpoint. This should be sent through body.

**Input**: None (uses JWT from Authorization header or body)

**Output**:
```json
{
  "user": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "role": "string",
    "profilePicture": "string (optional)"
  }
}
```

**Authentication**: Required (JWT Bearer token)

**Component Interaction**:
- Frontend: Used on page load to validate token and fetch user data
- All protected pages check this endpoint on mount

---

### 2. Google OAuth Authentication (Counselor)

#### GET `/auth/google`
**Purpose**: Verify Google User Authentication - Initiate Google OAuth flow for counselors

**Endpoint URL:** `http://localhost:5000/auth/google`

**Method:** GET

**Configurations:**

The API request initiates the Google OAuth 2.0 authentication flow to verify and authenticate users through their Google accounts. This endpoint redirects users to Google's OAuth consent screen where they can grant permissions for the Guidance Counselor Record System to access their Google profile information. The OAuth flow ensures secure authentication without requiring users to create separate account credentials.

**Parameters:**

➢ **_token** – this is not required for the initial OAuth initiation, but may be used in subsequent requests. The OAuth flow handles authentication through Google's secure authentication system.

➢ **_scope** – this is automatically configured to request necessary permissions from Google, including profile information, email address, and calendar access (if applicable).

➢ **_redirect_uri** – this is automatically configured to redirect to the callback endpoint after Google authentication is complete.

**Request Headers:**
```
(No special headers required - browser redirect)
```

**Request:** 
- This is a GET request that initiates a redirect to Google's OAuth consent screen
- No request body is required
- User is redirected to: `https://accounts.google.com/o/oauth2/v2/auth?...`

**Success Response (302 Redirect):**
- Redirects to Google OAuth consent screen
- User grants permissions on Google's website
- Google redirects back to callback endpoint with authorization code

**Error Response:**
- If OAuth configuration is invalid, user may see an error page
- Errors are typically handled by redirecting to login page with error parameter

**Component Interaction**:
- Frontend: User clicks "Sign in with Google" → Redirects to Google → User grants permission → Callback handles response

---

#### 2.1.1.2 Verify Google User Authentication

**Version:** 1.0  
**Date:** December 2024

**Description:**

This API endpoint is designed to verify the credentials of users attempting to log in through Google authentication within the Guidance Counselor Record System. Its purpose is to ensure that the user is authenticated via Google, thereby securely granting them access to the system. This feature is essential for providing an efficient authentication process, enhancing user experience, and maintaining system security. The endpoint handles the OAuth callback from Google, verifies the user's Google account, creates or updates the user record in the system, and generates a secure JWT token for session management.

**Endpoint:**

**URL:** `http://localhost:5000/auth/google/callback`

**Method:**

`GET`

**Configurations:**

The API request requires authentication to ensure secure access to user data. It mandates proper input validation to confirm the Google authorization code's validity and the inclusion of required parameters, specifically `code` from Google OAuth. Additionally, the API implements secure token exchange with Google's servers, validates user information, creates or updates user accounts in the database, and generates JWT tokens for session management. The system may implement rate limiting to protect against excessive requests and ensure optimal system performance.

**Parameters:**

The following parameters are required for this API endpoint:

➢ **_token** – This token is required for handling requests to this API endpoint. It should be sent in the request header to verify the identity of the user making the request.

➢ **google_token** (or **code**) – This token is required. It is received from Google authentication via the OAuth callback and is used to verify the user's identity and access permissions. The authorization code is exchanged for user information from Google's servers.

➢ **email** – This parameter is required to specify the Google email address of the user attempting to log in. It is automatically extracted from the Google user profile during the OAuth verification process.

The following parameters are optional:

➢ **device_id** – This is an optional parameter used to identify the device making the request, enhancing security features and enabling device-specific session management.

➢ **redirect_url** – This is an optional parameter that specifies the URL to which the user will be redirected upon successful authentication. If not provided, the system defaults to redirecting to the dashboard.

**Requests:**

**Valid Request:**

```
Starting Google user verification...
Google Account Found: counselor@example.com
Searching for user with email: counselor@example.com
✅ Found user in GoogleUser collection
Creating JWT token for Google user: { email: 'counselor@example.com', userId: '507f1f77bcf86cd799439011' }
✅ Google login success for counselor@example.com (ID: 507f1f77bcf86cd799439011) - Token created. Redirecting to dashboard...
Login log created with ID: 673ab9d8c43538a2fe243b62
🔐 Google Account counselor@example.com successfully authenticated and logged in
```

**Not Valid Request:**

```
Starting Google user verification...
Google Account Found: unauthorized@example.com
Searching for user with email: unauthorized@example.com
❌ User not found in any collection
🚫 Authentication failed - User not authorized
```

**Response Format:**

Console Log / HTTP Redirect (302)

**Response Description:**

The API response confirms successful user verification via Google authentication within the Guidance Counselor Record System. If the Google authorization code is valid and the request is authenticated, the system creates or updates the user account, generates a JWT authentication token for secure access, creates a session record, and redirects the user to the dashboard with the token included in the URL. The response includes a success message and establishes a secure session for the authenticated user.

If verification fails (due to an invalid authorization code, incorrect email, unauthorized access, missing user information, or server errors), the system provides an error message and redirects to the login page with an appropriate error parameter such as "Invalid Google token," "Authentication failed," "Unauthorized access attempt," "User ID missing," or "Server error." This guides the user to resolve the issue and ensures only legitimate users can access the system.

---

### 3. GitHub OAuth Authentication (Counselor)

#### GET `/auth/github`
**Purpose**: Initiate GitHub OAuth flow

**Input**: None

**Output**: Redirects to GitHub OAuth consent screen

**Component Interaction**: Similar to Google OAuth flow

---

#### GET `/auth/github/callback`
**Purpose**: Handle GitHub OAuth callback

**Input**: OAuth code from GitHub

**Output**: Redirects to frontend dashboard

---

### 4. Admin Authentication

#### POST `/api/admin/signup`
**Purpose**: Register a new admin account

**Input**:
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Output**:
```json
{
  "token": "JWT_TOKEN",
  "admin": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "role": "admin"
  }
}
```

**Authentication**: None (public endpoint, but may require invitation code)

---

#### POST `/api/admin/login`
**Purpose**: Authenticate admin (includes reCAPTCHA verification)

**Description:**

This API endpoint enables the creation of login credentials for secure access to the Guidance Counselor Record System administrative panel. Error responses are generated for invalid login attempts, including incorrect credentials, missing parameters, failed reCAPTCHA verification, or unauthorized access attempts. This ensures that only registered administrators with valid login details and successful reCAPTCHA verification can access the Guidance Counselor Record System administrative functions.

**Endpoint URL:** `http://localhost:5000/api/admin/login`

**Method:** POST

**Configurations:**

The API request must be authenticated to ensure secure access to the Guidance Counselor Record System admin login process. The request must include a valid token in the header to verify the identity of the user making the request. Additionally, reCAPTCHA verification is required for admin login to prevent automated attacks.

**Parameters:**

➢ **_token** – this is required for handling requests to this API endpoint. The token should be sent in the request header to verify the identity of the user making the request.

➢ **_email** – this is required to specify the admin's email address. It should be included in the request body.

➢ **_password** – this is required for the admin's password. It should be included in the request body to ensure secure login credentials.

➢ **_role** – this is optional and is automatically determined from the admin's account. The role is returned in the response body (typically "admin").

➢ **_recaptchaResponse** (or **_captchaToken**) – this is required to verify the reCAPTCHA response token submitted by the admin. It should be included in the request body for verification. This parameter is mandatory for admin login to ensure security.

➢ **_rememberMe** – this is optional and indicates whether the login session should be remembered for future access. It can be included in the request body (currently not implemented but reserved for future use).

➢ **_errorMessage** – this is optional and is returned in the response body to provide details about any login issues, such as "Invalid credentials", "reCAPTCHA verification failed", "Admin not found", or "Server error".

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <token> (optional for initial login)
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminpassword123",
  "captchaToken": "03AGdBq25...reCAPTCHA_token_here"
}
```

**Success Response (200 OK):**
```json
{
  "message": "✅ Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "message": "reCAPTCHA verification failed"
}
```

**Error Response (400 Bad Request - Invalid Credentials):**
```json
{
  "message": "Invalid credentials"
}
```

**Error Response (404 Not Found):**
```json
{
  "message": "Admin not found"
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "message": "Server error"
}
```

**Component Interaction**:
- Frontend: `AdminLogin.jsx` → Validates reCAPTCHA → Sends credentials → Receives admin token

---

#### GET `/auth/admin/google`
**Purpose**: Initiate Google OAuth for admins

**Input**: None

**Output**: Redirects to Google OAuth

**Note**: Separate OAuth flow from counselor authentication

---

#### GET `/auth/admin/google/callback`
**Purpose**: Handle admin Google OAuth callback

**Input**: OAuth code

**Output**: Redirects with admin JWT token

---

#### GET `/auth/admin/github`
**Purpose**: Initiate GitHub OAuth for admins

**Input**: None

**Output**: Redirects to GitHub OAuth

---

#### GET `/auth/admin/github/callback`
**Purpose**: Handle admin GitHub OAuth callback

**Input**: OAuth code

**Output**: Redirects with admin JWT token

---

### 5. Password Reset

#### POST `/api/reset/forgot-password`
**Purpose**: Request password reset code via email

**Input**:
```json
{
  "email": "string"
}
```

**Output**:
```json
{
  "message": "Password reset code sent to email"
}
```

**Component Interaction**:
- Frontend: User enters email → Backend generates 6-digit code → Sends via Nodemailer (Gmail SMTP) → User receives email

**External Integration**: Nodemailer with Gmail SMTP

---

#### POST `/api/reset/reset-password`
**Purpose**: Reset password using code and new password

**Input**:
```json
{
  "email": "string",
  "code": "string (6 digits)",
  "newPassword": "string"
}
```

**Output**:
```json
{
  "message": "Password reset successful"
}
```

**Component Interaction**:
- Frontend: User enters code and new password → Backend validates → Updates password → Redirects to login

---

#### POST `/api/reset/set-password`
**Purpose**: Set password using token (for OAuth users)

**Input**:
```json
{
  "token": "string",
  "email": "string",
  "newPassword": "string"
}
```

**Output**:
```json
{
  "message": "Password set successfully"
}
```

---

## Counselor Profile APIs

### 2.1.2 Module Description

The Counselor Profile Module provides endpoints for profile management, personal information updates, password changes, profile picture uploads, and activity log retrieval. These operations include retrieving counselor profile information, updating profile details, changing passwords securely, managing profile pictures, and viewing activity history. Each endpoint ensures secure access through token-based authentication, validates user input, protects sensitive information, and maintains data integrity. The API uses comprehensive response codes: 200 (OK) for successful operations, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, 404 (Not Found) for unavailable resources, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/api/profile`
* `http://localhost:5000/api/profile/password`
* `http://localhost:5000/api/profile/picture`
* `http://localhost:5000/api/profile/activity`

---

### GET `/api/profile`
**Purpose**: Get counselor profile information

**Input**: None (uses JWT from header)

**Output**:
```json
{
  "profile": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "profilePicture": "string",
    "bio": "string",
    "phone": "string",
    "address": "string",
    "isGoogleUser": "boolean"
  }
}
```

**Authentication**: Required (JWT, Counselor role)

**Component Interaction**:
- Frontend: `ProfilePage.jsx` → Fetches profile on mount → Displays in form

---

### PUT `/api/profile`
**Purpose**: Update counselor profile

**Input**:
```json
{
  "name": "string",
  "bio": "string",
  "phone": "string",
  "address": "string"
}
```

**Output**:
```json
{
  "message": "Profile updated successfully",
  "profile": { ... }
}
```

**Authentication**: Required (JWT, Counselor role)

---

### POST `/api/profile/password`
**Purpose**: Change counselor password

**Input**:
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Output**:
```json
{
  "message": "Password changed successfully"
}
```

**Authentication**: Required (JWT, Counselor role)

---

### POST `/api/profile/picture`
**Purpose**: Upload profile picture

**Input**: FormData with `file` field (multipart/form-data)

**Output**:
```json
{
  "message": "Profile picture uploaded successfully",
  "profilePicture": "/uploads/profile/user_id_filename.jpg"
}
```

**Authentication**: Required (JWT, Counselor role)

**File Storage**: Local filesystem (`backend/uploads/profile/`)

---

### DELETE `/api/profile/picture`
**Purpose**: Remove profile picture

**Input**: None

**Output**:
```json
{
  "message": "Profile picture removed successfully"
}
```

**Authentication**: Required (JWT, Counselor role)

---

### GET `/api/profile/activity`
**Purpose**: Get counselor activity logs

**Input**: Query parameters (optional):
- `page`: number (default: 1)
- `limit`: number (default: 10)

**Output**:
```json
{
  "logs": [
    {
      "_id": "string",
      "action": "string",
      "module": "string",
      "timestamp": "ISO date",
      "details": "object"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**Authentication**: Required (JWT, Counselor role)

---

## Counseling Records APIs

### 2.1.3 Module Description

The Counseling Records Module provides endpoints for comprehensive record management, including creating, reading, updating, and deleting counseling session records. These operations include retrieving records with advanced filtering and pagination, creating new session records, updating existing records with lock protection, deleting records, generating PDF documents, uploading records to Google Drive, and managing record locking mechanisms to prevent concurrent edits. Each endpoint ensures secure access through token-based authentication and role-based permissions, validates user input, protects data integrity, maintains audit trails, and tracks all modifications. The API uses comprehensive response codes: 200 (OK) for successful operations, 201 (Created) for resource creation, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, 404 (Not Found) for unavailable resources, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/api/records`
* `http://localhost:5000/api/records/:id`
* `http://localhost:5000/api/records/:id/generate-pdf`
* `http://localhost:5000/api/records/:id/upload-drive`
* `http://localhost:5000/api/records/:id/lock`
* `http://localhost:5000/api/records/:id/unlock`
* `http://localhost:5000/api/records/:id/lock-status`
* `http://localhost:5000/api/records/:id/lock-logs`

---

### GET `/api/records`
**Purpose**: Get all counseling records (with filters and pagination)

**Method:** GET

**Configurations:**

The API request should be validated using token.

**Parameters:**

_token – this is required for handling the request of this API endpoint. This should be sent through body.

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 10)
- `clientName`: string (search)
- `status`: string (filter)
- `sessionType`: string (filter)
- `startDate`: date (filter)
- `endDate`: date (filter)

**Output**:
```json
{
  "records": [
    {
      "_id": "string",
      "clientName": "string",
      "date": "ISO date",
      "sessionType": "string",
      "status": "string",
      "counselor": "string",
      "sessionNumber": "number",
      "notes": "string",
      "outcomes": "string",
      "driveFileId": "string (optional)",
      "driveLink": "string (optional)"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**Authentication**: Required (JWT, `can_view_records` permission)

**Component Interaction**:
- Frontend: `RecordsPage.jsx` → Fetches records on mount/filter change → Displays in table

---

### POST `/api/records`
**Purpose**: Create a new counseling record

**Version:** 1.0  
**Date:** December 2024

**Description:**

This API endpoint enables the creation of counseling session records for secure documentation and management within the Guidance Counselor Record System. Error responses are generated for invalid record creation attempts, including missing required fields, invalid data formats, insufficient permissions, or record locking conflicts. This ensures that only authorized counselors with valid credentials and proper permissions can create counseling records in the Guidance Counselor Record System.

**Endpoint:**

**URL:** `http://localhost:5000/api/records`

**Method:** POST

**Configurations:**

The API request must be authenticated to ensure secure access to the Guidance Counselor Record System record creation process. The request must include a valid token in the header to verify the identity of the user making the request. Additionally, the user must have the `can_edit_records` permission to create new counseling records.

**Parameters:**

➢ **_token** – this is required for handling requests to this API endpoint. The token should be sent in the request header to verify the identity of the user making the request.

➢ **_clientName** – this is required to specify the name of the client for the counseling session. It should be included in the request body.

➢ **_date** – this is required to specify the date of the counseling session. It should be included in the request body in ISO date format.

➢ **_sessionType** – this is optional and specifies the type of counseling session. It should be included in the request body.

➢ **_status** – this is optional and specifies the status of the counseling session (e.g., "Ongoing", "Completed", "Referred"). It should be included in the request body.

➢ **_sessionNumber** – this is optional and specifies the session number for the client. It should be included in the request body as a number.

➢ **_notes** – this is optional and contains detailed notes about the counseling session. It should be included in the request body.

➢ **_outcomes** – this is optional and describes the outcomes or results of the counseling session. It should be included in the request body.

➢ **_errorMessage** – this is optional and is returned in the response body to provide details about any record creation issues, such as "Missing required fields", "Invalid data format", "Insufficient permissions", or "Server error during record creation".

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "clientName": "John Doe",
  "date": "2024-12-15T10:00:00.000Z",
  "sessionType": "Individual",
  "status": "Ongoing",
  "sessionNumber": 1,
  "notes": "Initial counseling session. Client discussed personal concerns.",
  "outcomes": "Client expressed willingness to continue sessions."
}
```

**Success Response (201 Created):**
```json
{
  "message": "Record created successfully",
  "record": {
    "_id": "507f1f77bcf86cd799439011",
    "clientName": "John Doe",
    "date": "2024-12-15T10:00:00.000Z",
    "sessionType": "Individual",
    "status": "Ongoing",
    "sessionNumber": 1,
    "notes": "Initial counseling session. Client discussed personal concerns.",
    "outcomes": "Client expressed willingness to continue sessions.",
    "counselor": "Counselor Name",
    "createdAt": "2024-12-15T10:05:00.000Z"
  }
}
```

**Error Response (400 Bad Request - Missing Fields):**
```json
{
  "message": "Client name and date are required"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "message": "Authentication required"
}
```

**Error Response (403 Forbidden - Insufficient Permissions):**
```json
{
  "message": "Insufficient permissions to create records"
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "message": "Server error during record creation"
}
```

**Authentication**: Required (JWT, `can_edit_records` permission)

**Component Interaction**:
- Frontend: User fills form → Submits → Backend validates → Creates record → Returns success

---

### PUT `/api/records/:id`
**Purpose**: Update an existing counseling record

**Input**: Same as POST, but all fields optional

**Output**:
```json
{
  "message": "Record updated successfully",
  "record": { ... }
}
```

**Authentication**: Required (JWT, `can_edit_records` permission)

**Record Locking**: Checks if record is locked before update (prevents concurrent edits)

**Component Interaction**:
- Frontend: User edits record → Checks lock status → Updates if unlocked → Shows success/error

---

### DELETE `/api/records/:id`
**Purpose**: Delete a counseling record

**Input**: Record ID in URL parameter

**Output**:
```json
{
  "message": "Record deleted successfully"
}
```

**Authentication**: Required (JWT, `can_edit_records` permission)

---

### GET `/api/records/:id/generate-pdf`
**Purpose**: Generate PDF for a single record

**Input**: Record ID in URL parameter

**Output**: PDF file stream (Content-Type: application/pdf)

**Authentication**: Required (JWT, `can_view_records` permission)

**Component Interaction**:
- Frontend: User clicks "Generate PDF" → Downloads PDF → Opens in browser/PDF viewer

**PDF Generation**: Uses PDFKit library, includes header/footer, tracking number

---

### POST `/api/records/:id/upload-drive`
**Purpose**: Upload record PDF to Google Drive

**Input**: Record ID in URL parameter

**Output**:
```json
{
  "message": "Record uploaded to Google Drive successfully",
  "driveFileId": "string",
  "driveLink": "https://drive.google.com/file/d/..."
}
```

**Authentication**: Required (JWT, `can_edit_records` permission, Google Drive OAuth)

**External Integration**: Google Drive API

**Component Interaction**:
- Frontend: User clicks "Upload to Drive" → Checks Drive connection → Backend generates PDF → Uploads to Drive → Updates record with Drive link

---

### POST `/api/records/:id/lock`
**Purpose**: Lock a record for editing (prevents other users from editing)

**Input**: None

**Output**:
```json
{
  "message": "Record locked successfully",
  "lockStatus": {
    "locked": true,
    "lockedBy": "user_id",
    "lockedAt": "ISO date",
    "lockOwner": true
  }
}
```

**Authentication**: Required (JWT, `can_view_records` permission)

**Component Interaction**:
- Frontend: User clicks "Lock" → Record locked → Other users see "Locked by X" message

---

### POST `/api/records/:id/unlock`
**Purpose**: Unlock a record (only lock owner can unlock)

**Input**: None

**Output**:
```json
{
  "message": "Record unlocked successfully"
}
```

**Authentication**: Required (JWT, `can_view_records` permission)

---

### GET `/api/records/:id/lock-status`
**Purpose**: Get current lock status of a record

**Input**: Record ID in URL parameter

**Output**:
```json
{
  "locked": true,
  "lockedBy": "user_id",
  "lockedAt": "ISO date",
  "canLock": true,
  "canUnlock": true,
  "isLockOwner": false
}
```

**Authentication**: Required (JWT, `can_view_records` permission)

---

### GET `/api/records/:id/lock-logs`
**Purpose**: Get lock history for a record

**Input**: Record ID in URL parameter

**Output**:
```json
{
  "logs": [
    {
      "action": "lock" | "unlock",
      "userId": "string",
      "userName": "string",
      "timestamp": "ISO date"
    }
  ]
}
```

**Authentication**: Required (JWT, `can_view_records` permission)

---

## Admin APIs

### 2.1.4 Module Description

The Admin Module provides comprehensive endpoints for system administration, user management, record oversight, reporting, analytics, session management, backup operations, and system configuration. These operations include accessing dashboard summaries, managing user accounts and permissions, overseeing counseling records, generating comprehensive reports, viewing system analytics, managing active sessions, creating and restoring backups, managing announcements, and configuring system settings. Each endpoint ensures secure access through admin token-based authentication, validates administrative input, protects system integrity, maintains comprehensive audit trails, and enforces role-based access control. The API uses comprehensive response codes: 200 (OK) for successful operations, 201 (Created) for resource creation, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, 404 (Not Found) for unavailable resources, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/api/admin/dashboard`
* `http://localhost:5000/api/admin/summary`
* `http://localhost:5000/api/admin/users`
* `http://localhost:5000/api/admin/users/:userId`
* `http://localhost:5000/api/admin/users/:userId/status`
* `http://localhost:5000/api/admin/users/:userId/reset-password`
* `http://localhost:5000/api/admin/users/:userId/permissions`
* `http://localhost:5000/api/admin/records`
* `http://localhost:5000/api/admin/records/:id`
* `http://localhost:5000/api/admin/reports/overview`
* `http://localhost:5000/api/admin/reports/generate`
* `http://localhost:5000/api/admin/reports`
* `http://localhost:5000/api/admin/reports/:id`
* `http://localhost:5000/api/admin/reports/:id/download-pdf`
* `http://localhost:5000/api/admin/analytics/overview`
* `http://localhost:5000/api/admin/analytics/page-visits`
* `http://localhost:5000/api/admin/analytics/events`
* `http://localhost:5000/api/admin/sessions`
* `http://localhost:5000/api/admin/sessions/:sessionId/logout`
* `http://localhost:5000/api/admin/backups`
* `http://localhost:5000/api/admin/backups/:backupId/restore`
* `http://localhost:5000/api/admin/announcements`
* `http://localhost:5000/api/admin/settings`

---

### Dashboard & Summary

#### GET `/api/admin/dashboard`
**Purpose**: Get admin dashboard data

**Input**: None

**Output**:
```json
{
  "message": "Welcome Admin {name}",
  "email": "string",
  "role": "admin",
  "name": "string"
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/summary`
**Purpose**: Get system-wide summary statistics

**Input**: None

**Output**:
```json
{
  "totalRecords": 100,
  "completedSessions": 50,
  "ongoingSessions": 30,
  "referredSessions": 20,
  "totalCounselors": 10,
  "activeCounselors": 5
}
```

**Authentication**: Required (Admin JWT)

**Component Interaction**:
- Frontend: `AdminDashboard.jsx` → Fetches summary → Displays in cards

---

### User Management

#### GET `/api/admin/users`
**Purpose**: Get all users with filters and pagination

**Input**: Query parameters:
- `page`: number
- `limit`: number (default: 10)
- `search`: string (name/email search)
- `role`: string (filter by role)
- `status`: string (active/inactive)

**Output**:
```json
{
  "users": [
    {
      "_id": "string",
      "name": "string",
      "email": "string",
      "role": "string",
      "status": "active" | "inactive",
      "createdAt": "ISO date"
    }
  ],
  "pagination": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### POST `/api/admin/users`
**Purpose**: Create a new user (counselor)

**Input**:
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "counselor"
}
```

**Output**:
```json
{
  "message": "User created successfully",
  "user": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/users/:userId`
**Purpose**: Update user information

**Input**:
```json
{
  "name": "string",
  "email": "string",
  "role": "string"
}
```

**Output**:
```json
{
  "message": "User updated successfully",
  "user": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### PATCH `/api/admin/users/:userId/status`
**Purpose**: Toggle user account status (activate/deactivate)

**Input**: None

**Output**:
```json
{
  "message": "User status updated successfully",
  "user": {
    "status": "active" | "inactive"
  }
}
```

**Authentication**: Required (Admin JWT)

---

#### DELETE `/api/admin/users/:userId`
**Purpose**: Delete a user account

**Input**: User ID in URL parameter

**Output**:
```json
{
  "message": "User deleted successfully"
}
```

**Authentication**: Required (Admin JWT)

---

#### POST `/api/admin/users/:userId/reset-password`
**Purpose**: Admin-initiated password reset

**Input**:
```json
{
  "newPassword": "string"
}
```

**Output**:
```json
{
  "message": "Password reset successfully"
}
```

**Authentication**: Required (Admin JWT)

---

### User Permissions (RBAC)

#### GET `/api/admin/users/:userId/permissions`
**Purpose**: Get user permissions

**Input**: User ID in URL parameter

**Output**:
```json
{
  "permissions": {
    "can_view_records": true,
    "can_edit_records": true,
    "can_view_reports": false,
    "is_admin": false
  }
}
```

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/users/:userId/permissions`
**Purpose**: Update user permissions

**Input**:
```json
{
  "can_view_records": true,
  "can_edit_records": true,
  "can_view_reports": false,
  "is_admin": false
}
```

**Output**:
```json
{
  "message": "Permissions updated successfully",
  "permissions": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

### Admin Record Management

#### GET `/api/admin/records`
**Purpose**: Get all records (admin view with additional data)

**Input**: Query parameters (similar to `/api/records`)

**Output**: Same as `/api/records` but with additional admin metadata

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/records/:id`
**Purpose**: Get single record by ID

**Input**: Record ID in URL parameter

**Output**: Record object

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/records/:id`
**Purpose**: Update record (admin override, can unlock)

**Input**: Same as PUT `/api/records/:id`

**Output**: Updated record

**Authentication**: Required (Admin JWT)

---

#### DELETE `/api/admin/records/:id`
**Purpose**: Delete record

**Input**: Record ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

### Admin Profile

#### GET `/api/admin/profile`
**Purpose**: Get admin profile

**Input**: None

**Output**: Admin profile object

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/profile`
**Purpose**: Update admin profile

**Input**: Profile fields

**Output**: Updated profile

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/profile/password`
**Purpose**: Change admin password

**Input**:
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### POST `/api/admin/profile/picture`
**Purpose**: Upload admin profile picture

**Input**: FormData with file

**Output**: Updated profile with picture URL

**Authentication**: Required (Admin JWT)

---

#### DELETE `/api/admin/profile/picture`
**Purpose**: Remove admin profile picture

**Input**: None

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/profile/activity`
**Purpose**: Get admin activity logs

**Input**: Query parameters (pagination)

**Output**: Activity logs array

**Authentication**: Required (Admin JWT)

---

### Admin Settings

#### GET `/api/admin/settings`
**Purpose**: Get all admin settings

**Input**: None

**Output**:
```json
{
  "display": {
    "theme": "light" | "dark",
    "language": "string"
  },
  "notifications": {
    "emailNotifications": true,
    "pushNotifications": false
  },
  "privacy": {
    "dataRetention": "number"
  }
}
```

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/settings/display`
**Purpose**: Update display settings

**Input**:
```json
{
  "theme": "string",
  "language": "string"
}
```

**Output**: Updated settings

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/settings/notifications`
**Purpose**: Update notification settings

**Input**: Notification preferences

**Output**: Updated settings

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/settings/privacy`
**Purpose**: Update privacy settings

**Input**: Privacy preferences

**Output**: Updated settings

**Authentication**: Required (Admin JWT)

---

### Admin Reports

#### GET `/api/admin/reports/overview`
**Purpose**: Get reports dashboard overview (summary cards)

**Input**: None

**Output**:
```json
{
  "totalRecords": 100,
  "completedSessions": 50,
  "ongoingSessions": 30,
  "totalCounselors": 10,
  "totalPDFs": 200,
  "filesUploaded": 150
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/reports/counselors`
**Purpose**: Get counselors list for filter dropdown

**Input**: None

**Output**:
```json
{
  "counselors": [
    {
      "_id": "string",
      "name": "string",
      "email": "string"
    }
  ]
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/reports/records`
**Purpose**: Get filtered records for report generation

**Input**: Query parameters:
- `clientName`: string
- `counselorName`: string
- `status`: string
- `recordType`: string
- `sessionType`: string
- `startDate`: date
- `endDate`: date
- `counselorId`: ObjectId
- `page`: number
- `limit`: number (default: 3)

**Output**:
```json
{
  "records": [ ... ],
  "pagination": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/reports`
**Purpose**: Get all generated reports

**Input**: Query parameters:
- `page`: number (default: 1)
- `limit`: number (default: 3)
- `reportType`: string (filter)

**Output**:
```json
{
  "reports": [
    {
      "_id": "string",
      "reportName": "string",
      "reportType": "string",
      "trackingNumber": "string",
      "generatedBy": {
        "userId": "string",
        "userName": "string",
        "userEmail": "string"
      },
      "statistics": { ... },
      "driveFileId": "string",
      "driveLink": "string",
      "fileName": "string",
      "createdAt": "ISO date"
    }
  ],
  "pagination": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/reports/:id`
**Purpose**: Get report by ID

**Input**: Report ID in URL parameter

**Output**: Report object with full details

**Authentication**: Required (Admin JWT)

---

#### POST `/api/admin/reports/generate`
**Purpose**: Generate a new admin report (PDF)

**Input**:
```json
{
  "reportName": "string",
  "reportType": "string",
  "filterCriteria": {
    "clientName": "string",
    "counselorName": "string",
    "status": "string",
    "startDate": "ISO date",
    "endDate": "ISO date",
    "counselorId": "string"
  }
}
```

**Output**:
```json
{
  "message": "Report generated successfully",
  "report": {
    "_id": "string",
    "trackingNumber": "string",
    "driveFileId": "string",
    "driveLink": "string",
    "fileName": "string"
  }
}
```

**Authentication**: Required (Admin JWT)

**External Integration**: 
- PDFKit for PDF generation
- Google Drive API for file upload (optional)

**Component Interaction**:
- Frontend: Admin sets filters → Clicks "Generate PDF" → Backend creates PDF → Uploads to Drive (if configured) → Saves metadata to database → Returns report object

---

#### GET `/api/admin/reports/:id/download-pdf`
**Purpose**: Download report PDF file directly

**Input**: Report ID in URL parameter

**Output**: PDF file stream (Content-Type: application/pdf)

**Authentication**: Required (Admin JWT)

**Component Interaction**:
- Frontend: User clicks "Download" → Backend fetches from Drive → Streams PDF to client → Browser downloads

---

#### GET `/api/admin/reports/:id/download`
**Purpose**: Get Google Drive download link for report

**Input**: Report ID in URL parameter

**Output**:
```json
{
  "driveLink": "https://drive.google.com/file/d/...",
  "message": "Download link retrieved"
}
```

**Authentication**: Required (Admin JWT)

---

### Admin Analytics

#### GET `/api/admin/analytics/overview`
**Purpose**: Get analytics overview (summary cards)

**Input**: None

**Output**:
```json
{
  "totalPageVisits": 1000,
  "totalEvents": 500,
  "activeUsers": 25,
  "totalRecords": 100
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/analytics/page-visits`
**Purpose**: Get page visits analytics

**Input**: Query parameters:
- `startDate`: date
- `endDate`: date
- `module`: string (filter)

**Output**:
```json
{
  "pageVisits": [
    {
      "module": "string",
      "page": "string",
      "count": 100,
      "date": "ISO date"
    }
  ]
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/analytics/events`
**Purpose**: Get event analytics

**Input**: Query parameters (filters)

**Output**: Event analytics data

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/analytics/record-status-distribution`
**Purpose**: Get record status distribution

**Input**: None

**Output**:
```json
{
  "distribution": {
    "Completed": 50,
    "Ongoing": 30,
    "Referred": 20
  }
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/analytics/daily-records`
**Purpose**: Get daily records created statistics

**Input**: Query parameters:
- `startDate`: date
- `endDate`: date

**Output**:
```json
{
  "dailyRecords": [
    {
      "date": "ISO date",
      "count": 10
    }
  ]
}
```

**Authentication**: Required (Admin JWT)

---

### Admin Backup & Restore

#### POST `/api/admin/backups`
**Purpose**: Create a new system backup

**Input**: None (optional backup name in body)

**Output**:
```json
{
  "message": "Backup created successfully",
  "backup": {
    "_id": "string",
    "backupName": "string",
    "backupDate": "ISO date",
    "size": 1000000,
    "recordCount": 100
  }
}
```

**Authentication**: Required (Admin JWT)

**Component Interaction**:
- Frontend: Admin clicks "Backup Now" → Backend creates MongoDB backup → Saves to Backup collection → Returns backup metadata

---

#### GET `/api/admin/backups`
**Purpose**: Get all backups with pagination

**Input**: Query parameters:
- `page`: number
- `limit`: number
- `filter`: string (all/recent/old)

**Output**:
```json
{
  "backups": [
    {
      "_id": "string",
      "backupName": "string",
      "backupDate": "ISO date",
      "size": 1000000,
      "recordCount": 100
    }
  ],
  "pagination": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/backups/:backupId`
**Purpose**: Get single backup by ID

**Input**: Backup ID in URL parameter

**Output**: Backup object

**Authentication**: Required (Admin JWT)

---

#### POST `/api/admin/backups/:backupId/restore`
**Purpose**: Restore system from backup

**Input**: Backup ID in URL parameter

**Output**:
```json
{
  "message": "Backup restored successfully",
  "restoredCount": 100
}
```

**Authentication**: Required (Admin JWT)

**Component Interaction**:
- Frontend: Admin selects backup → Clicks "Restore" → Backend validates → Restores data using MongoDB transactions → Returns success

---

#### DELETE `/api/admin/backups/:backupId`
**Purpose**: Delete a backup

**Input**: Backup ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

### Admin Announcements

#### POST `/api/admin/announcements`
**Purpose**: Create and send announcement to counselors

**Input**:
```json
{
  "title": "string",
  "message": "string",
  "targetAudience": "all" | "specific",
  "targetUserIds": ["string"] (optional, if specific)
}
```

**Output**:
```json
{
  "message": "Announcement sent successfully",
  "announcement": {
    "_id": "string",
    "title": "string",
    "message": "string",
    "sentCount": 10
  }
}
```

**Authentication**: Required (Admin JWT)

**Component Interaction**:
- Frontend: Admin creates announcement → Selects recipients → Backend creates notification records → Sends to selected counselors → Returns success

---

#### GET `/api/admin/announcements`
**Purpose**: Get all announcements

**Input**: Query parameters (pagination)

**Output**: Announcements array

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/announcements/:id/deactivate`
**Purpose**: Deactivate an announcement

**Input**: Announcement ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

### Admin Sessions

#### GET `/api/admin/sessions`
**Purpose**: Get all active sessions

**Input**: Query parameters (pagination, filters)

**Output**:
```json
{
  "sessions": [
    {
      "_id": "string",
      "userId": "string",
      "userName": "string",
      "userEmail": "string",
      "lastActivity": "ISO date",
      "ipAddress": "string"
    }
  ],
  "pagination": { ... }
}
```

**Authentication**: Required (Admin JWT)

---

#### POST `/api/admin/sessions/:sessionId/logout`
**Purpose**: Force logout a specific session

**Input**: Session ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### GET `/api/admin/sessions/settings`
**Purpose**: Get session timeout settings

**Input**: None

**Output**:
```json
{
  "timeoutMinutes": 60,
  "inactivityTimeoutMinutes": 60
}
```

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/sessions/settings`
**Purpose**: Update session timeout settings

**Input**:
```json
{
  "timeoutMinutes": 60,
  "inactivityTimeoutMinutes": 60
}
```

**Output**: Updated settings

**Authentication**: Required (Admin JWT)

---

### Admin Notifications

#### GET `/api/admin/notifications`
**Purpose**: Get all system notifications

**Input**: Query parameters:
- `page`: number
- `limit`: number
- `category`: string (filter)
- `status`: string (read/unread)
- `priority`: string (filter)

**Output**: Notifications array with pagination

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/notifications/:notificationId/read`
**Purpose**: Mark notification as read

**Input**: Notification ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/notifications/:notificationId/unread`
**Purpose**: Mark notification as unread

**Input**: Notification ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### PUT `/api/admin/notifications/read-all`
**Purpose**: Mark all notifications as read

**Input**: None

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### DELETE `/api/admin/notifications/:notificationId`
**Purpose**: Delete a notification

**Input**: Notification ID in URL parameter

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

#### DELETE `/api/admin/notifications/read/all`
**Purpose**: Delete all read notifications

**Input**: None

**Output**: Success message

**Authentication**: Required (Admin JWT)

---

## Analytics APIs

### 2.1.5 Module Description

The Analytics Module provides endpoints for tracking system usage, monitoring user activities, and generating analytical insights. These operations include logging system events from the frontend, retrieving analytics overview with summary statistics, viewing page visit analytics, analyzing event patterns, tracking record status distribution, and monitoring daily record creation trends. Each endpoint ensures secure access through token-based authentication for admin endpoints, validates input data, protects analytics integrity, and provides comprehensive insights for system optimization. The API uses comprehensive response codes: 200 (OK) for successful operations, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/api/analytics/log-event`
* `http://localhost:5000/api/admin/analytics/overview`
* `http://localhost:5000/api/admin/analytics/page-visits`
* `http://localhost:5000/api/admin/analytics/events`
* `http://localhost:5000/api/admin/analytics/record-status-distribution`
* `http://localhost:5000/api/admin/analytics/daily-records`

---

### Public Analytics (Event Logging)

#### POST `/api/analytics/log-event`
**Purpose**: Log system events for analytics (public endpoint, used by frontend)

**Input**:
```json
{
  "eventType": "page_visit" | "record_created" | "record_updated" | "login" | "logout",
  "module": "string",
  "page": "string",
  "userId": "string (optional)",
  "metadata": "object (optional)"
}
```

**Output**:
```json
{
  "message": "Event logged successfully"
}
```

**Authentication**: None (public endpoint)

**Component Interaction**:
- Frontend: Various components automatically log events on user actions
- Backend: Stores events in `AnalyticsEvent` collection
- Admin Dashboard: Aggregates and displays analytics

**Event Types**:
- `page_visit`: User visits a page
- `record_created`: User creates a record
- `record_updated`: User updates a record
- `login`: User logs in
- `logout`: User logs out
- `file_uploaded`: File uploaded to Drive
- `pdf_generated`: PDF generated

---

## Notification APIs

### 2.1.6 Module Description

The Notification Module provides endpoints for managing real-time notifications, announcements, and communication between administrators and counselors. These operations include retrieving notifications with filtering and pagination, marking notifications as read or unread, getting unread notification counts, deleting individual or bulk notifications, creating and managing announcements, and tracking notification delivery. Each endpoint ensures secure access through token-based authentication, validates user input, protects notification data, maintains notification history, and supports real-time updates. The API uses comprehensive response codes: 200 (OK) for successful operations, 201 (Created) for resource creation, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, 404 (Not Found) for unavailable resources, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/api/counselor/notifications`
* `http://localhost:5000/api/counselor/notifications/unread-count`
* `http://localhost:5000/api/counselor/notifications/:notificationId/read`
* `http://localhost:5000/api/counselor/notifications/:notificationId/unread`
* `http://localhost:5000/api/counselor/notifications/read-all`
* `http://localhost:5000/api/counselor/notifications/:notificationId`
* `http://localhost:5000/api/counselor/notifications/read/all`
* `http://localhost:5000/api/admin/notifications`
* `http://localhost:5000/api/admin/notifications/:notificationId/read`
* `http://localhost:5000/api/admin/notifications/:notificationId/unread`
* `http://localhost:5000/api/admin/notifications/read-all`
* `http://localhost:5000/api/admin/notifications/:notificationId`
* `http://localhost:5000/api/admin/notifications/read/all`
* `http://localhost:5000/api/admin/announcements`
* `http://localhost:5000/api/admin/announcements/:id/deactivate`

---

### Counselor Notifications

#### GET `/api/counselor/notifications`
**Purpose**: Get all notifications for authenticated counselor

**Input**: Query parameters:
- `page`: number (default: 1)
- `limit`: number (default: 10)
- `status`: string (all/read/unread)
- `category`: string (filter)

**Output**:
```json
{
  "notifications": [
    {
      "_id": "string",
      "title": "string",
      "message": "string",
      "category": "string",
      "priority": "high" | "medium" | "low",
      "status": "read" | "unread",
      "createdAt": "ISO date"
    }
  ],
  "pagination": { ... }
}
```

**Authentication**: Required (JWT, Counselor role)

**Component Interaction**:
- Frontend: `NotificationCenter.jsx` → Fetches notifications → Displays in list → Supports pagination and filters

---

#### GET `/api/counselor/notifications/unread-count`
**Purpose**: Get unread notification count (for badge)

**Input**: None

**Output**:
```json
{
  "unreadCount": 5
}
```

**Authentication**: Required (JWT, Counselor role)

**Component Interaction**:
- Frontend: Polls this endpoint periodically → Updates notification badge count

---

#### PUT `/api/counselor/notifications/:notificationId/read`
**Purpose**: Mark notification as read

**Input**: Notification ID in URL parameter

**Output**: Success message

**Authentication**: Required (JWT, Counselor role)

---

#### PUT `/api/counselor/notifications/:notificationId/unread`
**Purpose**: Mark notification as unread

**Input**: Notification ID in URL parameter

**Output**: Success message

**Authentication**: Required (JWT, Counselor role)

---

#### PUT `/api/counselor/notifications/read-all`
**Purpose**: Mark all notifications as read for this counselor

**Input**: None

**Output**: Success message

**Authentication**: Required (JWT, Counselor role)

---

#### DELETE `/api/counselor/notifications/:notificationId`
**Purpose**: Delete a notification

**Input**: Notification ID in URL parameter

**Output**: Success message

**Authentication**: Required (JWT, Counselor role)

---

#### DELETE `/api/counselor/notifications/read/all`
**Purpose**: Delete all read notifications for this counselor

**Input**: None

**Output**: Success message

**Authentication**: Required (JWT, Counselor role)

---

### Counselor Settings

#### GET `/api/counselor/settings`
**Purpose**: Get counselor settings

**Input**: None

**Output**: Settings object

**Authentication**: Required (JWT, Counselor role)

---

#### PUT `/api/counselor/settings`
**Purpose**: Update counselor settings

**Input**: Settings object

**Output**: Updated settings

**Authentication**: Required (JWT, Counselor role)

---

#### POST `/api/counselor/settings/reset`
**Purpose**: Reset settings to defaults

**Input**: None

**Output**: Success message

**Authentication**: Required (JWT, Counselor role)

---

## External Integration APIs

### 2.1.7 Module Description

The External Integration Module provides endpoints for integrating with third-party services including Google Drive for document storage and Google Calendar for scheduling management. These operations include initiating OAuth flows for Google Drive and Google Calendar, handling OAuth callbacks, retrieving calendar events for dashboard display, and managing external service connections. Each endpoint ensures secure access through OAuth 2.0 authentication protocols, validates external service responses, protects token storage, maintains connection status, and handles token refresh automatically. The API uses comprehensive response codes: 200 (OK) for successful operations, 302 (Redirect) for OAuth flows, 400 (Bad Request) for invalid input, 401 (Unauthorized) for missing or invalid tokens, 403 (Forbidden) for insufficient permissions, and 500 (Internal Server Error) for unexpected server issues.

**Endpoints:**
* `http://localhost:5000/auth/drive`
* `http://localhost:5000/auth/drive/callback`
* `http://localhost:5000/auth/google/calendar/connect`
* `http://localhost:5000/auth/google/calendar/callback`
* `http://localhost:5000/auth/dashboard/calendar-events`

---

### Google Drive Integration

#### GET `/auth/drive`
**Purpose**: Initiate Google Drive OAuth flow

**Input**: None (initiates OAuth redirect)

**Output**: Redirects to Google OAuth consent screen

**Component Interaction**:
- Frontend: User clicks "Connect Google Drive" → Redirects to Google → User grants permissions → Callback handles tokens

**External Integration**: Google Drive API (OAuth 2.0)

---

#### GET `/auth/drive/callback`
**Purpose**: Handle Google Drive OAuth callback

**Input**: OAuth code from Google (query parameters)

**Output**: Redirects to frontend with success message

**Component Interaction**:
- Google redirects here after authentication
- Backend stores access/refresh tokens
- Redirects to frontend with success status

**Token Storage**: Stored in session/user record for later use

---

### Google Calendar Integration

#### GET `/auth/google/calendar/connect`
**Purpose**: Initiate Google Calendar OAuth flow

**Input**: Query parameter:
- `token`: JWT token (optional, for authenticated users)

**Output**: Redirects to Google OAuth consent screen

**External Integration**: Google Calendar API (OAuth 2.0)

---

#### GET `/auth/google/calendar/callback`
**Purpose**: Handle Google Calendar OAuth callback

**Input**: OAuth code from Google

**Output**: Redirects to frontend dashboard

**Component Interaction**:
- Google redirects here after authentication
- Backend stores calendar access tokens
- Redirects to frontend

---

#### GET `/auth/dashboard/calendar-events`
**Purpose**: Get calendar events for dashboard

**Input**: None (uses JWT from Authorization header)

**Output**:
```json
{
  "connected": true,
  "events": [
    {
      "id": "string",
      "summary": "string",
      "start": "ISO date",
      "end": "ISO date",
      "location": "string"
    }
  ]
}
```

**Authentication**: Required (JWT Bearer token)

**External Integration**: Google Calendar API

**Component Interaction**:
- Frontend: `Dashboard.jsx` → Fetches events on mount → Displays upcoming events → Auto-refreshes every 5 minutes

---

## Data Flow Diagrams

### User Login Flow
```
Frontend (Login.jsx)
  ↓
POST /api/auth/login
  ↓
Backend validates credentials
  ↓
Backend generates JWT token
  ↓
Backend creates/updates Session record
  ↓
Returns JWT token + user data
  ↓
Frontend stores token in localStorage
  ↓
Frontend redirects to Dashboard
  ↓
Dashboard calls GET /api/auth/me
  ↓
Backend validates JWT
  ↓
Returns user data
  ↓
Frontend displays dashboard
```

### Record Creation Flow
```
Frontend (RecordsPage.jsx)
  ↓
User fills record form
  ↓
POST /api/records
  ↓
Backend validates JWT (protect middleware)
  ↓
Backend checks can_edit_records permission
  ↓
Backend validates record data
  ↓
Backend creates Record in MongoDB
  ↓
Backend logs activity (ActivityLog)
  ↓
Backend logs analytics event (AnalyticsEvent)
  ↓
Returns created record
  ↓
Frontend updates table
  ↓
Frontend shows success message
```

### PDF Generation Flow
```
Frontend (AdminReports.jsx)
  ↓
Admin sets filters
  ↓
POST /api/admin/reports/generate
  ↓
Backend validates Admin JWT
  ↓
Backend fetches filtered records from MongoDB
  ↓
Backend calculates statistics
  ↓
Backend generates PDF using PDFKit
  ↓
Backend uploads to Google Drive (optional)
  ↓
Backend saves AdminReport metadata to MongoDB
  ↓
Backend logs activity
  ↓
Returns report metadata with Drive link
  ↓
Frontend displays in reports table
  ↓
User clicks "Download"
  ↓
GET /api/admin/reports/:id/download-pdf
  ↓
Backend fetches PDF from Drive or generates on-the-fly
  ↓
Backend streams PDF to client
  ↓
Browser downloads PDF
```

### Google Drive Upload Flow
```
Frontend (RecordsPage.jsx)
  ↓
User clicks "Upload to Drive"
  ↓
Checks if Drive is connected
  ↓
POST /api/records/:id/upload-drive
  ↓
Backend validates JWT
  ↓
Backend fetches record from MongoDB
  ↓
Backend generates PDF using PDFKit
  ↓
Backend retrieves stored OAuth tokens
  ↓
Backend calls Google Drive API
  ↓
Uploads PDF to Drive
  ↓
Backend updates Record with driveFileId and driveLink
  ↓
Returns success with Drive link
  ↓
Frontend displays Drive link
```

### Notification Flow
```
Admin creates announcement
  ↓
POST /api/admin/announcements
  ↓
Backend validates Admin JWT
  ↓
Backend determines target counselors
  ↓
Backend creates CounselorNotification records for each counselor
  ↓
Returns success
  ↓
Counselors' NotificationCenter polls GET /api/counselor/notifications
  ↓
Backend returns unread notifications
  ↓
Frontend displays notifications with badge count
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "code": "ERROR_CODE (optional)",
  "details": {} (optional, for development)
}
```

### Response Codes of this API

| Code | Message | Description |
|------|---------|-------------|
| 200 | OK | The request was successful |
| 201 | Created | Resource created successfully |
| 302 | Found | Redirect response (used in OAuth flows) |
| 400 | Bad Request | The request was invalid or contains invalid input data |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions or access denied |
| 404 | Not Found | The requested resource could not be found |
| 409 | Conflict | Resource conflict (e.g., duplicate email or record locked) |
| 500 | Internal Server Error | The server encountered an unexpected error |

### Error Handling in Frontend

Frontend components typically use try-catch blocks and display errors using:
- SweetAlert2 for user-friendly error messages
- Console logging for debugging
- Error states in component state

Example:
```javascript
try {
  const response = await axios.post('/api/records', recordData);
  // Handle success
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 403) {
    // Show permission error
  } else {
    // Show generic error
  }
}
```

---

## Authentication Mechanisms

### JWT (JSON Web Tokens)

**Token Structure**:
- Header: Algorithm and token type
- Payload: User ID, role, expiration
- Signature: HMAC signature

**Token Storage**:
- Frontend: localStorage (counselor) or localStorage (admin)
- Keys: `token` (counselor) or `adminToken` (admin)

**Token Expiration**:
- Access Token: 1 day (configurable)
- Refresh Token: 7 days (if implemented)

### Middleware Chain

1. **CORS Middleware**: Allows cross-origin requests
2. **JSON Parser**: Parses request body
3. **Cookie Parser**: Parses cookies
4. **Session Middleware**: Manages OAuth sessions
5. **Passport Middleware**: Handles OAuth authentication
6. **Protect Middleware** (`protect`): Validates JWT token
7. **Admin Middleware** (`protectAdmin`): Validates admin JWT
8. **Permission Middleware** (`authorize`): Checks RBAC permissions
9. **Route Handler**: Executes controller logic

### RBAC Permissions

**Permission Checks**:
- `can_view_records`: View counseling records
- `can_edit_records`: Create/update/delete records
- `can_view_reports`: View reports
- `can_generate_reports`: Generate reports (admin only)
- `is_admin`: Admin-level access

**Permission Middleware Usage**:
```javascript
router.get("/records", protect, authorize("can_view_records"), getRecords);
router.post("/records", protect, authorize("can_edit_records"), createRecord);
```

---

## API Versioning

Currently, the system does not use explicit API versioning. All endpoints are under `/api/*` without version numbers. Future versions may introduce `/api/v1/*`, `/api/v2/*`, etc.

---

## Rate Limiting

Currently, the system does not implement rate limiting. This can be added using middleware like `express-rate-limit` to prevent abuse.

---

## CORS Configuration

CORS is configured to allow requests from:
- Frontend URL: `http://localhost:5173` (configurable via `CLIENT_URL`)
- Methods: GET, POST, PUT, DELETE
- Credentials: Enabled (for cookies and authentication)

---

## Summary

This Counseling Services Management System provides a comprehensive REST API covering:
- **Authentication & Authorization**: Multiple OAuth providers, JWT-based auth, RBAC
- **CRUD Operations**: Full CRUD for records, users, profiles
- **Administrative Functions**: User management, analytics, reports, backups
- **External Integrations**: Google Drive, Google Calendar, Email (Nodemailer)
- **Real-time Features**: Notifications, activity logging, session management
- **Data Analytics**: Custom analytics system with event logging

All APIs follow RESTful principles and use standard HTTP methods and status codes. The system is designed for scalability and maintainability with clear separation of concerns between routes, controllers, and middleware.

