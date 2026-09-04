@echo off
setlocal
set "PATH=C:\Users\Rafsan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
cd /d "%~dp0"
"C:\Users\Rafsan\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" run dev
if errorlevel 1 pause
