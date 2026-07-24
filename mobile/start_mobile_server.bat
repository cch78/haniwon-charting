@echo off
title 한의원 차팅 - 모바일 서버
cd /d "%~dp0"

net session >nul 2>&1
if not %ERRORLEVEL%==0 (
    echo.
    echo   [!] 관리자 권한이 필요합니다.
    echo       이 파일을 마우스 오른쪽 클릭 - "관리자 권한으로 실행" 해주세요.
    echo.
    pause
    exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%~dp0serve_mobile.ps1" -Port 8080
pause
