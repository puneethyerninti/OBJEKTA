# OBJEKTA - Authentication Testing Guide

## Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
cp .env.example .env  # or create .env with settings below

# Add these to .env:
NODE_ENV=development
ACCESS_TOKEN_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d
EMAIL_PROVIDER=console
MONGO_URI=mongodb://localhost:27017/objekta
JWT_SECRET=dev-secret-key-change-in-production
```

### 2. Start Backend Server
```bash
npm install
npm start
# Should see: "✅ MongoDB Connected" and "🚀 Server running on port 5000"
```

### 3. Frontend Setup
```bash
cd ..
npm install
npm run dev
# Should open http://localhost:5173
```

---

## Testing Different Login Methods

### ✅ Method 1: Traditional Login (Email + Password)

```javascript
// In browser console:
const auth = window.AuthContext;
await auth.login('test@example.com', 'password123');
```

**Features:**
- Standard email/password authentication
- Email verification required (check console for link)
- 2FA optional (can be enabled in account settings)

---

### 🔐 Method 2: Passwordless OTP Login (New!)

1. **Click "Login with OTP"** button on login page (if implemented)
2. **Enter email address**
3. **Check console** for OTP code (in development mode)
4. **Enter code** (valid for 30 seconds)
5. **Automatic login!**

**Testing in Console:**
```javascript
// Request OTP
const req = await fetch('http://localhost:5000/api/auth/login/otp/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com' })
});
const res = await req.json();
console.log('OTP:', res.otp);  // Shows code for testing

// Verify OTP (within 30 seconds)
const verify = await fetch('http://localhost:5000/api/auth/login/otp/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    otp: res.otp  // Use the code from above
  })
});
const verified = await verify.json();
console.log('Token:', verified.token);
```

---

## Session Management

### Token Expiration Handling

**In Development (7 days):**
- Tokens expire after 7 days (not during a testing session)
- Automatic refresh happens 30 seconds before expiry
- You won't see logouts during normal testing

**In Production (15 minutes):**
- Tokens expire after 15 minutes
- Refresh happens automatically in background
- Users stay logged in with refresh tokens

### Force Logout (for testing)
```javascript
// Clear session and logout
localStorage.removeItem('objekta_user');
localStorage.removeItem('objekta_token');
window.location.reload();
```

### Check Token Status
```javascript
// See current token
const token = localStorage.getItem('objekta_token');
console.log('Token:', token);

// Decode token to see expiration
const decodeJWT = (token) => {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
};

const decoded = decodeJWT(token);
const expiresAt = new Date(decoded.exp * 1000);
console.log('Token expires:', expiresAt.toLocaleString());
console.log('Expires in:', Math.round((expiresAt - Date.now()) / 1000), 'seconds');
```

---

## Testing Scenarios

### Scenario 1: Normal Login → Stays Logged In
```
1. Login with email/password
2. Stay on page for 10+ minutes
3. Make API calls → should work (auto-refresh in background)
✅ Expected: No logout, seamless experience
```

### Scenario 2: Multiple Tabs (Session Sync)
```
1. Login in Tab A
2. Open same site in Tab B
3. User should be logged in both tabs
4. Logout in Tab A → both tabs should logout
✅ Expected: Sessions stay synchronized
```

### Scenario 3: OTP Login (Fast, Secure)
```
1. Click "OTP Login"
2. Enter email
3. Copy OTP from console
4. Paste code (within 30 seconds)
5. Auto-logged in!
✅ Expected: Login completes without password
```

### Scenario 4: Expired OTP (Safety Testing)
```
1. Request OTP
2. Wait 30+ seconds
3. Try to verify
✅ Expected: Error: "OTP expired"
```

### Scenario 5: Wrong OTP (Security Testing)
```
1. Request OTP (e.g., 123456)
2. Enter wrong code
3. Try 5 times
✅ Expected:
   - First 4 attempts: "Invalid OTP, X attempts remaining"
   - 5th attempt: "Too many attempts. Request new OTP."
```

---

## Troubleshooting

### Problem: "Token expiring too quickly"
**Solution:** Make sure `.env` has:
```bash
NODE_ENV=development
ACCESS_TOKEN_EXPIRY=7d
```

### Problem: "OTP not received"
**Solution:** Check backend console output
```
# Should see:
📧 EMAIL [Your OBJEKTA Login Code] → test@example.com
000000  # This is your OTP
---
```

### Problem: "401 Unauthorized kept appearing"
**Solution:** Token refresh is broken, check:
1. Browser console for errors
2. Backend refresh endpoint: `POST /api/auth/refresh`
3. Refresh token in localStorage: `objekta_token`

### Problem: "Email service errors"
**Solution:** For development, use `EMAIL_PROVIDER=console`
```bash
# backend/.env
EMAIL_PROVIDER=console  # Logs to terminal instead
```

---

## Environment Configuration Checklist

- [ ] Backend .env configured with `NODE_ENV=development`
- [ ] `ACCESS_TOKEN_EXPIRY=7d` for long-lived dev tokens
- [ ] `EMAIL_PROVIDER=console` (no SMTP needed)
- [ ] MongoDB connected
- [ ] Frontend connects to correct API base
- [ ] CORS configured to allow localhost:5173

---

## Key Files Modified

- **Backend:**
  - `controllers/authController.js` - New OTP endpoints
  - `models/User.js` - OTP fields and methods
  - `routes/auth.js` - OTP routes
  - `services/emailService.js` - OTP email template

- **Frontend:**
  - `contexts/AuthContext.jsx` - Token refresh logic, OTP methods
  - `components/OTPLoginModal.jsx` - OTP UI component
  - `styles/OTPLogin.css` - Modal styling

---

## Next Steps

1. ✅ Test standard login/logout
2. ✅ Test OTP passwordless login
3. ✅ Verify automatic token refresh (check Network tab)
4. ✅ Test 2FA setup (if using)
5. ✅ Test session persistence across tabs
