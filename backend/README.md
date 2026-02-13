# Backend - Guidance Counseling Record Management System

This is the Node.js/Express backend for the Guidance Counseling Record Management System project.

## Project Overview

A comprehensive system for managing guidance counseling records with features including:
- User authentication (Local, Google OAuth, GitHub, Facebook)
- Admin management capabilities
- Counselor notifications and settings
- Record management and reporting
- Google Drive and Calendar integration
- Analytics and audit logging
- PDF report generation
- File upload handling

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: Passport.js (Local, OAuth)
- **Session Management**: express-session with MongoDB store
- **File Uploads**: Multer
- **Email**: Nodemailer
- **PDF Generation**: PDFKit
- **Google Integration**: Google APIs (Drive, Calendar, OAuth)
- **Security**: bcryptjs, JWT, cookie-session
- **Utilities**: axios, dotenv, cors

## Project Structure

```
backend/
├── app.js                 # Main application entry point
├── package.json          # Dependencies and scripts
├── config/               # Configuration files
│   ├── db.js            # MongoDB connection
│   ├── googleDrive.js   # Google Drive configuration
│   ├── googleOAuth.js   # Google OAuth setup
│   ├── passport.js      # Passport strategies
│   └── ...
├── controllers/          # Request handlers
│   ├── authController.js
│   ├── recordController.js
│   ├── profileController.js
│   ├── counselorNotificationController.js
│   └── ...
├── models/              # Mongoose schemas
│   ├── User.js
│   ├── Record.js
│   ├── CounselorSettings.js
│   └── ...
├── routes/              # API route definitions
├── middleware/          # Custom middleware
│   ├── authMiddleware.js
│   ├── permissionMiddleware.js
│   └── ...
├── utils/               # Utility functions
├── scripts/             # Utility scripts
├── temp/                # Temporary files
└── uploads/             # User file uploads
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB instance (local or cloud)
- Google OAuth credentials (optional, for Google integration)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with required environment variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/counseling_system
   JWT_SECRET=your_jwt_secret
   SESSION_SECRET=your_session_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
   ```

### Running the Application

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in .env)

## API Documentation

For detailed API documentation, refer to [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)

## Key Features

### Authentication
- Local authentication with bcryptjs
- Google OAuth 2.0
- GitHub OAuth
- Facebook OAuth
- JWT token management

### User Management
- User registration and login
- Profile management
- Role-based access control (RBAC)
- Session management

### Record Management
- CRUD operations for guidance records
- Record search and filtering
- PDF report generation

### Notifications
- Counselor notification system
- Notification settings management
- Activity logging

### Admin Features
- Admin user management
- System reports
- Audit logging
- Analytics tracking

### Google Integration
- Google Drive file management
- Google Calendar integration
- OAuth token management

## Middleware

- **authMiddleware**: Protects routes requiring authentication
- **permissionMiddleware**: Role-based access control
- **uploadMiddleware**: Handles file uploads
- **inactivityMiddleware**: Manages user inactivity sessions

## Database Models

Key MongoDB collections:
- `users` - User accounts
- `records` - Counseling records
- `counselor_settings` - Counselor preferences
- `counselor_notifications` - Notification history
- `admin_reports` - Generated reports
- `audit_logs` - System audit trail
- `analytics_events` - Analytics tracking
- `announcements` - System announcements

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `SESSION_SECRET` | Secret for session encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

### Code Style

The project follows standard JavaScript conventions. Review existing code for patterns to maintain consistency.

## Troubleshooting

- **MongoDB Connection Error**: Verify `MONGODB_URI` is correct and MongoDB is running
- **Port Already in Use**: Change `PORT` in `.env` file
- **Google OAuth Not Working**: Verify credentials and callback URL match in `.env`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test functionality
4. Commit and push
5. Create a pull request

## License

[Add license information here]

## Support

For issues or questions, contact the development team.
