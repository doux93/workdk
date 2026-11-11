@echo off
chcp 65001 >nul
cd /d "%~dp0"
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a<22||(a===22&&b<13)?1:0)" >nul 2>&1
if errorlevel 1 (
 echo 请先安装 Node.js 22.13 或更新版本：https://nodejs.org/
 pause
 exit /b 1
)
echo 从工作台的“连接电脑”下载连接配置，然后填写其完整路径。
set /p "WORKDK_CONFIG_FILE=连接配置文件路径："
node collector.mjs init "%WORKDK_CONFIG_FILE%"
if errorlevel 1 goto failed
set /p "WORKDK_PROJECT_DIR=允许采集的项目目录："
set /p "WORKDK_PROJECT_NAME=工作台中的项目名称："
node collector.mjs add-project "%WORKDK_PROJECT_DIR%" "%WORKDK_PROJECT_NAME%"
if errorlevel 1 goto failed
node collector.mjs install-hooks
if errorlevel 1 goto failed
echo 配置完成。检查 Agent 的新回调后，双击 start-agent.cmd 启动后台上传。
echo 使用过程中保留上传窗口。可选开机启动见 README.md。
pause
exit /b 0
:failed
echo 配置未完成，请检查上方错误后重试。
pause
exit /b 1
