@echo off
echo Starting FitGeo Development...
echo.

echo [1/2] Starting .NET Backend (http://localhost:5000)...
start "FitGeo Backend" cmd /k "cd /d %~dp0backend\FitGeo.Api && dotnet run"

timeout /t 3 /nobreak >nul

echo [2/2] Starting React Frontend (http://localhost:5173)...
start "FitGeo Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are starting...
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:5000
echo.
pause
