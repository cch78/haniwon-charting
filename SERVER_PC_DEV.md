# 서버 PC(192.168.0.226)에서 개발하기

한의맥이 이 PC에 떠 있으므로, 여기서 개발하면 **한의맥에 로컬로 직접 접근**하면서
코드를 고치고 GitHub에 올릴 수 있다. 올린 변경은 각 원내 PC가 매일 20:00 자동 업데이트로 받는다.

```
[서버 PC 226]  코드 수정 → git push → GitHub
                                          │  (각 PC update.ps1, 매일 20:00)
                                          ▼
                              [원내 PC들]  확장 자동 업데이트
```

---

## 1. 최초 1회 세팅

### (A) Git 설치
- https://git-scm.com/download/win 에서 "64-bit Git for Windows" 설치 (기본값으로 진행).

### (B) 저장소 가져오기
개발 폴더 하나를 정해서 (예: `C:\dev\`) 명령 프롬프트에서:
```
cd C:\dev
git clone https://github.com/cch78/haniwon-charting.git
cd haniwon-charting
```
> 이미 USB로 옮긴 폴더가 있다면 clone 대신 그 폴더에서
> `git init && git remote add origin https://github.com/cch78/haniwon-charting.git && git fetch && git reset --hard origin/main`

### (C) 커밋 신원 + 인증
```
git config user.name  "cch78"
git config user.email "offjch81@gmail.com"
```
- push 할 때 GitHub 로그인 창이 뜨면 브라우저로 인증하면 된다.
- 창이 안 뜨고 비밀번호를 물으면, GitHub → Settings → Developer settings →
  Personal access token(classic, repo 권한) 발급 후 비밀번호 자리에 붙여넣기.
  (한 번 인증하면 Windows 자격증명에 저장되어 이후 자동)

---

## 2. 매일 작업 흐름

```
git pull                 # 최신 상태로 맞추기 (다른 PC에서 올린 게 있을 수 있음)
...  코드 수정  ...
```
그리고 **manifest.json 의 version 을 반드시 올린 뒤** (자동 업데이트 트리거):
```
git add -A
git commit -m "수정 내용"
git push
```
> version 을 안 올리면 각 PC 자동 업데이트가 "Already latest"로 건너뛴다.

크롬 확장을 이 PC에서 바로 테스트하려면:
`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → 이 폴더 선택 →
코드 수정 후 새로고침(🔄).

---

## 3. 한의맥에서 직접 정보 받아오기 (서버 PC의 이점)

이 PC에서는 한의맥 API를 **로컬로** 바로 호출할 수 있다.
```
http://localhost:6982/api/...      (= 127.0.0.1:6982 = 192.168.0.226:6982)
```

이미 파악된 주요 엔드포인트:
- `GET  /api/patinfo/waitpat?date=YYYY-MM-DD` — 오늘 환자 목록 (진료상태 1=대기, 9=완료)
- `GET  /api/patinfo/search?...` — 환자 검색
- `GET  /api/treat/treatrecord?...` — 과거 진료기록 (완료건, 최신순)
- `POST /api/treat/record` — 차트 저장 `{JSONdata: JSON.stringify({증상,챠트번호,진료일자,진료번호})}`

새 엔드포인트를 찾을 때: 한의맥 mini 클라이언트의 JS 번들
(`http://localhost:6982/static/js/main.*.js`)을 열어 `/api/` 문자열을 검색하면 된다.

> **더 깊은 접근이 필요하면(향후 검토):** 한의맥이 쓰는 DB(SQL Server 등)에
> 이 PC에서 직접 붙는 방법도 가능하다. 단 공식 진료자료이므로 **읽기 위주로**,
> 스키마·백업을 먼저 확인하고 신중히. 착수 전 별도 논의.

---

## 4. 주의

- **비밀정보(Claude 키 등)는 커밋하지 말 것.** `.env` 등 로컬 파일로 두고 `.gitignore`.
- 한의맥 저장(`/api/treat/record`)은 **실제 진료기록에 쓰인다.** 테스트는 신중히.
- 대규모 개편(서버 백엔드 등)은 `main` 이 아니라 **별도 브랜치**에서.
  → `git switch -c feature/이름` 으로 작업 후 검증되면 병합.
- 관련 문서: [server_backend/README.md](server_backend/README.md) (중계 백엔드 이전 계획),
  [mobile/README.md](mobile/README.md) (모바일 서버).
