# Render.com Deployment Guide for Objekta

This guide covers deploying Objekta (frontend + backend) to Render.com with working Google OAuth authentication.

## Architecture Overview

```
┌─────────────────────────┐
│   Frontend (Vercel)     │
│  https://your-app.     │
│  vercel.app             │
└───────────┬─────────────┘
            │
            │ API requests
            │ (VITE_API_BASE)
            ▼
┌─────────────────────────┐
│   Backend (Render)      │
│  https://your-app-     │
│  api.onrender.com       │
└─────────────────────────┘
            │
            │ Database
            │
            ▼
┌─────────────────────────┐
│  MongoDB Atlas (Cloud)  │
│  (or local MongoDB)     │
└─────────────────────────┘
```

## Part 1: Google OAuth Setup for Production

### 1.1 Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 credential to edit it

### 1.2 Add Authorized Origins

Add these authorized JavaScript origins:

```
http://localhost:5173                    (local dev)
http://127.0.0.1:5173                   (local dev fallback)
https://your-frontend.vercel.app        (Vercel frontend)
https://your-custom-domain.com          (your custom domain)
https://your-app-api.onrender.com       (Render backend - optional)
```

### 1.3 Add Authorized Redirect URIs

```
http://localhost:5173                    (local dev)
https://your-frontend.vercel.app        (Vercel frontend)
https://your-custom-domain.com          (your custom domain)
```

**Copy your Client ID** - you'll need it in the next steps.

## Part 2: Deploy Backend to Render.com

### 2.1 Create Render.com Account

1. Go to [Render.com](https://render.com)
2. Sign up with GitHub account
3. Connect your GitHub repository

### 2.2 Create a New Web Service

1. Click **New** → **Web Service**
2. Select your GitHub repository
3. Configure the service:
   - **Name:** `objekta-api` (or your preferred name)
   - **Environment:** `Node`
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node server.js`
   - **Plan:** `Free` (or Starter for production)

### 2.3 Add Environment Variables

In Render dashboard for your backend service, go to **Environment** and add:

```bash
# Core
NODE_ENV=production
PORT=10000

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/objekta?retryWrites=true&w=majority

# JWT & Security
JWT_SECRET=YOUR_VERY_LONG_RANDOM_STRING_MIN_32_CHARS
DOWNLOAD_SECRET=YOUR_ANOTHER_RANDOM_STRING_MIN_32_CHARS

# Google OAuth (CRITICAL - same Client ID as frontend)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com

# CORS & Cookies
FRONTEND_ORIGIN=https://your-frontend.vercel.app,https://your-custom-domain.com
FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-app-api.onrender.com
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAMESITE=none
COOKIE_DOMAIN=.onrender.com

# Rate Limiting
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=60
AUTH_STRICT_RATE_LIMIT_MAX=20

# Email (optional)
EMAIL_PROVIDER=console
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="OBJEKTA" <noreply@objekta.io>

# Stripe (optional)
PAYMENT_PROVIDER=mock
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# AI (optional)
AI_PROVIDER=auto
GROQ_API_KEY=
```

### 2.4 Deploy

Render auto-deploys when you push to your GitHub branch. You can also manually deploy:
- Click the **Deploy** button in Render dashboard
- Wait for build to complete
- Copy your backend URL: `https://your-app-api.onrender.com`

## Part 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Account

1. Go to [Vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your project

### 3.2 Configure Frontend Deployment

1. Click **Import Project**
2. Select your repository
3. Configure project settings:
   - **Framework:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 3.3 Add Environment Variables

In Vercel project settings, go to **Environment Variables** and add:

```bash
# Google OAuth (same Client ID as backend)
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com

# Backend API endpoint (use Render backend URL)
VITE_API_BASE=https://your-app-api.onrender.com

# Assets (optional - CDN URL if you have one)
VITE_ASSET_BASE=https://your-cdn-url
```

### 3.4 Deploy

Vercel auto-deploys on git push. You can also manually deploy:
- Click **Deploy** in Vercel dashboard
- Wait for deployment to complete
- Copy your frontend URL: `https://your-app.vercel.app`

## Part 4: Update Google Cloud Console with Production URLs

Once both are deployed:

1. Go back to Google Cloud Console → **Credentials**
2. Edit your OAuth 2.0 credential
3. Add these to **Authorized JavaScript origins:**
   - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
   - Your custom domain if you have one

4. Save changes
5. **Wait 5-10 minutes** for changes to propagate

## Part 5: Test Production Deployment

1. Open your Vercel frontend URL
2. Click "Sign in with Google"
3. Sign in and verify you're redirected to dashboard
4. Check that refresh token cookie is set in DevTools

## Troubleshooting Production Issues

### "origin_mismatch" Error
**Problem:** Your frontend URL isn't in Google authorized origins

**Solution:**
1. Get your actual Vercel URL from Vercel dashboard
2. Add it to Google Cloud Console → Credentials → Authorized origins
3. Wait 5-10 minutes
4. Refresh the page (clear cache)

### Backend Returning 500 on /api/auth/oauth
**Problem:** `GOOGLE_CLIENT_ID` not set or incorrect

**Solution:**
1. Verify `GOOGLE_CLIENT_ID` in Render environment variables
2. Ensure it matches the one in Google Cloud Console
3. Redeploy backend after updating env vars
4. Check backend logs: Render Dashboard → Logs

### Login Works Locally but Not on Render
**Problem:** CORS issue or backend not accessible

**Solution:**
1. Verify `FRONTEND_ORIGIN` includes your Vercel URL in backend env
2. Check `VITE_API_BASE` in frontend points to correct Render backend
3. Verify backend is actually deployed and running
4. Check CORS headers in network tab

### Cookie Not Being Set
**Problem:** Cookie settings not right for production

**Solution:**
Backend should have:
```bash
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

Make sure:
- Frontend is HTTPS
- Backend is HTTPS
- Both domains are different

### Render Free Tier Cold Starts
**Problem:** First request takes 30+ seconds (free tier spins down)

**Solution:**
- Upgrade to Starter ($7/month) for always-on
- Or accept the cold start delay

## Part 6: Custom Domain (Optional)

To use your own domain (e.g., `https://app.yourdomain.com`):

### 6.1 Update DNS Records
Add DNS records as instructed by Vercel/Render:
- `A` or `CNAME` record pointing to Vercel/Render servers

### 6.2 Update Google Cloud Console
Add your custom domain to authorized origins:
```
https://app.yourdomain.com
```

### 6.3 Update Environment Variables
In both Vercel and Render:
- Update `FRONTEND_ORIGIN` to include custom domain
- Update `VITE_API_BASE` if backend is on custom domain

## Summary of URLs

After deployment, you'll have:

| Service | Local | Production |
|---------|-------|------------|
| Frontend | `http://localhost:5173` | `https://your-app.vercel.app` |
| Backend | `http://localhost:5000` | `https://your-app-api.onrender.com` |
| Database | `mongodb://localhost` | `mongodb+srv://...atlas.mongodb.net` |
| Google OAuth | Authorized for localhost | Authorized for production URLs |

## Important Notes

1. **Google Client ID is PUBLIC** — it's meant to be public
2. **Keep backend secrets secret** — JWT_SECRET, database credentials, etc.
3. **Use environment variables** for all secrets, never commit to git
4. **MongoDB Atlas free tier** is sufficient for small projects
5. **Render free tier** has limitations but good for testing
6. **Email won't work** if you don't configure SMTP provider

## Need Help?

- [Google Identity Services Docs](https://developers.google.com/identity/gsi/web)
- [Render.com Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
