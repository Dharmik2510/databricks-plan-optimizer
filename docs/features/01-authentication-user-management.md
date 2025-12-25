# Authentication & User Management

## Feature Overview

Secure user authentication and session management system with JWT-based token authentication, multi-device session tracking, and password reset capabilities.

---

## Technical Architecture

### Frontend Components

#### 1. **AuthPage Component**
- **Location:** [frontend/AuthPage.tsx](../frontend/AuthPage.tsx)
- **Purpose:** Unified login and registration interface
- **Features:**
  - Tab-based UI for login/register switching
  - Form validation (email format, password strength)
  - Error handling with toast notifications
  - Redirect to dashboard on successful auth

#### 2. **AuthContext**
- **Location:** [frontend/AuthContext.tsx](../frontend/AuthContext.tsx)
- **Purpose:** Global authentication state management
- **State:**
  - `user`: Current user object (id, email, createdAt)
  - `isAuthenticated`: Boolean auth status
  - `isLoading`: Initial auth check state
- **Methods:**
  - `login(email, password)`: Authenticates user
  - `register(email, password)`: Creates new account
  - `logout()`: Clears session
  - `loadUser()`: Fetches current user from `/auth/me`

#### 3. **ProtectedRoute Component**
- **Location:** [frontend/ProtectedRoute.tsx](../frontend/ProtectedRoute.tsx)
- **Purpose:** Route guard for authenticated pages
- **Behavior:**
  - Redirects to `/auth` if not authenticated
  - Shows loading state during auth check

### Backend Modules

#### 1. **AuthController**
- **Location:** [backend/src/modules/auth/auth.controller.ts](../backend/src/modules/auth/auth.controller.ts)
- **Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Create new user account | No |
| POST | `/api/v1/auth/login` | Authenticate user | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| POST | `/api/v1/auth/logout` | Invalidate current session | Yes |
| POST | `/api/v1/auth/logout-all` | Invalidate all user sessions | Yes |
| POST | `/api/v1/auth/forgot-password` | Send password reset email | No |
| POST | `/api/v1/auth/reset-password` | Reset password with token | No |
| GET | `/api/v1/auth/me` | Get current user info | Yes |
| GET | `/api/v1/auth/sessions` | List active sessions | Yes |

#### 2. **AuthService**
- **Location:** [backend/src/modules/auth/auth.service.ts](../backend/src/modules/auth/auth.service.ts)
- **Key Methods:**
  - `register()`: Hash password, create user, generate tokens
  - `login()`: Validate credentials, generate tokens
  - `refreshTokens()`: Validate refresh token, issue new tokens
  - `logout()`: Invalidate specific refresh token
  - `logoutAll()`: Invalidate all user's refresh tokens
  - `forgotPassword()`: Generate reset token, send email
  - `resetPassword()`: Validate token, update password

#### 3. **JwtAuthGuard**
- **Location:** [backend/src/guards/jwt-auth.guard.ts](../backend/src/guards/jwt-auth.guard.ts)
- **Purpose:** Protects routes requiring authentication
- **Validation:**
  - Extracts JWT from `Authorization: Bearer <token>` header
  - Verifies token signature and expiration
  - Attaches user object to request
  - Returns 401 Unauthorized on failure

---

## Data Flow

### 1. Registration Flow

```
┌─────────────┐
│  Frontend   │
│  AuthPage   │
└──────┬──────┘
       │ 1. User submits email + password
       │
       ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/auth/register              │
│ Body: { email, password }               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend: AuthController.register()      │
└──────┬──────────────────────────────────┘
       │ 2. Validate email uniqueness
       ▼
┌─────────────────────────────────────────┐
│ AuthService.register()                  │
│ - Hash password (bcrypt, 10 rounds)    │
│ - Create User record in PostgreSQL     │
│ - Generate JWT access token (15m TTL)  │
│ - Generate refresh token (7d TTL)      │
│ - Store refresh token in DB            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Response:                               │
│ {                                       │
│   user: { id, email, createdAt },      │
│   accessToken: "eyJhbGc...",           │
│   refreshToken: "eyJhbGc..."           │
│ }                                       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: AuthContext.register()        │
│ - Store tokens in localStorage          │
│ - Set user state                        │
│ - Navigate to dashboard                 │
└─────────────────────────────────────────┘
```

