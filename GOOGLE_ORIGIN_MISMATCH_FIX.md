# Google OAuth Quick Fix Guide

## Problem: "origin_mismatch" Error

When you see this error:
```
Error: invalid_request
origin_mismatch: The request originates from an origin that is not whitelisted.
If Google shows origin_mismatch, add http://localhost:5173 in Google Cloud Console under OAuth client Authorized JavaScript origins.
```

### This means your current URL is NOT in Google's authorized origins list.

---

## Quick Fix (5 minutes)

### Step 1: Identify Your Current Origin
Your origin is the full URL minus the path:
- `http://localhost:5173` → origin is `http://localhost:5173`
- `https://my-app.vercel.app` → origin is `https://my-app.vercel.app`
- `https://my-app.onrender.com` → origin is `https://my-app.onrender.com`

### Step 2: Add to Google Cloud Console

1. Go to **[https://console.cloud.google.com/](https://console.cloud.google.com/)**
2. Select your project (top-left dropdown)
3. Navigate to **APIs & Services** → **Credentials** (left sidebar)
4. Click the **OAuth 2.0 Client ID** you're using
5. Under "Authorized JavaScript origins", click **Add URI**
6. Paste your origin (e.g., `http://localhost:5173`)
7. Click **Save**

### Step 3: Wait and Retry

- **Wait 1-5 minutes** for changes to propagate
- **Clear your browser cache** (or open in incognito mode)
- **Refresh the page**
- Try signing in again

---

## Common Scenarios

### Local Development
Your origin is: `http://localhost:5173`

**Add these to Google Cloud Console:**
```
http://localhost:5173
http://127.0.0.1:5173
```

### Vercel Frontend
Your origin is: `https://your-app.vercel.app`

**Add to Google Cloud Console:**
```
https://your-app.vercel.app
```

### Render Backend Only (Rare)
If your frontend makes requests from Render backend:
```
https://your-app-api.onrender.com
```

### Multiple Origins
You can add multiple origins. Common setup:
```
http://localhost:5173          (local)
http://127.0.0.1:5173         (local fallback)
https://my-app.vercel.app     (production Vercel)
https://my-domain.com         (custom domain)
```

---

## Still Not Working?

### Check 1: Is Your Client ID Correct?

Verify `VITE_GOOGLE_CLIENT_ID` in `.env.local`:
```bash
# Should match what you copied from Google Cloud Console
VITE_GOOGLE_CLIENT_ID=ABC123XYZ.apps.googleusercontent.com
                      ^^^^^^^^^
                      Should be your actual Client ID
```

### Check 2: Check Browser Console

Open DevTools (F12) → Console tab:

**Good:**
```
Google Identity Services loaded successfully
```

**Bad:**
```
[Error] Failed to load resource: the server responded with a status of (403)
origin_mismatch: ...
```

### Check 3: Restart Frontend Dev Server

If you added the origin to Google Cloud, the frontend needs to reload:
```bash
# Stop your dev server (Ctrl+C)
# Restart it
npm run dev
```

### Check 4: Frontend and Backend Match

Both should have the SAME Client ID:

**Frontend (.env.local):**
```bash
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

**Backend (backend/.env):**
```bash
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

---

## Expected Behavior

### When It Works:
1. Page loads, you see a "Sign in with Google" button
2. Click the button → Google sign-in dialog appears
3. Sign in → You're logged in to the app
4. Refresh token cookie is set automatically

### When It's Broken:
- No Google button appears → Check console for "origin_mismatch" or script load errors
- Button appears but clicking does nothing → Client ID mismatch or GSI not initialized
- "Invalid client" error → Client ID is wrong or Google servers are slow

---

## Advanced: Check Active Origins

To see what origins Google currently has registered:

1. Go to Google Cloud Console → **Credentials**
2. Click your OAuth 2.0 client ID
3. Scroll to "Authorized JavaScript origins"
4. You'll see the full list

Add your current URL if it's not there.

---

## Reference

- **Full Setup Guide:** [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)
- **Deployment Guide:** [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)
- **Google Docs:** [Google Identity Services](https://developers.google.com/identity/gsi/web)
- **Backend Auth Code:** [backend/controllers/authController.js](./backend/controllers/authController.js)
- **Frontend Auth Code:** [src/App.jsx](./src/App.jsx) (AppInit component)

---

## TL;DR

1. Get your origin (e.g., `http://localhost:5173`)
2. Go to Google Cloud Console → Credentials
3. Add it to "Authorized JavaScript origins"
4. Wait 1-5 minutes
5. Refresh browser
6. Done! ✓
