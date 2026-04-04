# OBJEKTA Authentication System - Environment Configuration

## Backend Environment Variables

```bash
# .env (backend)

# JWT Secret (use a strong random string in production)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Token Expiration (optional - overrides defaults)
# Defaults: 15m (production) or 7d (development)
ACCESS_TOKEN_EXPIRY=7d        # Local development: longer expiration
REFRESH_TOKEN_EXPIRY=30d      # Local development: longer expiration

# For production, use shorter tokens:
# ACCESS_TOKEN_EXPIRY=15m
# REFRESH_TOKEN_EXPIRY=7d

# Email Service (for OTP, verification emails, etc.)
EMAIL_PROVIDER=console        # "console" = logs to terminal, "smtp" = real email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="OBJEKTA <noreply@objekta.io>"

# Frontend URLs
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# MongoDB
MONGO_URI=mongodb://localhost:27017/objekta

# Node Environment
NODE_ENV=development   # or "production"
```

## Quick Setup for Local Testing

For **local development** without frequent logouts:

```bash
# backend/.env
NODE_ENV=development
ACCESS_TOKEN_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d
EMAIL_PROVIDER=console
```

This gives you:
- **7-day access tokens** (won't expire during testing)
- **30-day refresh tokens** (long sessions)
- **Console email output** (no SMTP needed)

## Authentication Features

### 1. Traditional Login (Email + Password)
```javascript
const { ok, user } = await login(email, password);
```

### 2. Passwordless OTP Login (New)
```javascript
// Step 1: Request OTP
await requestOTP(email);  // OTP sent to email

// Step 2: Verify OTP (30 second window)
const { ok, user } = await verifyOTP(email, otp);
```

### 3. Automatic Token Refresh
- Frontend automatically refreshes tokens 30 seconds before expiry
- No manual intervention needed
- Seamless background refresh

### 4. Two-Factor Authentication (TOTP)
- Enable 2FA on account settings
- Scan QR code with authenticator app
- 6-digit codes updated every 30 seconds

## Testing the OTP System

### Development Mode
When `NODE_ENV=development`:
- OTP endpoint returns the code in response (for testing)
- OTP appears in console output
- No email sending required

### Request OTP
```bash
curl -X POST http://localhost:5000/api/auth/login/otp/request \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Response includes OTP in development:
# {"message": "OTP sent to email", "otp": "123456"}
```

### Verify OTP
```bash
curl -X POST http://localhost:5000/api/auth/login/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com", "otp":"123456"}'

# Returns JWT token and user info
```

## Rate Limiting

OTP system includes rate limiting:
- **Max 5 attempts** per OTP request
- **30-second expiry** on codes
- Attempt counter resets on new OTP request

## Security Notes

1. **Production Setup**:
   - Use short access tokens (15 minutes)
   - Use refresh tokens with httpOnly cookies
   - Enable HTTPS and secure CORS
   - Set NODE_ENV=production

2. **Email Configuration**:
   - Use environment-specific SMTP settings
   - Never commit credentials to version control
   - Use app-specific passwords (not account passwords)

3. **Token Rotation**:
   - Refresh tokens are rotated on each use
   - Old tokens are invalidated
   - Max 5 active refresh tokens per user

4. **OTP Security**:
   - Hashed in database (not plaintext)
   - Expires after 30 seconds
   - Rate-limited to 5 attempts
   - Different code per request
