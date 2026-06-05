@echo off
echo Building FitGeo for Production...
echo.

echo [1/3] Installing frontend dependencies...
cd /d %~dp0frontend
call npm install
if errorlevel 1 goto error

echo [2/3] Building React PWA...
call npm run build
if errorlevel 1 goto error

echo [3/3] Copying frontend build to backend wwwroot...
if not exist "%~dp0backend\FitGeo.Api\wwwroot" mkdir "%~dp0backend\FitGeo.Api\wwwroot"
xcopy /E /Y /I "%~dp0frontend\dist\*" "%~dp0backend\FitGeo.Api\wwwroot\"
if errorlevel 1 goto error

echo.
echo Build complete!
echo To run: cd backend\FitGeo.Api && dotnet run --environment Production
echo.
pause
goto end

:error
echo.
echo BUILD FAILED!
pause

:end
