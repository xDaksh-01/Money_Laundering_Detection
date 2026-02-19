@echo off
REM RIFT 2026 - Money Laundering Detection App Launcher (Batch Version)

echo.
echo ========================================
echo   RIFT 2026 - Starting Application
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "rift_env\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found!
    echo Please create rift_env first.
    pause
    exit /b 1
)

echo [1/2] Starting Backend Server...
start "RIFT Backend - FastAPI" cmd /k "rift_env\Scripts\activate.bat && python -m uvicorn backend.main:app --reload && echo Backend running on http://127.0.0.1:8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server...
start "RIFT Frontend - React" cmd /k "cd frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Application Launched Successfully!
echo ========================================
echo.
echo Backend API: http://127.0.0.1:8000
echo API Documentation: http://127.0.0.1:8000/docs
echo Frontend App: http://localhost:5173
echo.
echo Two new windows have been opened.
echo Close this window or press any key...
pause >nul