### 2. Login Flow

```
┌─────────────┐
│  Frontend   │
│  AuthPage   │
└──────┬──────┘
       │ 1. User submits credentials
       │
       ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/auth/login                 │
│ Body: { email, password }               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ AuthService.login()                     │
│ - Find user by email                    │
│ - Verify password hash (bcrypt.compare) │
│ - Generate new access + refresh tokens  │
│ - Store refresh token with device info  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: Store tokens, set user state  │
└─────────────────────────────────────────┘
```

### 3. Authenticated Request Flow

```
┌─────────────┐
│  Frontend   │
│  API Client │
└──────┬──────┘
       │ 1. Request with Authorization header
       │
       ▼
┌─────────────────────────────────────────┐
│ Request Headers:                        │
│ Authorization: Bearer eyJhbGciOi...     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend: JwtAuthGuard                   │
│ - Extract token from header             │
│ - Verify JWT signature                  │
│ - Check expiration                      │
│ - Decode payload → userId               │
│ - Attach user to request.user           │
└──────┬──────────────────────────────────┘
       │
       ├─ Valid ──▶ Proceed to controller
       │
       └─ Invalid ─▶ 401 Unauthorized
                     │
                     ▼
              ┌──────────────────┐
              │ Frontend:        │
              │ Auto-refresh     │
              │ token & retry    │
              └──────────────────┘
```

### 4. Token Refresh Flow

```
┌─────────────┐
│  Frontend   │
│  API Client │
└──────┬──────┘
       │ 1. Receives 401 Unauthorized
       │
       ▼
┌─────────────────────────────────────────┐
│ apiClient.ts: Response Interceptor      │
│ - Check if refresh in progress          │
│ - If yes: wait for existing refresh     │
│ - If no: start new refresh              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/auth/refresh               │
│ Body: { refreshToken }                  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ AuthService.refreshTokens()             │
│ - Validate refresh token exists in DB   │
│ - Check expiration                      │
│ - Generate NEW access + refresh tokens  │
│ - DELETE old refresh token              │
│ - STORE new refresh token               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend:                               │
│ - Update localStorage with new tokens   │
│ - Retry failed request with new token   │
└─────────────────────────────────────────┘
```

### 5. Password Reset Flow

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ 1. User requests password reset
       │
       ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/auth/forgot-password       │
