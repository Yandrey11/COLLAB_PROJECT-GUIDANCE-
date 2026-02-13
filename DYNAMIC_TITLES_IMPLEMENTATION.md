# Dynamic Browser Tab Titles Implementation

This document describes the implementation of dynamic browser tab titles for the entire frontend application.

## Overview

All pages in the application now dynamically update the browser tab title (`<title>`) based on the current route. Each title follows the format: `{Page Title} – Guidance Counseling System`, with a default fallback of `Guidance Counseling System`.

---

## Implementation Details

### 1. Custom Hook: `useDocumentTitle`

**Location**: `frontend/src/hooks/useDocumentTitle.js`

**Purpose**: Centralized hook to update the document title when a component mounts.

**Usage**:
```javascript
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function MyPage() {
  useDocumentTitle("My Page Title");
  // ... rest of component
}
```

**Features**:
- Automatically appends " – Guidance Counseling System" to the page title
- Updates immediately when component mounts
- Handles empty/null titles gracefully (falls back to base title)

---

### 2. Route Titles Configuration

**Location**: `frontend/src/config/routeTitles.js`

**Purpose**: Centralized mapping of routes to their corresponding page titles (for reference/future use).

**Features**:
- Maps all routes to their titles
- Helper function `getTitleForRoute()` to get title for a given pathname
- Easy to maintain and update

---

## Implemented Titles

### Counselor Pages

| Route | Title |
|-------|-------|
| `/dashboard` | `Dashboard – Guidance Counseling System` |
| `/records` | `Counseling Records – Guidance Counseling System` |
| `/reports` | `Reports – Guidance Counseling System` |
| `/notifications` | `Notifications – Guidance Counseling System` |
| `/profile` | `My Profile – Guidance Counseling System` |
| `/settings` | `Settings – Guidance Counseling System` |

### Admin Pages

| Route | Title |
|-------|-------|
| `/AdminLogin` | `Admin Login – Guidance Counseling System` |
| `/adminsignup` | `Admin Sign Up – Guidance Counseling System` |
| `/AdminDashboard` | `Admin Dashboard – Guidance Counseling System` |
| `/admin/users` | `Admin User Management – Guidance Counseling System` |
| `/admin/notifications` | `Admin Notifications – Guidance Counseling System` |
| `/admin/records` | `Admin Record Management – Guidance Counseling System` |
| `/admin/profile` | `Admin Profile – Guidance Counseling System` |
| `/admin/settings` | `Admin Settings – Guidance Counseling System` |

### Public Pages

| Route | Title |
|-------|-------|
| `/` | `Home – Guidance Counseling System` |
| `/login` | `Login – Guidance Counseling System` |
| `/signup` | `Sign Up – Guidance Counseling System` |
| `/forgot-password` | `Forgot Password – Guidance Counseling System` |
| `/reset-password` | `Reset Password – Guidance Counseling System` |
| `/set-password` | `Set Password – Guidance Counseling System` |

---

## Updated Files

### Hook & Configuration
- ✅ `frontend/src/hooks/useDocumentTitle.js` - Custom hook
- ✅ `frontend/src/config/routeTitles.js` - Route title mapping

### Counselor Pages
- ✅ `frontend/src/pages/Dashboard.jsx`
- ✅ `frontend/src/pages/RecordsPage.jsx`
- ✅ `frontend/src/pages/ReportsPage.jsx`
- ✅ `frontend/src/pages/NotificationCenter.jsx`
- ✅ `frontend/src/pages/ProfilePage.jsx`
- ✅ `frontend/src/pages/SettingsPage.jsx`

### Admin Pages
- ✅ `frontend/src/pages/Admin/AdminDashboard.jsx`
- ✅ `frontend/src/pages/Admin/AdminLogin.jsx`
- ✅ `frontend/src/pages/Admin/AdminSignup.jsx`
- ✅ `frontend/src/pages/Admin/UserManagement.jsx`
- ✅ `frontend/src/pages/Admin/NotificationCenter.jsx`
- ✅ `frontend/src/pages/Admin/AdminRecordManagement.jsx`
- ✅ `frontend/src/pages/Admin/AdminProfilePage.jsx`
- ✅ `frontend/src/pages/Admin/AdminSettingsPage.jsx`

### Public Pages
- ✅ `frontend/src/pages/Landing.jsx`
- ✅ `frontend/src/pages/Login.jsx`
- ✅ `frontend/src/pages/Signup.jsx`
- ✅ `frontend/src/pages/ForgotPassword.jsx`
- ✅ `frontend/src/pages/ResetPassword.jsx`
- ✅ `frontend/src/pages/SetPassword.jsx`

**Total Pages Updated**: 20 pages

---

## How It Works

1. **Component Mount**: When a page component mounts, it calls `useDocumentTitle("Page Title")`.

2. **Hook Execution**: The hook:
   - Creates the full title: `"Page Title – Guidance Counseling System"`
   - Uses `useEffect` to update `document.title` when the component mounts or the title changes

3. **Browser Update**: The browser tab title is immediately updated to reflect the new title.

4. **Navigation**: When navigating between pages, each new page updates its title immediately upon mounting.

---

## Usage Example

```javascript
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function Dashboard() {
  // Set the page title - this will show as "Dashboard – Guidance Counseling System"
  useDocumentTitle("Dashboard");
  
  // ... rest of component code
}
```

---

## Benefits

✅ **Consistent Naming**: All titles follow the same pattern  
✅ **Centralized Logic**: Single hook manages all title updates  
✅ **Immediate Updates**: Titles change instantly on navigation  
✅ **Easy Maintenance**: Update titles in one place if needed  
✅ **No External Dependencies**: Uses built-in React hooks only  
✅ **SEO Friendly**: Descriptive titles help with search engine optimization  

---

## Testing

To verify the implementation:

1. **Navigate between pages** - Check that the browser tab title updates for each page
2. **Check specific pages** - Verify that titles match the expected format
3. **Test navigation** - Ensure titles update immediately without page refresh
4. **Verify default** - Check that pages without explicit titles use the default

---

## Future Enhancements

Possible improvements:
- Dynamic titles based on data (e.g., "Record #123 – Guidance Counseling System")
- Sub-page titles (e.g., "Settings > Account – Guidance Counseling System")
- Localization support for titles
- Title animation/transitions (if needed)

---

## Notes

- Titles update immediately when navigating (no delay)
- The hook is lightweight and has minimal performance impact
- All titles are consistent across Admin and Counselor roles
- The base title "Guidance Counseling System" is centralized in the hook

---

**Last Updated**: 2024  
**Implementation Status**: ✅ Complete

