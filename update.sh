#!/bin/bash
# 한의원 차팅 자동 업데이트 스크립트 (Mac/Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/autoupdate.json"

# autoupdate.json에서 GitHub 정보 읽기
GITHUB_USER=$(awk -F'"' '/"github_user"/{print $4}' "$CONFIG")
GITHUB_REPO=$(awk -F'"' '/"github_repo"/{print $4}' "$CONFIG")
BRANCH=$(awk -F'"' '/"branch"/{print $4}' "$CONFIG")
[ -z "$BRANCH" ] && BRANCH="main"

if [ -z "$GITHUB_USER" ] || [ "$GITHUB_USER" = "YOUR_GITHUB_USERNAME" ]; then
  echo "❌ autoupdate.json에 github_user를 설정해주세요."
  exit 1
fi

# GitHub 최신 버전 확인
LATEST=$(curl -sf "https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$BRANCH/manifest.json" | awk -F'"' '/"version"/{print $4}')
CURRENT=$(awk -F'"' '/"version"/{print $4}' "$SCRIPT_DIR/manifest.json")

if [ "$LATEST" = "$CURRENT" ]; then
  echo "$(date '+%Y-%m-%d %H:%M') ✅ 최신 버전입니다 (v$CURRENT)"
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M') 🆕 v$CURRENT → v$LATEST 업데이트 시작..."

TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

ZIP_URL="https://github.com/$GITHUB_USER/$GITHUB_REPO/archive/refs/heads/$BRANCH.zip"
curl -sL "$ZIP_URL" -o "$TEMP_DIR/update.zip"
unzip -q "$TEMP_DIR/update.zip" -d "$TEMP_DIR"

# 압축 해제된 폴더 이름 (repo-branch 형태)
EXTRACTED=$(ls "$TEMP_DIR" | grep -v "update.zip" | head -1)

# 파일 교체 (업데이트 스크립트 자신은 마지막에 덮어씀)
cp -rf "$TEMP_DIR/$EXTRACTED/." "$SCRIPT_DIR/"

echo "$(date '+%Y-%m-%d %H:%M') ✅ v$LATEST 업데이트 완료 — Chrome 자동 새로고침 대기 중..."
