@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env
  echo Created .env. Please edit it with your Oracle connection details, then run start.bat again.
  notepad .env
  pause
  exit /b 0
)
npm start
pause
