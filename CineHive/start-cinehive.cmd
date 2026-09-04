@echo off
start "CineHive API" cmd /k call "%~dp0start-backend.cmd"
start "CineHive Frontend" cmd /k call "%~dp0frontend\start-frontend.cmd"
