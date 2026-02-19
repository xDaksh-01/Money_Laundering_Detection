# Production-Ready Setup Guide

## Quick Start (Local Development)

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # or: .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

Backend will be available at: **http://localhost:8001**

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: **http://localhost:5173**

---

## Deployment on Vercel

### Steps:
1. Push this repo to GitHub
2. Connect repo to Vercel
3. Set environment variable in Vercel:
   ```
   VITE_API_BASE_URL=https://your-google-colab-backend-url
   ```
4. Deploy

---

## Connecting to Google Colab Backend

### If you have a Colab backend running:

1. **Get your Colab backend URL** (ngrok tunnel or similar)
2. **Create `.env.production` in frontend/ (don't commit)**:
   ```
   VITE_API_BASE_URL=https://your-colab-backend-url
   ```
3. **For Vercel deployment**, set the environment variable in Vercel dashboard:
   - Go to Settings → Environment Variables
   - Add: `VITE_API_BASE_URL=https://your-colab-backend-url`

### Frontend → Backend Connection Flow:
```
Browser (Vercel) 
  → VITE_API_BASE_URL env var 
  → POST https://your-colab-backend-url/api/process
  → Google Colab FastAPI server
```

---

## Project Structure
```
backend/
  ├── __init__.py (package marker)
  ├── main.py (FastAPI app)
  ├── analyzer.py (RIFT 2026 analyzer)
  ├── parser.py (CSV parser)
  ├── schema.py (Pydantic models)
  ├── requirements.txt
  └── .venv/ (virtual env)

frontend/
  ├── .env.example (template for env vars)
  ├── .env.local (local dev config)
  ├── package.json
  ├── vite.config.js
  └── src/
      ├── components/
      │   └── FileUpload.jsx (uses VITE_API_BASE_URL)
      └── ...
```

---

## Key Points

✅ Backend is a FastAPI server with CORS enabled (accepts requests from anywhere)
✅ Frontend uses environment variables to switch backends (local dev vs production)
✅ No hardcoded URLs — fully configurable
✅ Ready for Vercel + Google Colab integration
✅ `requirements.txt` has all dependencies pinned

---

## Troubleshooting

**"Upload failed. Is the backend running?"**
- Check `VITE_API_BASE_URL` is correct
- Backend must have CORS enabled (it does)
- Backend must be running on the URL specified

**Port conflicts?**
- Change `--port 8001` in backend command
- Change `VITE_API_BASE_URL` to match new port

**Vercel build fails?**
- Ensure `node_modules/` and `.next/` are in `.gitignore`
- `npm run build` should work locally first

---

## Git Commits Ready

```bash
git add .
git commit -m "Production-ready stable version: env vars, requirements.txt, docs"
git push origin main
```

Then connect to Vercel for automatic deployments.
