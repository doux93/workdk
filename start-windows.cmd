@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo 请先安装 Node.js 22.13 或更高版本，然后重新运行。
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络连接。
    pause
    exit /b 1
  )
)
echo 工作台将在 http://127.0.0.1:5173 打开。关闭此窗口将停止服务。
call npm run dev -- --open
pause
