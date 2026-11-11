@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
node "%~dp0setup.mjs"
set "WORKDK_SETUP_EXIT=%errorlevel%"
pause
exit /b %WORKDK_SETUP_EXIT%
:missing_node
echo Node.js 22.13 or newer is required. Install it from https://nodejs.org/
pause
exit /b 1
