@echo off
setlocal
set "PATH=C:\Users\Rafsan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
cd /d "%~dp0"
"C:\Users\Rafsan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
if errorlevel 1 pause
