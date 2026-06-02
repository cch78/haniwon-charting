@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0update.ps1"
if %ERRORLEVEL% NEQ 0 pause
