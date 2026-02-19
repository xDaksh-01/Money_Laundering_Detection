# RIFT 2026 - Money Laundering Detection App Launcher
# This script launches both backend and frontend servers

Write-Host "🚀 RIFT 2026 - Starting Application..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if virtual environment exists
if (-Not (Test-Path ".\rift_env\Scripts\Activate.ps1")) {
    Write-Host "❌ Virtual environment not found at .\rift_env\" -ForegroundColor Red
    Write-Host "Please create a virtual environment first." -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists in frontend
if (-Not (Test-Path ".\frontend\node_modules")) {
    Write-Host "⚠️  Frontend dependencies not installed." -ForegroundColor Yellow
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host ""
Write-Host "📦 Starting Backend (FastAPI + Uvicorn)..." -ForegroundColor Green

# Start Backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { 
    Set-Location '$PWD'; 
    .\rift_env\Scripts\Activate.ps1; 
    Write-Host '🔧 Backend running on http://127.0.0.1:8000' -ForegroundColor Green;
    Write-Host '📖 API Docs: http://127.0.0.1:8000/docs' -ForegroundColor Cyan;
    python -m uvicorn backend.main:app --reload 
}"

Start-Sleep -Seconds 2

Write-Host "🎨 Starting Frontend (React + Vite)..." -ForegroundColor Green

# Start Frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { 
    Set-Location '$PWD\frontend'; 
    Write-Host '🎨 Frontend running...' -ForegroundColor Green;
    npm run dev 
}"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Application Launched Successfully!" -ForegroundColor Green
Write-Host "" 
Write-Host "🔧 Backend API: http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "📖 API Docs:    http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "🎨 Frontend:    http://localhost:5173 or 5174" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to close this launcher window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