│ Body: { email }                         │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ AuthService.forgotPassword()            │
│ - Generate crypto-random token (32 hex) │
│ - Hash token and store in User record   │
│ - Set resetTokenExpiresAt (1 hour)     │
│ - Send email with reset link            │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ User clicks email link with token       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/auth/reset-password        │
│ Body: { token, newPassword }            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ AuthService.resetPassword()             │
│ - Validate token and expiration         │
│ - Hash new password                     │
│ - Update User record                    │
│ - Clear reset token fields              │
└─────────────────────────────────────────┘
```

---

## Database Schema

### User Table
```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  passwordHash          String
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Password reset
  resetToken            String?
  resetTokenExpiresAt   DateTime?

  // Settings
  settings              Json?

  // Usage tracking
  analysisCount         Int       @default(0)
  lastAnalysisAt        DateTime?

  // Relations
  analyses              Analysis[]
  refreshTokens         RefreshToken[]
  chatSessions          ChatSession[]
}
```

### RefreshToken Table
```prisma
model RefreshToken {
  id          String    @id @default(uuid())
  token       String    @unique
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  // Device tracking
  userAgent   String?
  ipAddress   String?

  @@index([userId])
  @@index([token])
}
```

---

## Security Measures

### 1. **Password Security**
- **Hashing Algorithm:** bcrypt with 10 salt rounds
- **Minimum Requirements:** Enforced on frontend (8+ characters)
- **Storage:** Only hashed passwords stored in database

### 2. **Token Security**
- **Access Token:**
  - Short-lived (15 minutes)
  - Signed with HS256 algorithm
  - Contains minimal payload (userId, email)
- **Refresh Token:**
  - Longer-lived (7 days)
  - Stored in database for revocation
  - Rotated on every refresh
  - Device-tracked for session management

### 3. **Session Management**
- Multi-device support with device fingerprinting
- Logout single session or all sessions
- Active session listing via `/auth/sessions`

### 4. **Password Reset**
- Cryptographically random tokens (32 bytes)
- 1-hour expiration window
- Single-use tokens (cleared after use)
- Email-based delivery

### 5. **API Security**
- CORS protection (configured origins)
- Helmet.js for security headers
- Rate limiting via NestJS Throttler
- SQL injection prevention via Prisma ORM

---

## Frontend Implementation Details

### API Client Configuration
**Location:** [frontend/api/client.ts](../frontend/api/client.ts)

```typescript
// Key Features:
1. Axios instance with base URL
2. Request interceptor: Adds Authorization header
3. Response interceptor: Auto-refresh on 401
4. Single in-flight refresh promise (prevents race conditions)
5. Automatic request retry with new token
```

### Token Storage
- **Location:** Browser localStorage
- **Keys:**
  - `accessToken`: JWT access token
  - `refreshToken`: JWT refresh token
- **Security Note:** Vulnerable to XSS attacks (consider httpOnly cookies for production)

### Auth State Initialization
```typescript
// On app mount:
1. Check localStorage for tokens
2. If found: Call GET /auth/me to validate
3. Set user state if valid
4. Remove tokens if invalid (401 response)
```

---

## Error Handling

### Frontend Errors
- **Invalid credentials:** Toast notification with error message
- **Network errors:** Retry with exponential backoff
- **Token expired:** Automatic silent refresh
- **Refresh failed:** Redirect to login page

### Backend Errors
- **400 Bad Request:** Validation errors (email format, password strength)
- **401 Unauthorized:** Invalid or expired token
- **403 Forbidden:** Valid token but insufficient permissions
- **409 Conflict:** Email already registered
- **500 Internal Server Error:** Database or unexpected errors

---

## Usage Example

### Registration
```typescript
// Frontend
const handleRegister = async (email: string, password: string) => {
  try {
    await register(email, password); // AuthContext method
    // Auto-redirects to dashboard
  } catch (error) {
    showToast('Registration failed', 'error');
  }
};
```

### Making Authenticated Requests
```typescript
// Frontend - automatically includes auth header
const analyses = await apiClient.get('/api/v1/analyses');
// If token expired, auto-refreshes and retries
```

### Logout
```typescript
// Frontend
const handleLogout = async () => {
  await logout(); // Invalidates refresh token
  // Redirects to /auth
};
```

---

## Performance Considerations

1. **Token Caching:** Access tokens stored in memory and localStorage
2. **Refresh Debouncing:** Single in-flight refresh prevents duplicate calls
3. **Session Cleanup:** Expired refresh tokens periodically pruned (TODO: implement cron job)
4. **Database Indexing:** Indexes on `userId` and `token` fields

---

## Future Enhancements

- [ ] OAuth integration (Google, GitHub)
- [ ] Two-factor authentication (TOTP)
- [ ] Email verification on registration
- [ ] Session activity monitoring (last active, location)
- [ ] Account lockout after failed login attempts
- [ ] httpOnly cookies for token storage (enhanced XSS protection)
- [ ] Refresh token rotation on suspicious activity
