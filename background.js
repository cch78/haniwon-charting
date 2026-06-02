// background.js - Service Worker (단일 리스너로 통합)

// ── Service Worker Keepalive ──────────────────────────
function keepAlive() {
  chrome.storage.local.get('__ping', function() {});
}
setInterval(keepAlive, 20000);

// ── 자동 업데이트 시스템 ──────────────────────────────
var _loadedVersion = null;

// 시작 시 현재 버전 읽기
fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })
  .then(function(r) { return r.json(); })
  .then(function(mf) {
    _loadedVersion = mf.version;
    _checkGitHubUpdate(); // 버전 로드 후 즉시 GitHub 체크
  })
  .catch(function() {});

// autoupdate.json 읽기 → GitHub raw base URL 반환
function _loadUpdateConfig(cb) {
  fetch(chrome.runtime.getURL('autoupdate.json'), { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(cfg) {
      if (!cfg.github_user || cfg.github_user === 'YOUR_GITHUB_USERNAME') { cb(null); return; }
      var base = 'https://raw.githubusercontent.com/' + cfg.github_user + '/' + cfg.github_repo + '/' + (cfg.branch || 'main');
      cb(base);
    })
    .catch(function() { cb(null); });
}

// GitHub 최신 버전 체크 → 다르면 storage에 알림 저장
function _checkGitHubUpdate() {
  if (!_loadedVersion) return;
  _loadUpdateConfig(function(base) {
    if (!base) return;
    fetch(base + '/manifest.json?_=' + Date.now(), { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(mf) {
        if (mf.version && mf.version !== _loadedVersion) {
          chrome.storage.local.set({ __updateAvailable: mf.version });
        } else {
          chrome.storage.local.remove('__updateAvailable');
        }
      })
      .catch(function() {});
  });
}

// 로컬 파일 버전 변경 감지 → 자동 리로드 (update.sh 실행 후)
function _checkLocalReload() {
  if (!_loadedVersion) return;
  fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(mf) {
      if (mf.version && mf.version !== _loadedVersion) {
        chrome.storage.local.remove('__updateAvailable');
        chrome.runtime.reload();
      }
    })
    .catch(function() {});
}

// 알람 등록 (SW 재시작 시마다 재등록)
chrome.alarms.create('updateGitHub', { periodInMinutes: 30 });
chrome.alarms.create('updateLocal',  { periodInMinutes: 1  });

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'updateGitHub') _checkGitHubUpdate();
  if (alarm.name === 'updateLocal')  _checkLocalReload();
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  // ── 설정 저장/로드 ──────────────────────────────────
  if (request.type === 'STORAGE_GET') {
    chrome.storage.local.get([request.key], function(r) {
      sendResponse({ value: r[request.key] || null });
    });
    return true;
  }

  if (request.type === 'STORAGE_SET') {
    var obj = {}; obj[request.key] = request.value;
    chrome.storage.local.set(obj, function() {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── Claude API 호출 ───────────────────────────────
  if (request.type === 'CLAUDE_API') {
    callClaude(request.apiKey, request.payload)
      .then(function(r) { sendResponse({ success: true, data: r }); })
      .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── Gemini API 호출 (복약지도문용) ─────────────────
  if (request.type === 'GEMINI_API') {
    callGemini(request.apiKey, request.prompt)
      .then(function(text) { sendResponse({ success: true, text: text }); })
      .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── 한의맥 API 호출 (재시도 1회 포함) ──────────────
  if (request.type === 'HANYMAC_API') {
    callHanymacWithRetry(request.url, request.options)
      .then(function(r) { sendResponse({ success: true, data: r, status: r.__status }); })
      .catch(function(e) {
        var msg = e.message || '';
        if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('load failed')) {
          msg = '한의맥 서버에 연결할 수 없습니다. 서버 주소/포트를 확인하거나 한의맥이 실행 중인지 확인해주세요. (' + (request.url || '').split('?')[0] + ')';
        }
        sendResponse({ success: false, error: msg });
      });
    return true;
  }

  // ── 구글 시트 범용 POST (첩약 콜 등) ───────────────
  if (request.type === 'GOOGLE_SHEET_POST') {
    postToSheet(request.url, request.body)
      .then(function(data) { sendResponse({ success: true, data: data }); })
      .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── 구글 시트 전체 조회 ─────────────────────────
  if (request.type === 'GOOGLE_SHEET_GET') {
    getFromSheet(request.url)
      .then(function(records) { sendResponse({ success: true, records: records }); })
      .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── 구글 시트 저장 ───────────────────────────────
  if (request.type === 'GOOGLE_SHEET') {
    saveToSheet(request.url, request.record)
      .then(function() { sendResponse({ success: true }); })
      .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── Whisper STT ──────────────────────────────────
  if (request.type === 'WHISPER_STT') {
    callWhisper(request.apiKey, request.audioData, request.mimeType, request.prompt)
      .then(function(t) { sendResponse({ success: true, text: t }); })
      .catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── URL/앱 열기 (tabs API) ───────────────────────
  if (request.type === 'OPEN_URL') {
    chrome.tabs.create({ url: request.url, active: true }, function(tab) {
      sendResponse({ success: true });
    });
    return true;
  }
});

// ── 함수 정의 ────────────────────────────────────────

async function callClaude(apiKey, payload) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// 한의맥 호출: 실패 시 500ms 후 1회 재시도
async function callHanymacWithRetry(url, options) {
  try {
    return await callHanymac(url, options);
  } catch(e) {
    // 재시도 전 잠깐 대기 (SW가 막 깨어난 직후일 수 있음)
    await new Promise(function(res) { setTimeout(res, 500); });
    return await callHanymac(url, options);
  }
}

async function callHanymac(url, options) {
  const resp = await fetch(url, options || {});
  const status = resp.status;
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/html')) return { __status: status, __html: true };
  try {
    const json = await resp.json();
    json.__status = status;
    return json;
  } catch(e) {
    return { __status: status };
  }
}

async function saveToSheet(url, record) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'saveRecord', record: record })
  });
}

async function callWhisper(apiKey, audioData, mimeType, prompt) {
  const byteChars = atob(audioData);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], { type: mimeType || 'audio/webm' });

  const extMap = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/wav': 'wav' };
  const ext = extMap[mimeType] || 'webm';

  const form = new FormData();
  form.append('file', blob, 'recording.' + ext);
  form.append('model', 'whisper-1');
  form.append('language', 'ko');
  if (prompt) form.append('prompt', prompt);

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    body: form
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.text || '';
}

async function callGemini(apiKey, prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2500, temperature: 0.7 }
    })
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  var text = data.candidates && data.candidates[0] && data.candidates[0].content &&
             data.candidates[0].content.parts && data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Gemini 응답 없음');
  return text;
}

async function getFromSheet(url) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getRecords' })
  });
  const data = await resp.json();
  if (data.__error) throw new Error(data.__error);
  return Array.isArray(data) ? data : [];
}

async function postToSheet(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (data && data.__error) throw new Error(data.__error);
  return data;
}
