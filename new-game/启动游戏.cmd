@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "TW_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "TW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist dist\index.html (
  echo 请先安装 Node.js，再运行 npm install 和 npm run build。
  pause
  exit /b 1
)
echo 正在启动潮汐归途，准备完成后将自动打开浏览器。
echo 游玩期间请保持此窗口打开，也可以使用桌面的潮汐归途快捷方式。
"%TW_NODE%" scripts\serve.mjs --open
if errorlevel 1 pause
