# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth 2.0 for both local development and Render.com production deployment.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (top-left, next to "Google Cloud")
3. Name it something like "Objekta"
4. Wait for the project to be created

## Step 2: Enable Google Identity Services API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Identity Services" 
3. Click on it and press **Enable**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add authorized origins and redirect URIs:

### For Local Development:
- **Authorized JavaScript origins:**
  - `http://localhost:5173`
  - `http://localhost:3000` (if you use different ports)
  - `http://127.0.0.1:5173`

- **Authorized redirect URIs:**
  - `http://localhost:5173/callback` (if your app has a callback page)

### For Render.com Production:
- **Authorized JavaScript origins:**
  - `https://your-frontend-url.vercel.app` (if using Vercel for frontend)
  - `https://your-domain.com`
  - **IMPORTANT:** You must add your Render backend domain too if frontend makes requests from backend domain

- **Authorized redirect URIs:**
  - `https://your-domain.com/callback`

### Complete Example (before deploying):
```
Authorized JavaScript origins:
- http://localhost:5173
- http://127.0.0.1:5173
- https://your-frontend.vercel.app
- https://your-custom-domain.com

Authorized redirect URIs:
- http://localhost:5173
- https://your-frontend.vercel.app
```

5. Click **Create**
6. Copy your **Client ID** (you'll need this)

## Step 4: Configure Environment Variables

### Frontend (.env.local for local, or Vercel/Render environment variables for production)

```bash
# Local Development (.env.local)
VITE_API_BASE=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
```

```bash
# Production (Render/Vercel environment variables)
VITE_API_BASE=https://your-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
```

### Backend (.env for local, or Render environment variables for production)

```bash
# Local Development
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
```

```bash
# Production (Render)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
```

## Step 5: Frontend Configuration

The frontend automatically:
1. Loads the Google Identity Services script
2. Initializes with your Client ID
3. Handles credential responses
4. Sends the ID token to `/api/auth/oauth` on your backend

**No additional code changes needed** — the setup is already in place!

## Step 6: Test Locally

1. Create `.env.local` in the project root:
```bash
VITE_API_BASE=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

2. Start your backend (port 5000):
```bash
cd backend
npm install
npm start
```

3. Start your frontend (port 5173):
```bash
npm install
npm run dev
```

4. Open `http://localhost:5173`
5. You should see the Google login button
6. Click it and sign in with your Google account
7. You should be redirected to your dashboard

## Step 7: Deploy to Render.com

1. Add environment variables to your Render service:
   - `GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com`
   - `FRONTEND_ORIGIN=https://your-frontend-url`
   - `BACKEND_URL=https://your-backend-url.onrender.com`
   - etc.

2. Make sure your frontend also has:
   - `VITE_API_BASE=https://your-backend.onrender.com`
   - `VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com`

3. Update Google Cloud Console with your Render backend domain as an authorized origin

## Troubleshooting

### "origin_mismatch" Error
This means your current origin isn't in the authorized origins list.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth 2.0 credential
3. Add your current origin to "Authorized JavaScript origins"
4. Click Save
5. Refresh your app (might take a few minutes)

Examples:
- `http://localhost:5173` (local)
- `https://myapp.vercel.app` (Vercel)
- `https://myapp.onrender.com` (Render frontend)

### Google Button Not Appearing
Check browser console for errors. Common issues:
1. Client ID not set (check .env files)
2. Google script failed to load (check network tab)
3. `window.google` is undefined (script loading issue)

**Solution:**
- Ensure `.env.local` has `VITE_GOOGLE_CLIENT_ID`
- Check that `import.meta.env.VITE_GOOGLE_CLIENT_ID` is accessible
- The runtime-config endpoint provides fallback if .env is missing at build time

### "Invalid Client" Error
1. Ensure your Client ID is correct (copy from Google Cloud)
2. Ensure your origin is in the authorized list
3. Clear browser cache and retry

### CORS Errors
The backend handles CORS. Make sure:
1. `FRONTEND_ORIGIN` env variable includes your frontend URL
2. Backend has `Access-Control-Allow-Credentials: true`
3. Your frontend requests include `credentials: 'include'`

## Security Notes

1. **Never commit your Client ID to git** — use environment variables
2. **Google Client ID is public** — it's meant to be public
3. **Backend validates tokens** using `google-auth-library` (already set up)
4. **Refresh tokens are httpOnly cookies** (secure by default)
5. **JWT tokens expire** (15 minutes in production, configurable)

## How It Works (Flow Diagram)

```
User clicks "Sign in with Google"
↓
Frontend calls window.google.accounts.id.initialize()
↓
Google shows sign-in dialog
↓
User authenticates with Google
↓
Google returns id_token to frontend
↓
Frontend calls /api/auth/oauth with id_token
↓
Backend verifies token with Google's servers
↓
Backend creates/finds user in database
↓
Backend returns JWT access token + refresh token
↓
Frontend stores access token and navigates to dashboard
```

## Questions or Issues?

Refer to:
- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)
- [Google Cloud Console](https://console.cloud.google.com/)
- Backend auth code: `backend/controllers/authController.js`
- Frontend auth code: `src/App.jsx` (AppInit component)
