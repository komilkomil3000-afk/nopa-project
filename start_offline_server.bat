@echo off
echo ===================================================
echo   NOPA OFFLINE SERVER - ZERO BANDWIDTH MODE
echo ===================================================

echo [1/3] Checking Port 5000 for stale processes...
FOR /F "tokens=5" %%T IN ('netstat -ano ^| findstr :5000') DO (
    echo Killing stale process PID: %%T
    taskkill /F /PID %%T >nul 2>&1
)

echo [2/3] Starting Offline Local Server on 127.0.0.1...
cd nopa_backend
npm run dev

pause
