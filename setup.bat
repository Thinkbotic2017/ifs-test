@echo off
cd /d "%~dp0"
echo Installing dependencies for the Oracle query tester...
npm install
if errorlevel 1 (
  echo Dependency installation failed. Check internet/proxy access and Node.js installation.
  pause
  exit /b 1
)
echo Setup complete. Copy .env.example to .env and edit Oracle connection details.
pause
