# update.ps1 - 한의원 차팅 자동 업데이트 (PowerShell)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDir "autoupdate.json"

if (-not (Test-Path $ConfigPath)) {
    Write-Host "[ERROR] autoupdate.json not found."
    exit 1
}

$cfg    = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$ghUser = $cfg.github_user
$ghRepo = $cfg.github_repo
$branch = if ($cfg.branch) { $cfg.branch } else { "main" }

if ($ghUser -eq "YOUR_GITHUB_USERNAME") {
    Write-Host "[ERROR] Set github_user in autoupdate.json"
    exit 1
}

$rawBase = "https://raw.githubusercontent.com/$ghUser/$ghRepo/$branch"
$ts      = Get-Date -Format "yyyy-MM-dd HH:mm"

try {
    $latestMf = Invoke-RestMethod "$rawBase/manifest.json?_=$(Get-Date -UFormat '%s')" -ErrorAction Stop
} catch {
    Write-Host "$ts [ERROR] Cannot reach GitHub: $_"
    exit 1
}

$currentRaw = Get-Content (Join-Path $ScriptDir "manifest.json") -Raw
$current    = if ($currentRaw -match '"version"\s*:\s*"([^"]+)"') { $Matches[1] } else { "" }
$latest    = $latestMf.version

if ($latest -eq $current) {
    Write-Host "$ts [OK] Already latest (v$current)"
    exit 0
}

Write-Host "$ts Updating v$current -> v$latest ..."

$zipUrl = "https://github.com/$ghUser/$ghRepo/archive/refs/heads/$branch.zip"
$tmpZip = Join-Path $env:TEMP "haniwon_update.zip"
$tmpDir = Join-Path $env:TEMP "haniwon_update_$(Get-Random)"

try {
    Invoke-WebRequest $zipUrl -OutFile $tmpZip -UseBasicParsing -ErrorAction Stop
    Expand-Archive $tmpZip $tmpDir -Force -ErrorAction Stop
    $src = Get-ChildItem $tmpDir -Directory | Select-Object -First 1
    Copy-Item "$($src.FullName)\*" $ScriptDir -Recurse -Force
    Write-Host "$ts [OK] Updated to v$latest. Chrome will auto-reload."
} catch {
    Write-Host "$ts [ERROR] Update failed: $_"
    exit 1
} finally {
    if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue }
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
}
