@echo off
set TN=HaniwonCharting_AutoUpdate
set PS=%~dp0update.ps1
set LOG=%~dp0update.log

schtasks /delete /tn "%TN%" /f >nul 2>&1
schtasks /create /tn "%TN%" /tr "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PS%\" >> \"%LOG%\" 2>&1" /sc DAILY /st 20:00 /f /rl HIGHEST

if %ERRORLEVEL%==0 (
    echo [OK] Auto-update enabled. Runs daily at 20:00 (hidden).
    echo [OK] Log: %LOG%
) else (
    echo [ERROR] Failed. Please run as Administrator.
)
pause
