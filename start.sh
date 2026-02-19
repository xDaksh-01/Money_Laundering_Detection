#!/bin/bash
# Start both backend and frontend for local development

echo "🚀 Starting Money Laundering Detection App..."
echo ""

# Kill any existing processes on ports 8001 and 5173
echo "🧹 Cleaning up old processes..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Start backend in background
echo "📡 Starting Backend (FastAPI on port 8001)..."
cd backend
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate 2>/dev/null || . .venv/Scripts/activate
pip install -q -r requirements.txt 2>/dev/null || true
cd ..
.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
cd ..
sleep 2

echo "✅ Backend running (PID: $BACKEND_PID)"
echo ""

# Start frontend in background
echo "🎨 Starting Frontend (Vite on port 5173)..."
cd frontend
npm install -q 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ Frontend running (PID: $FRONTEND_PID)"
echo ""
echo "========================================="
echo "🎉 App is running!"
echo "========================================="
echo ""
echo "Backend:  http://127.0.0.1:8001"
echo "Docs:     http://127.0.0.1:8001/docs"
echo "Frontend: http://127.0.0.1:5173"
echo ""
echo "To stop: kill $BACKEND_PID $FRONTEND_PID"
echo "Or: pkill -f 'uvicorn|vite'"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

wait
