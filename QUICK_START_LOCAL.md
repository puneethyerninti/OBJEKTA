# Quick Start: Run Objekta Locally with Google OAuth

Follow these exact steps to get Objekta running locally with Google authentication in under 10 minutes.

## Prerequisites

- Node.js 16+ installed
- MongoDB running locally (or MongoDB Atlas account)
- A Google account
- Git

## Step 1: Get Your Google Client ID (2 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **project dropdown** (top-left) → **New Project**
3. Name it "Objekta" → Create
4. Wait for project to be created
5. Go to **APIs & Services** → **Library**
6. Search "Google Identity Services" → Click it → **Enable**
7. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
8. Choose **Web application**
9. Under "Authorized JavaScript origins", click **Add URI**
10. Add: `http://localhost:5173`
11. Click **Create** → Copy the **Client ID** (save it somewhere)

**Your Client ID looks like:** `123456789.apps.googleusercontent.com`

## Step 2: Clone & Configure (2 minutes)

```bash
# Clone the repo
git clone https://github.com/puneethyerninti/OBJEKTA.git
cd OBJEKTA

# Frontend config
cp .env.local.example .env.local
# Edit .env.local: Replace YOUR_GOOGLE_CLIENT_ID with your actual Client ID
# Example: VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com

# Backend config
cp backend/.env.local.example backend/.env
# Edit backend/.env: Replace YOUR_GOOGLE_CLIENT_ID with same Client ID
# Keep MongoDB: MONGO_URI=mongodb://localhost:27017/objekta
```

**Windows (notepad):**
```bash
notepad .env.local
# Edit, save, close

notepad backend/.env
# Edit, save, close
```

**Mac/Linux (nano):**
```bash
nano .env.local
# Edit with arrow keys, Ctrl+X to save

nano backend/.env
# Edit with arrow keys, Ctrl+X to save
```

## Step 3: Start MongoDB (1 minute)

If you have MongoDB installed locally:
```bash
mongod
```

If you don't have it, use [MongoDB Atlas (cloud)](https://www.mongodb.com/cloud/atlas):
1. Create free account
2. Create cluster
3. Copy connection string
4. Paste into `backend/.env` as `MONGO_URI`

## Step 4: Install & Start (2-3 minutes)

**Terminal 1 — Frontend:**
```bash
npm install
npm run dev
```
You should see:
```
  VITE v4.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Terminal 2 — Backend:**
```bash
cd backend
npm install
npm run dev
```
You should see:
```
✓ Backend running on http://localhost:5000
✓ Connected to MongoDB
```

## Step 5: Test in Browser (1 minute)

1. Open `http://localhost:5173` in your browser
2. You should see the **Objekta homepage** with a **"Sign in with Google"** button
3. Click the button
4. Sign in with your Google account
5. You should be redirected to the **Dashboard**
6. ✓ **You're logged in!**

## Troubleshooting

### "origin_mismatch" Error
**Problem:** You see an error about origin_mismatch

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **Credentials** → Click your OAuth credential
3. Under "Authorized JavaScript origins", make sure `http://localhost:5173` is there
4. If not, click **Add URI** → Add it → Save
5. Wait 1 minute, refresh browser

### No Google Button Appearing
**Problem:** Homepage loads but no Google button

**Solution:**
1. Open DevTools (F12) → Console
2. Look for errors
3. Check that `.env.local` has `VITE_GOOGLE_CLIENT_ID=123456789...`
4. Restart frontend: Stop (Ctrl+C) → `npm run dev`

### MongoDB Connection Error
**Problem:** Backend says "Could not connect to MongoDB"

**Solution:**
1. Make sure `mongod` is running in another terminal
2. Or update `backend/.env` to use MongoDB Atlas:
   - Create free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Copy connection string
   - Paste as `MONGO_URI` in `backend/.env`

### Client ID Mismatch
**Problem:** Backend returns 500 error on /api/auth/oauth

**Solution:**
1. Verify `VITE_GOOGLE_CLIENT_ID` in `.env.local` matches
2. Verify `GOOGLE_CLIENT_ID` in `backend/.env` matches
3. Both should be the SAME value
4. Restart both frontend and backend

## What Works Now

✓ **Sign up with Google** — Creates account automatically  
✓ **Real-time authentication** — JWT tokens, secure cookies  
✓ **Persistent login** — Refresh tokens work  
✓ **Dashboard access** — After login  

## Next Steps

- **Explore the studio:** Click "Enter Studio" or create a project
- **Read docs:** Check out [docs/user-guide.md](./docs/user-guide.md)
- **Deploy to production:** See [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)

## File Structure You Need to Know

```
OBJEKTA/
├── .env.local                 ← Frontend config (VITE_GOOGLE_CLIENT_ID)
├── backend/
│   └── .env                   ← Backend config (GOOGLE_CLIENT_ID)
├── src/
│   ├── App.jsx               ← Google auth initialization
│   └── contexts/AuthContext  ← Auth state management
└── backend/
    ├── controllers/authController.js  ← Google token verification
    └── routes/auth.js         ← Auth endpoints
```

## Complete File Contents (Copy & Paste)

### `.env.local`
```bash
VITE_GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
VITE_API_BASE=http://localhost:5000
```

### `backend/.env`
```bash
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/objekta
JWT_SECRET=dev-secret-min-32-chars-for-security
DOWNLOAD_SECRET=dev-download-secret-min-32-chars
GOOGLE_CLIENT_ID=PASTE_SAME_CLIENT_ID_HERE.apps.googleusercontent.com
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
TRUST_PROXY=false
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

## Getting Help

- **General setup:** [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)
- **origin_mismatch error:** [GOOGLE_ORIGIN_MISMATCH_FIX.md](./GOOGLE_ORIGIN_MISMATCH_FIX.md)
- **Production deployment:** [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)
- **Google docs:** [Google Identity Services](https://developers.google.com/identity/gsi/web)

---

**Total setup time: ~10 minutes** ⏱️

You now have a fully functional local Objekta instance with real Google OAuth authentication! 🎉
