@echo off
chcp 65001 >nul
title 한의원 차팅 모바일 서버 - 자동실행 설치
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

set TN=HaniwonMobileServer
set PS=%~dp0serve_mobile.ps1
set PORT=8080

echo.
echo   [1/3] 방화벽 허용 규칙 추가 (포트 %PORT%) ...
netsh advfirewall firewall delete rule name="%TN%" >nul 2>&1
netsh advfirewall firewall add rule name="%TN%" dir=in action=allow protocol=TCP localport=%PORT% >nul
if %ERRORLEVEL%==0 (echo        [OK]) else (echo        [경고] 방화벽 규칙 추가 실패 - 수동 확인 필요)

echo   [2/3] 부팅 시 자동실행 등록 ...
schtasks /delete /tn "%TN%" /f >nul 2>&1
schtasks /create /tn "%TN%" ^
    /tr "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PS%\" -Port %PORT%" ^
    /sc ONSTART /ru SYSTEM /rl HIGHEST /f >nul
if not %ERRORLEVEL%==0 (
    echo        [ERROR] 자동실행 등록 실패.
    pause
    exit /b 1
)
echo        [OK]

echo   [3/3] 지금 바로 서버 시작 ...
schtasks /run /tn "%TN%" >nul 2>&1
echo        [OK]

echo.
echo   =====================================================
echo    설치 완료. 이제 부팅할 때마다 자동으로 실행됩니다.
echo   =====================================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /c:"192.168"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do set IP=%%b
)
if defined IP (
    echo    휴대폰에서 접속 주소:  http://%IP%:%PORT%
) else (
    echo    휴대폰에서 접속 주소:  http://[이 PC의 IP]:%PORT%
    echo    (이 PC의 IP는 명령창에 ipconfig 입력하여 확인)
)
echo.
echo    * 해제하려면 uninstall_autostart.bat 을 관리자 권한으로 실행.
echo.
pause
