# Render.com Deployment Checklist

Quick checklist for deploying Objekta to Render.com with Google OAuth.

## Pre-Deployment (5 minutes)

- [ ] Local setup working (see [QUICK_START_LOCAL.md](./QUICK_START_LOCAL.md))
- [ ] Code pushed to GitHub
- [ ] You have your Google Client ID
- [ ] You have MongoDB Atlas connection string (or planning to use Render's Postgres)

## Google Cloud Console (5 minutes)

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Go to **Credentials** → Edit OAuth credential
- [ ] Add these to "Authorized JavaScript origins":
  - [ ] `https://your-frontend.vercel.app` (or Render frontend URL)
  - [ ] Any custom domains you plan to use
- [ ] Save
- [ ] Copy Client ID (same one as local dev)

## Deploy Backend to Render (10 minutes)

1. **Create Render account:** [render.com](https://render.com)
2. **Connect GitHub:** Link your GitHub account
3. **Create Web Service:**
   - [ ] Click **New** → **Web Service**
   - [ ] Select your OBJEKTA repository
   - [ ] **Name:** `objekta-api`
   - [ ] **Environment:** `Node`
   - [ ] **Build Command:** `cd backend && npm install`
   - [ ] **Start Command:** `cd backend && node server.js`
   - [ ] **Plan:** `Free` (or `Starter` for production)
   - [ ] Click **Create Web Service**

4. **Add Environment Variables:**
   - [ ] Once created, go to **Environment** tab
   - [ ] Add these variables:

```bash
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/objekta?retryWrites=true&w=majority
JWT_SECRET=YOUR_LONG_RANDOM_STRING_MIN_32_CHARS
DOWNLOAD_SECRET=YOUR_ANOTHER_RANDOM_STRING_MIN_32_CHARS
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
FRONTEND_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-app-api.onrender.com
TRUST_PROXY=true
COOKIE_SECURE=true
COOKIE_SAMESITE=none
COOKIE_DOMAIN=.onrender.com
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=60
AUTH_STRICT_RATE_LIMIT_MAX=20
EMAIL_PROVIDER=console
PAYMENT_PROVIDER=mock
AI_PROVIDER=auto
```

- [ ] Click **Save**
- [ ] Wait for deployment (5-10 minutes)
- [ ] Copy your backend URL: `https://your-app-api.onrender.com`

## Deploy Frontend to Vercel (5 minutes)

1. **Go to [Vercel](https://vercel.com)**
2. **Import Project:**
   - [ ] Click **Add New** → **Project**
   - [ ] Select your OBJEKTA GitHub repository
   - [ ] Click **Import**

3. **Configure:**
   - [ ] **Framework Preset:** `Vite`
   - [ ] **Build Command:** `npm run build`
   - [ ] **Output Directory:** `dist`
   - [ ] Leave other defaults

4. **Add Environment Variables:**
   - [ ] Before deploying, go to **Environment Variables**
   - [ ] Add:

```bash
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE=https://your-app-api.onrender.com
```

- [ ] Click **Deploy**
- [ ] Wait for deployment (2-5 minutes)
- [ ] Copy your frontend URL from Vercel dashboard

## Post-Deployment (5 minutes)

1. **Update Google Cloud Console:**
   - [ ] Go back to Google Cloud Console → **Credentials**
   - [ ] Edit OAuth credential
   - [ ] Add your Vercel frontend URL to "Authorized JavaScript origins"
   - [ ] Save

2. **Wait for propagation:**
   - [ ] Wait 5-10 minutes for Google to apply changes
   - [ ] In the meantime, test your URLs

3. **Test Production:**
   - [ ] Open `https://your-frontend.vercel.app`
   - [ ] You should see Objekta homepage
   - [ ] Click "Sign in with Google"
   - [ ] Sign in with your account
   - [ ] You should be redirected to dashboard
   - [ ] ✓ Success!

## Troubleshooting Deployment

### Backend won't start
- [ ] Check **Logs** in Render dashboard
- [ ] Verify all env variables are set
- [ ] Check `MONGO_URI` is correct
- [ ] Try redeploying

### "origin_mismatch" on production
- [ ] Get your actual Vercel URL from Vercel dashboard
- [ ] Add it to Google Cloud Console authorized origins
- [ ] Wait 5-10 minutes
- [ ] Refresh browser (clear cache)

### Frontend blank page
- [ ] Check browser console for errors
- [ ] Verify `VITE_API_BASE` points to correct Render backend
- [ ] Check Vercel **Deployments** tab for build errors

### Login not working
- [ ] Verify `GOOGLE_CLIENT_ID` same in frontend and backend
- [ ] Check backend logs: Render → **Logs**
- [ ] Verify `FRONTEND_ORIGIN` includes your Vercel URL in backend env

### Database connection error
- [ ] Verify `MONGO_URI` is correct
- [ ] For MongoDB Atlas: Check IP whitelist allows all IPs (0.0.0.0)
- [ ] Test connection string locally first

## URLs to Collect

After deployment, you'll have:

```
Frontend (Vercel):  https://your-frontend.vercel.app
Backend (Render):   https://your-app-api.onrender.com
Database:           mongodb+srv://...
```

Update these everywhere they're needed:
- [ ] Google Cloud Console (authorized origins)
- [ ] Environment variables (if you change them)
- [ ] Documentation
- [ ] README

## Custom Domain (Optional)

To use your own domain (e.g., `https://app.yourdomain.com`):

1. **Add domain to Vercel/Render:**
   - Vercel: **Domains** tab → Add domain
   - Render: **Custom Domain** → Add domain

2. **Update DNS records** as instructed

3. **Add to Google Cloud Console:**
   - Add custom domain to authorized origins
   - Wait 5-10 minutes

4. **Update environment variables:**
   - Backend: `FRONTEND_ORIGIN`, `FRONTEND_URL`
   - Frontend: `VITE_API_BASE` (if using backend custom domain)

## Monitoring

After deployment, monitor:

- **Render Dashboard:** Backend logs for errors
- **Vercel Dashboard:** Frontend build/deployment status
- **MongoDB Atlas:** Database usage and performance
- **Google Cloud Console:** OAuth token usage

## Going from Free to Paid Tiers

When you need more performance:

1. **Render:** Change plan in service settings ($7/month Starter)
2. **Vercel:** Upgrade plan ($20/month Pro)
3. **MongoDB Atlas:** Upgrade cluster

## Next Steps

- [ ] Test all features in production
- [ ] Monitor error logs
- [ ] Set up custom domain if needed
- [ ] Share production URL with users
- [ ] Set up monitoring/alerts

## Need Help?

- **Full deployment guide:** [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)
- **Local setup issues:** [QUICK_START_LOCAL.md](./QUICK_START_LOCAL.md)
- **Google OAuth issues:** [GOOGLE_ORIGIN_MISMATCH_FIX.md](./GOOGLE_ORIGIN_MISMATCH_FIX.md)
- **Render docs:** [render.com/docs](https://render.com/docs)
- **Vercel docs:** [vercel.com/docs](https://vercel.com/docs)

---

**Deployment time: ~30 minutes** ⏱️

When done, you'll have Objekta running on production with real Google OAuth! 🚀
