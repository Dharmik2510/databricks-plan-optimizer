# BrickOptima Admin Dashboard Guide

## Overview

The Admin Dashboard provides comprehensive platform management capabilities for administrators. It includes analytics, user management, system monitoring, and analysis oversight.

---

## Table of Contents

1. [Accessing the Admin Dashboard](#accessing-the-admin-dashboard)
2. [Admin Dashboard Features](#admin-dashboard-features)
3. [User Management](#user-management)
4. [Analysis Management](#analysis-management)
5. [How to Make a User an Admin](#how-to-make-a-user-an-admin)
6. [Security & Permissions](#security--permissions)

---

## Accessing the Admin Dashboard

### Prerequisites

To access the admin dashboard, you must have one of the following roles:
- `ADMIN` - Standard admin privileges
- `SUPER_ADMIN` - Full admin privileges (future-proofing)

### Login Process

1. **Log in** to BrickOptima with your admin account
2. Look for the **"Admin Panel"** item in the sidebar (only visible to admins)
3. Click on **"Admin Panel"** to access the dashboard

The admin panel icon is a **Shield** icon located at the bottom of the sidebar navigation, separated by a divider line.

---

## Admin Dashboard Features

### 1. Analytics Overview

The main dashboard provides:

#### Key Metrics Cards
- **Total Users**: Platform-wide user count with new users this month
- **Total Analyses**: Analysis count with monthly breakdown
- **Success Rate**: Percentage of successful analyses
- **Avg Analyses/User**: User engagement metric

#### Visualizations

**User Growth Chart** (Line Chart)
- Track new user registrations over time
- Configurable time range (7, 30, or 90 days)
- Daily breakdown of new users

**Platform Usage Chart** (Bar Chart)
- Analyses performed per day
- Chat sessions initiated per day
- Side-by-side comparison

**Input Type Distribution** (Pie Chart)
- SPARK_PLAN usage percentage
- SQL_EXPLAIN usage percentage
- LOG_FILE usage percentage

**System Health Panel**
- Real-time system status (Healthy/Degraded)
- Queue metrics (pending/processing analyses)
- Recent failure count
- Average processing time

#### Feature Usage Statistics
- Chat session breakdown (with analysis vs standalone)
- Repository integration usage
- Active user count

---

### 2. User Management

Access via the "Users" tab in the admin sidebar.

#### Features

**User List View**
- Searchable table with all platform users
- Filters:
  - Search by email or name
  - Filter by role (USER, ADMIN, SUPER_ADMIN)
  - Filter by status (Active, Suspended)
- Pagination (20 users per page)

**User Information Displayed**
- Profile picture and name
- Email address
- Role badge
- Account status (Active/Suspended)
- Usage statistics (analyses, chat sessions)
- Join date

**User Actions**
- **Edit**: Modify user settings
- **Suspend**: Temporarily disable account
- **Activate**: Re-enable suspended account

#### Edit User Modal

When clicking "Edit" on a user, you can modify:

1. **Role**:
   - USER (standard user)
   - ADMIN (admin privileges)
   - SUPER_ADMIN (highest privileges)

2. **Monthly Quota Limit**:
   - Number of analyses allowed per month
   - Default: 100

3. **Account Status**:
   - Active/Inactive toggle

4. **View User Stats**:
   - Total analyses performed
   - Total chat sessions
   - Last login timestamp
   - Account creation date
   - Recent analyses preview

---

### 3. Analysis Management

Access via the "Analyses" tab in the admin sidebar.

#### Tabs

**Recent Analyses**
- Last 50 analyses across the platform
- Shows: Title, user, status, severity, processing time
- Sortable by creation date

**Failed Analyses**
- All failed analyses
- Shows: Title, user, error message, timestamp
- Useful for debugging and identifying system issues

#### Summary Cards
- Total recent analyses count
- Completed analyses count
- Total failed analyses requiring attention

---

## How to Make a User an Admin

There are **two methods** to promote a user to admin:

### Method 1: Via Admin Dashboard (Recommended)

1. Log in as an existing admin
2. Navigate to **Admin Panel** → **Users**
3. Search for the user by email or name
4. Click **"Edit"** next to the user
5. In the modal, change **Role** dropdown to:
   - `ADMIN` for standard admin access
   - `SUPER_ADMIN` for full admin access
6. Click **"Save Changes"**
7. The user will immediately have admin access on next login/page refresh

### Method 2: Via Database (Initial Setup)

If you need to create the first admin user (bootstrap scenario):

1. Access your PostgreSQL database
2. Run the following SQL command:

```sql
UPDATE users
SET role = 'ADMIN'
WHERE email = 'your-email@example.com';
```

For super admin:

```sql
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE email = 'your-email@example.com';
```

3. The user will see the Admin Panel in the sidebar on next login

### Method 3: Via Prisma Studio (Development)

1. Run: `npx prisma studio`
2. Navigate to the `User` model
3. Find the user record
4. Edit the `role` field to `ADMIN` or `SUPER_ADMIN`
5. Save the changes

---

## Security & Permissions

### Role-Based Access Control (RBAC)

**Roles:**
- `USER` - Standard user (default)
- `ADMIN` - Can access admin dashboard and manage users
- `SUPER_ADMIN` - Future-proofed for additional privileges

### Backend Security

All admin API endpoints are protected with:

1. **JWT Authentication** - Must be logged in
2. **Role Guard** - Must have ADMIN or SUPER_ADMIN role
3. **Active Account Check** - Account must not be suspended

### API Endpoints

Admin-only endpoints (all prefixed with `/api/v1/admin`):

**Analytics:**
- `GET /admin/analytics/overview`
- `GET /admin/analytics/user-growth?days=30`
- `GET /admin/analytics/usage-stats?days=30`
- `GET /admin/analytics/popular-features`
- `GET /admin/analytics/system-health`

**User Management:**
- `GET /admin/users?page=1&limit=20&search=...&role=...&isActive=...`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id` (Update role, quota, status)
- `PATCH /admin/users/:id/suspend`
- `PATCH /admin/users/:id/activate`
- `GET /admin/users/:id/activity?days=30`

**Analysis Management:**
- `GET /admin/analyses/recent?limit=50`
- `GET /admin/analyses/failed?limit=50`

### Frontend Protection

- Admin tab only visible to users with `role === 'ADMIN'` or `role === 'SUPER_ADMIN'`
- Checked via React context: `user?.role`
- Tab is conditionally rendered in sidebar

---

## Database Schema

### User Model Fields (Admin-Related)

```prisma
model User {
  role          UserRole  @default(USER)    // USER, ADMIN, SUPER_ADMIN
  isActive      Boolean   @default(true)    // Account suspension
  quotaLimit    Int       @default(100)     // Monthly analysis quota
}
```

### Enums

```prisma
enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}
```

---

## Design System Integration

The Admin Dashboard uses your existing design system:

**Components Used:**
- `Card`, `Card.Header`, `Card.Title` - Layout containers
- `Badge` - Status indicators (role, status, severity)
- `Button` - Actions
- `Input` - Search and forms
- `Modal` - Edit user dialog

**Charts:**
- Recharts library for all visualizations
- `LineChart` - User growth
- `BarChart` - Platform usage
- `PieChart` - Input type distribution

**Colors:**
- Primary blue: `#2196F3`
- Success green: `#10B981`
- Warning orange: `#F59E0B`
- Error red: `#EF4444`
- Purple: `#8B5CF6`

**Dark Mode:**
- Fully supports your existing dark mode theme
- Automatic color adjustments via Tailwind classes

---

## Best Practices

### User Management
1. **Be cautious with SUPER_ADMIN** - Reserve for primary administrators
2. **Monitor quota limits** - Adjust based on user needs and fair use
3. **Suspend, don't delete** - Suspended accounts can be reactivated
4. **Document role changes** - Keep track of who has admin access

### System Monitoring
1. **Check System Health daily** - Monitor degraded status alerts
2. **Review Failed Analyses** - Identify patterns and fix root causes
3. **Track User Growth** - Understand platform adoption trends
4. **Monitor Usage Stats** - Optimize based on peak usage times

### Security
1. **Limit admin accounts** - Only promote trusted users
2. **Regular audits** - Review admin user list periodically
3. **Monitor activity** - Check user activity logs for anomalies
4. **Update quotas** - Prevent abuse via reasonable limits

---

## Troubleshooting

### "Admin Panel not showing in sidebar"

**Possible causes:**
1. User doesn't have admin role → Check database `role` field
2. Not logged in with admin account → Verify logged-in user
3. Frontend cache → Hard refresh browser (Cmd/Ctrl + Shift + R)

### "403 Forbidden on admin API calls"

**Possible causes:**
1. Role guard blocking request → Verify user role in database
2. JWT token expired → Re-login
3. Account suspended → Check `isActive` field

### "Admin dashboard loads but shows no data"

**Possible causes:**
1. Backend not running → Check backend server status
2. Database connection issue → Verify DATABASE_URL in `.env`
3. API endpoint error → Check browser console and backend logs

---

## Future Enhancements

Potential additions to the admin dashboard:

1. **Audit Logs** - Track all admin actions
2. **Email Management** - Send notifications to users
3. **System Settings** - Configure platform-wide settings
4. **Advanced Analytics** - Export reports, custom date ranges
5. **User Impersonation** - Debug user issues (with security controls)
6. **API Rate Limiting** - Configure per-user rate limits
7. **Feature Flags** - Enable/disable features for specific users
8. **Billing Integration** - Track usage for pricing tiers

---

## Support

For questions or issues with the admin dashboard:

1. Check backend logs: `backend/logs/`
2. Check browser console for frontend errors
3. Review Prisma Studio for database state: `npx prisma studio`
4. Contact development team

---

**Last Updated:** 2025-12-27
**Version:** 1.0.0
