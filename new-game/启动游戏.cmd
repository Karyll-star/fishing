@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "TW_NODE="
where node >nul 2>nul
if not errorlevel 1 set "TW_NODE=node"
if not defined TW_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "TW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined TW_NODE (
  echo 未检测到 Node.js。请先安装 Node.js（https://nodejs.org/）后再次运行。
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo 未找到构建产物 dist，正在自动准备游戏资源，首次启动请耐心等待。
  if not exist node_modules\ (
    call npm install --no-audit --no-fund
    if errorlevel 1 (
      echo 依赖安装失败，请确认网络可用后重试。
      pause
      exit /b 1
    )
  )
  call npm run build
  if errorlevel 1 (
    echo 构建失败，请查看上方错误信息后重试。
    pause
    exit /b 1
  )
)
echo 正在启动潮汐归途，准备完成后将自动打开浏览器。
echo 游玩期间请保持此窗口打开，也可以使用桌面的潮汐归途快捷方式。
"%TW_NODE%" scripts\serve.mjs --open
if errorlevel 1 pause
