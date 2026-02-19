# Money Laundering Detection — RIFT 2026

A full-stack application for detecting money laundering fraud rings using the RIFT (Robust Intelligent Fraud Topology) detection engine.

**Frontend**: React + Vite (on Vercel)  
**Backend**: FastAPI + NetworkX (local, Google Colab, or any server)  

---

## 🚀 Quick Start (Local Development)

### Option 1: One Command (Recommended)
```bash
bash start.sh
```
This starts both backend and frontend automatically.

### Option 2: Manual Setup

#### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

#### Frontend (in another terminal)
```bash
cd frontend
npm install
npm run dev
```

Then open:
- **Frontend**: http://127.0.0.1:5173
- **Backend Docs**: http://127.0.0.1:8001/docs

---

## 📋 What It Does

1. **Upload CSV** with transaction data (sender_id, receiver_id, amount, timestamp, transaction_id)
2. **Analyze** for fraud patterns:
   - 💰 Cycles (circular money flow)
   - 👥 Smurfing (many small transfers)
   - 🏗️ Shell networks (intermediary accounts)
3. **View Results**: Suspicious accounts, fraud rings, risk scores

---

## 🔗 Backend Configuration

### Local Development
Automatically uses `http://127.0.0.1:8001` (set in `.env.local`)

### Production (Vercel + Google Colab or any backend)

1. **Get your backend URL** (e.g., Google Colab with ngrok/Cloudflare tunnel)
2. **In Vercel Dashboard**:
   - Go to Settings → Environment Variables
   - Add: `VITE_API_BASE_URL=https://your-backend-url`
3. **Deploy**: Push to main branch, Vercel auto-deploys

#### Example:
- If backend is at: `https://my-colab-backend.ngrok.io`
- Set: `VITE_API_BASE_URL=https://my-colab-backend.ngrok.io`
- Frontend will call: `https://my-colab-backend.ngrok.io/api/process`

---

## 📁 Project Structure

```
.
├── backend/
│   ├── main.py           # FastAPI app
│   ├── analyzer.py       # RIFT detection logic
│   ├── parser.py         # CSV parsing
│   ├── schema.py         # Data models
│   ├── requirements.txt   # Python dependencies (pinned versions)
│   └── __init__.py       # Package marker
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── FileUpload.jsx  # Uses VITE_API_BASE_URL
│   │   └── App.jsx
│   ├── .env.example      # Template (copy to .env.local)
│   ├── .env.local        # Local dev config (not committed)
│   └── package.json
│
├── start.sh              # Convenience script to start both servers
├── SETUP.md              # Detailed setup guide
├── README.md             # This file
└── .gitignore            # Git ignore patterns

```

---

## 🌍 Deployment Steps

### 1. GitHub
```bash
git add .
git commit -m "Production-ready version"
git push origin main
```

### 2. Vercel
1. Connect GitHub repo to Vercel (vercel.com)
2. Set environment variable: `VITE_API_BASE_URL=<your-backend-url>`
3. Deploy — auto-deploys on every push to main

### 3. Backend (Google Colab or any server)
- Make backend accessible via public URL
- Make sure CORS is enabled (FastAPI app already has this)
- Set environment variable in Vercel to point to it

---

## 🔧 Environment Variables

### Frontend (`.env.local` or Vercel dashboard)
```
VITE_API_BASE_URL=http://127.0.0.1:8001    # Local dev
# or
VITE_API_BASE_URL=https://your-backend-url  # Production
```

No backend env vars needed — backend auto-detects port from CLI args.

---

## 🧪 Testing

### Manual Backend Test
```bash
curl -X POST -F "file=@sample.csv" http://127.0.0.1:8001/api/process
```

### View Backend API Docs
Open: http://127.0.0.1:8001/docs (interactive Swagger UI)

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "Upload failed. Is the backend running?" | Check `VITE_API_BASE_URL` is correct; backend must be running |
| Port 8001 already in use | `pkill -f uvicorn` or change `--port` argument |
| npm install fails | Delete `node_modules/` and `package-lock.json`, try again |
| Vercel build fails | Run `npm run build` locally first to verify |
| CORS errors | Backend already has CORS enabled for all origins |

---

## 📝 Key Features

✅ Full-stack ready (local + cloud)  
✅ Environment-based backend URL switching  
✅ Pinned dependencies (reproducible builds)  
✅ Production-safe (no hardcoded URLs)  
✅ Vercel + Google Colab compatible  
✅ Live reload in development  

---

## 📚 References

- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Vite Docs](https://vitejs.dev)
- [Vercel Deploy](https://vercel.com/docs)

---

## ✨ Ready to Deploy

Everything is set up for:
- ✅ Local development (run `bash start.sh`)
- ✅ GitHub push (no secrets in code)
- ✅ Vercel deployment (just set env var)
- ✅ Connect any backend (Google Colab, ngrok tunnel, cloud server)

**Next Steps:**
1. Test locally: `bash start.sh`
2. Push to GitHub
3. Connect to Vercel
4. Set `VITE_API_BASE_URL` environment variable in Vercel
5. Done! 🎉

