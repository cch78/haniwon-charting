# 경희늘푸른한의원 진료 차팅 시스템

## 파일 구조
```
haniwon_charting/
├── manifest.json          # Chrome 확장 설정
├── newtab.html            # UI (새탭 대체)
├── newtab.js              # 메인 로직
├── background.js          # Service Worker (API 호출)
├── guide_prompt.md        # 복약지도문 프롬프트 (수정 가능)
└── apps_script_Code.gs    # Google Apps Script 코드
```

## Chrome 확장 설치
1. `chrome://extensions` 접속
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램 로드" → 이 폴더 선택

## 자동 업데이트 설정 (최초 1회)

### 1단계 — GitHub 리포지토리 준비
1. GitHub에서 빈 리포지토리 생성 (예: `haniwon-charting`)
2. 이 폴더의 전체 파일을 push

### 2단계 — autoupdate.json 수정
```json
{
  "github_user": "실제GitHub아이디",
  "github_repo": "haniwon-charting",
  "branch": "main"
}
```

### 3단계 — 각 PC에서 1회 실행
- **Mac**: 터미널에서 `bash setup_autoupdate.sh`
- **Windows**: `setup_autoupdate.bat` 더블클릭 (관리자 권한)

### 업데이트 흐름 (이후 자동)
```
개발자 PC에서 git push
    ↓
각 PC의 스케줄러가 매시간 update.sh / update.bat 실행
    ↓
파일 자동 교체
    ↓
background.js가 버전 변경 감지 → chrome.runtime.reload() 자동 호출
    ↓
확장 프로그램 자동 재시작 ✅
```

### 수동 업데이트 (스케줄러 없이)
- Mac: `bash update.sh`
- Windows: `update.bat` 더블클릭

## 설정 항목
- Claude API 키 (sk-ant-...)
- OpenAI API 키 (Whisper STT용, sk-...)
- Gemini API 키 (복약지도문용, AIza...)
- 한의맥 서버 IP:포트 (예: 192.168.0.222:6982)
- 한의맥 아이디 / 비밀번호
- 구글 시트 URL (Apps Script 배포 URL)

## Google Apps Script 설정
1. https://script.google.com 에서 새 프로젝트 생성
2. apps_script_Code.gs 내용 붙여넣기
3. SS_ID를 본인 스프레드시트 ID로 교체
4. 배포 → 웹 앱으로 배포 (누구나 액세스)
5. 배포 URL을 확장 설정에 입력

## 스프레드시트
- ID: 1TvmC4Yj82pGkrTOjQP271sxFrvThY5pyf2-x80BFOqU
- 시트: 진료기록, 첩약환자

## 복약지도문 프롬프트 수정
- guide_prompt.md 파일을 메모장으로 직접 수정
- 저장 후 즉시 반영 (확장 새로고침 불필요)

## 주요 기능
- 탭1: 한의맥 환자 검색
- 탭2: 녹음 (Whisper STT) / 직접 입력
- 탭3: AI SOAP 차팅 (Claude)
- 탭4: 복약지도문 생성 + 저장/불러오기
- 탭5: 문자 초안 생성
- 탭6: 첩약 환자 10일 콜 관리
