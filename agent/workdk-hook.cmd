@echo off
setlocal DisableDelayedExpansion
"%~dp0node.exe" --no-warnings "%~dp0collector.mjs" hook "%~1"
exit /b 0
