@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
node "%~dp0collector.mjs" run
set "WORKDK_AGENT_EXIT=%errorlevel%"
pause
exit /b %WORKDK_AGENT_EXIT%
