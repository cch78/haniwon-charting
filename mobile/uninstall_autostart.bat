@echo off
chcp 65001 >nul
title 한의원 차팅 모바일 서버 - 자동실행 해제
cd /d "%~dp0"

net session >nul 2>&1
if not %ERRORLEVEL%==0 (
    echo.
    echo   [!] 관리자 권한이 필요합니다. 오른쪽 클릭 - 관리자 권한으로 실행.
    echo.
    pause
    exit /b 1
)

set TN=HaniwonMobileServer

echo.
echo   자동실행 작업 삭제 ...
schtasks /end /tn "%TN%" >nul 2>&1
schtasks /delete /tn "%TN%" /f >nul 2>&1
echo   방화벽 규칙 삭제 ...
netsh advfirewall firewall delete rule name="%TN%" >nul 2>&1

echo.
echo   [OK] 자동실행이 해제되었습니다.
echo   (실행 중인 서버는 다음 재부팅 시 완전히 종료됩니다)
echo.
pause
