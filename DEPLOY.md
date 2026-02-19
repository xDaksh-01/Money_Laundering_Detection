# Deploy to GitHub & Vercel in 5 Minutes

## Step 1: Push to GitHub (3 minutes)

```bash
cd /Users/saisharan/Downloads/Money_Laundering_Detection

# Check status
git status

# Stage all changes
git add .

# Commit
git commit -m "Production-ready: env vars, stable backend, Vercel compatible"

# Push to main branch
git push origin main
```

---

## Step 2: Deploy on Vercel (2 minutes)

### Option A: Via Web UI (Easiest)

1. Go to **vercel.com**
2. Click **"Add New..." → "Project"**
3. Import your GitHub repository (select `Money_Laundering_Detection`)
4. **Framework**: Auto-detected as Vite ✓
5. **Root Directory**: `./frontend` (if Vercel asks)
6. Go to **Settings → Environment Variables**
7. Add:
   - Key: `VITE_API_BASE_URL`
   - Value: (see below based on your backend)
8. Click **Deploy**

### Option B: Via CLI

```bash
npm i -g vercel
vercel login
cd frontend
vercel
# Follow prompts to connect GitHub repo
```

---

## Step 3: Set Backend URL

Choose **ONE** of the following based on your backend location:

### Backend on Google Colab (ngrok tunnel)
Example: `https://abc-123-def-456.ngrok.io`

```
VITE_API_BASE_URL=https://abc-123-def-456.ngrok.io
```

### Backend on Cloudflare Tunnel
Example: `https://qualify-bike-leaders-evans.trycloudflare.com`

```
VITE_API_BASE_URL=https://qualify-bike-leaders-evans.trycloudflare.com
```

### Backend on Any Custom Server
Example: `https://my-api.example.com`

```
VITE_API_BASE_URL=https://my-api.example.com
```

### Verify After Setting Env Var
1. Go to Vercel Project Settings
2. Go to **Environment Variables**
3. Confirm `VITE_API_BASE_URL` is set
4. Click **Redeploy** button (top right)
5. Wait 1-2 minutes
6. Open your Vercel URL and test file upload

---

## Troubleshooting

### "Upload Failed" After Deployment
1. Check `VITE_API_BASE_URL` is set correctly in Vercel
2. Make sure backend URL is publicly accessible
3. Redeploy by clicking **Redeploy** in Vercel dashboard
4. Check browser console (F12 → Network tab) for API calls

### Build Fails on Vercel
1. Go to Vercel **Settings → Build & Development Settings**
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm ci`
5. Click **Save**
6. Redeploy

### Port Conflict Locally
If port 8001 or 5173 is already in use:

```bash
# Kill process on port 8001
lsof -ti:8001 | xargs kill -9

# Kill process on 5173
lsof -ti:5173 | xargs kill -9

# Try again
bash start.sh
```

---

## Verify Everything Works

### 1. Frontend URL
- Go to your Vercel URL (e.g., `https://my-project.vercel.app`)
- Page should load with file upload box

### 2. Upload CSV
- Drag/drop a CSV or click to upload
- Wait for processing
- Should show results (accounts, rings, summary)

### 3. Check Logs
**Vercel Logs**: Click **Deployments → Latest → Functions** (shows backend errors)  
**Local Logs**: Run `bash start.sh` and watch terminal output

---

## Production Checklist

- [ ] GitHub repo is public (or private, doesn't matter)
- [ ] Vercel project created and connected
- [ ] `VITE_API_BASE_URL` environment variable set in Vercel
- [ ] Frontend builds and deploys without errors
- [ ] File upload works end-to-end
- [ ] Backend URL is accessible from Vercel (test with curl)
- [ ] CORS works (FastAPI already configured)

---

## After Deployment

### Update Backend URL
If your backend URL changes (e.g., ngrok tunnel expires):

1. Go to Vercel **Settings → Environment Variables**
2. Update `VITE_API_BASE_URL` value
3. Click **Redeploy**
4. Done in 30 seconds

### Revert to Local Backend
To test locally again:

```bash
# Change .env.local
VITE_API_BASE_URL=http://127.0.0.1:8001

# Run locally
bash start.sh
```

---

## Done! 🎉

Your app is now:
- ✅ On GitHub (version controlled)
- ✅ Deployed on Vercel (auto-scales, CDN, free)
- ✅ Connected to your backend (configurable URL)
- ✅ Production-ready (no hardcoded URLs, secure)

Questions? Check `README.md` and `SETUP.md` in the repo.
