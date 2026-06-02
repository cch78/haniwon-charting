#!/bin/bash
# 자동 업데이트 초기 설정 스크립트 (Mac) — 한 번만 실행하면 됩니다
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/update.sh"
LOG_FILE="$SCRIPT_DIR/update.log"
PLIST="$HOME/Library/LaunchAgents/com.haniwon.autoupdate.plist"

chmod +x "$UPDATE_SCRIPT"

# LaunchAgent plist 생성 (매시간 실행)
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.haniwon.autoupdate</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$UPDATE_SCRIPT</string>
  </array>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

# LaunchAgent 등록
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "✅ 자동 업데이트 설정 완료!"
echo "   - 매시간 자동으로 GitHub에서 최신 버전 확인"
echo "   - 업데이트 로그: $LOG_FILE"
echo "   - 해제하려면: launchctl unload $PLIST"
