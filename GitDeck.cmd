@echo off
setlocal
cd /d "%~dp0"
node "%~dp0gitdeck.js"
if errorlevel 1 pause
