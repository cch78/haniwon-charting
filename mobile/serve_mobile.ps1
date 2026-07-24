# serve_mobile.ps1 - 모바일 차팅 페이지 정적 서버 (Windows 기본 기능만 사용)
# 사용: start_mobile_server.bat 을 관리자 권한으로 실행

param([int]$Port = 8080)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$Mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

# 안내용 내부 IP 조회
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
       Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) { $ip = 'localhost' }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "[ERROR] 포트 $Port 를 열 수 없습니다." -ForegroundColor Red
  Write-Host "        관리자 권한으로 실행했는지 확인하세요."
  Write-Host "        (다른 프로그램이 $Port 를 쓰고 있을 수도 있습니다)"
  Write-Host ""
  Read-Host "엔터를 누르면 종료합니다"
  exit 1
}

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host "   한의원 차팅 모바일 서버 실행 중" -ForegroundColor Green
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   휴대폰에서 아래 주소로 접속하세요 (원내 와이파이):" -ForegroundColor White
Write-Host ""
Write-Host "        http://${ip}:$Port" -ForegroundColor Yellow
Write-Host ""
Write-Host "   이 창을 닫으면 서버가 종료됩니다."
Write-Host ""

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }

  $reqPath = $ctx.Request.Url.LocalPath
  if ($reqPath -eq '/' -or $reqPath -eq '') { $reqPath = '/index.html' }

  # 상위 경로 접근 차단
  $safe = $reqPath.TrimStart('/').Replace('/', '\')
  $full = Join-Path $Root $safe
  $fullResolved = [System.IO.Path]::GetFullPath($full)

  $res = $ctx.Response
  if (-not $fullResolved.StartsWith([System.IO.Path]::GetFullPath($Root)) -or -not (Test-Path $fullResolved -PathType Leaf)) {
    $res.StatusCode = 404
    $bytes = [Text.Encoding]::UTF8.GetBytes('Not Found')
  } else {
    $ext = [IO.Path]::GetExtension($fullResolved).ToLower()
    $res.ContentType = if ($Mime.ContainsKey($ext)) { $Mime[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-store')
    $bytes = [IO.File]::ReadAllBytes($fullResolved)
  }

  $res.ContentLength64 = $bytes.Length
  try {
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { }
  $res.OutputStream.Close()

  Write-Host ("  {0}  {1}  -> {2}" -f (Get-Date -Format 'HH:mm:ss'), $reqPath, $res.StatusCode)
}

$listener.Stop()
