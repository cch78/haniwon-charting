// 한의원 차팅 – 모바일 웹 버전
// 확장 프로그램(newtab.js)과 독립적으로 동작하는 경량 버전.
// 기능: 오늘 환자 조회 → 메모 입력(음성) → AI 차팅 → 한의맥 저장

var CFG = { server: '192.168.0.226:6982', apiKey: '' };
var state = { patient: null, chart: null };
var todayList = [];

// ── 공통 유틸 ────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function base() { return 'http://' + CFG.server + '/api'; }
function getName(p) { return p.수진자명 || p.이름 || p.성명 || p.환자명 || p.챠트번호 || ''; }
function getBirth(p) { return p.생일 || p.생년월일 || ''; }
function todayStr() { return new Date().toISOString().split('T')[0]; }

var toastTimer = null;
function toast(msg, kind) {
  var el = $('toast');
  el.textContent = msg;
  el.className = kind || '';
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.style.display = 'none'; }, kind === 'err' ? 5000 : 2800);
}

// ── 설정 저장/로드 (localStorage) ────────────────────
function loadCfg() {
  try {
    var s = JSON.parse(localStorage.getItem('haniwon_mobile_cfg') || '{}');
    if (s.server) CFG.server = s.server;
    if (s.apiKey) CFG.apiKey = s.apiKey;
  } catch (e) { /* 손상된 값은 무시하고 기본값 사용 */ }
}
function saveCfg() {
  var server = $('f-server').value.trim() || '192.168.0.226:6982';
  CFG.server = server.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  CFG.apiKey = $('f-key').value.trim();
  localStorage.setItem('haniwon_mobile_cfg', JSON.stringify(CFG));
  toast('설정을 저장했습니다.', 'ok');
  show('list');
  loadToday();
}

// ── 화면 전환 ────────────────────────────────────────
var TITLES = { list: '오늘 환자', memo: '진료 메모', chart: '차팅 확인', set: '설정' };
var current = 'list';
function show(name) {
  current = name;
  ['list', 'memo', 'chart', 'set'].forEach(function (n) {
    $('s-' + n).classList.toggle('on', n === name);
  });
  $('title').textContent = TITLES[name];
  $('btn-back').style.display = name === 'list' ? 'none' : '';
  $('btn-reload').style.display = name === 'list' ? '' : 'none';
  window.scrollTo(0, 0);
}
function goBack() {
  if (current === 'chart') show('memo');
  else show('list');
}

// ── 한의맥 API (CORS 허용됨 – 브라우저에서 직접 호출) ──
function hanymac(path, options) {
  return fetch(base() + path, options || {}).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

// ── 오늘 환자 목록 ───────────────────────────────────
function loadToday() {
  var el = $('plist');
  el.innerHTML = '<div class="loading"><div class="spin"></div>불러오는 중…</div>';
  hanymac('/patinfo/waitpat?date=' + todayStr())
    .then(function (res) {
      var data = (res && res.data) || [];
      // 대기(1) 우선, 그 다음 접수시간 순
      data.sort(function (a, b) {
        if (a.진료상태 === 1 && b.진료상태 !== 1) return -1;
        if (a.진료상태 !== 1 && b.진료상태 === 1) return 1;
        return String(a.접수시간 || '').localeCompare(String(b.접수시간 || ''));
      });
      todayList = data;
      renderToday();
    })
    .catch(function (e) {
      el.innerHTML = '<div class="empty">불러오기 실패<br><br>' + esc(e.message) +
        '<br><br>원내 와이파이에 연결되어 있는지,<br>설정의 서버 주소가 맞는지 확인하세요.</div>';
    });
}

function renderToday() {
  var el = $('plist');
  if (!todayList.length) {
    el.innerHTML = '<div class="empty">오늘 접수된 환자가 없습니다.</div>';
    return;
  }
  el.innerHTML = todayList.map(function (p, i) {
    var waiting = p.진료상태 === 1;
    var time = String(p.접수시간 || '').slice(0, 5);
    return '<div class="pitem ' + (waiting ? 'wait' : 'done') + '" data-i="' + i + '">' +
      '<div class="pname">' + esc(getName(p)) +
      '<div class="pmeta">' + esc(p.챠트번호 || '') + (time ? ' · ' + esc(time) : '') + '</div>' +
      '</div>' +
      '<span class="badge ' + (waiting ? 'wait' : '') + '">' + (waiting ? '대기' : '완료') + '</span>' +
      '</div>';
  }).join('');
  var waitN = todayList.filter(function (p) { return p.진료상태 === 1; }).length;
  $('title').textContent = '오늘 환자 ' + todayList.length + '명' + (waitN ? ' (대기 ' + waitN + ')' : '');
}

function pickPatient(i) {
  var p = todayList[i];
  if (!p) return;
  state.patient = p;
  state.chart = null;
  var label = esc(getName(p)) + ' <small>' + esc(p.챠트번호 || '') + '</small>';
  $('who-memo').innerHTML = label;
  $('who-chart').innerHTML = label;
  // 기존 차트 내용이 있으면 메모창에 참고용으로 보여줌
  $('memo').value = '';
  show('memo');
  $('memo').focus();
}

// ── 음성 입력 (Web Speech API) ───────────────────────
var rec = { obj: null, on: false, text: '', t0: 0, timer: null };

function toggleRec() {
  if (rec.on) { stopRec(); return; }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast('이 브라우저는 음성인식을 지원하지 않습니다. 키보드의 마이크를 사용하세요.', 'err');
    return;
  }
  var r = new SR();
  r.lang = 'ko-KR';
  r.continuous = true;
  r.interimResults = true;
  rec.text = $('memo').value ? $('memo').value + ' ' : '';

  r.onresult = function (e) {
    var interim = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) rec.text += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    $('memo').value = rec.text + interim;
  };
  r.onerror = function (e) {
    if (e.error === 'not-allowed') toast('마이크 권한이 필요합니다.', 'err');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('음성인식 오류: ' + e.error, 'err');
    stopRec();
  };
  // 모바일에서 침묵 시 자동 종료되므로, 사용자가 끄기 전까지 재시작
  r.onend = function () { if (rec.on) { try { r.start(); } catch (e) { stopRec(); } } };

  rec.obj = r;
  rec.on = true;
  rec.t0 = Date.now();
  try { r.start(); } catch (e) { toast('음성인식을 시작할 수 없습니다.', 'err'); stopRec(); return; }

  $('btn-rec').textContent = '⏹ 음성 입력 종료';
  $('btn-rec').className = 'btn rec';
  $('rec-live').style.display = '';
  rec.timer = setInterval(function () {
    var s = Math.floor((Date.now() - rec.t0) / 1000);
    $('rec-time').textContent = '녹음 중… ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }, 500);
}

function stopRec() {
  rec.on = false;
  if (rec.obj) { try { rec.obj.stop(); } catch (e) { /* 이미 종료됨 */ } rec.obj = null; }
  clearInterval(rec.timer);
  $('btn-rec').textContent = '🎤 음성 입력 시작';
  $('btn-rec').className = 'btn sub';
  $('rec-live').style.display = 'none';
}

// ── AI 응답 JSON 강건 파싱 (newtab.js와 동일 로직) ────
function safeJsonParse(raw) {
  var out = '', inStr = false, escNext = false;
  for (var i = 0; i < raw.length; i++) {
    var ch = raw[i];
    if (escNext) { out += ch; escNext = false; continue; }
    if (ch === '\\' && inStr) { out += ch; escNext = true; continue; }
    if (ch === '"') { out += ch; inStr = !inStr; continue; }
    if (inStr && ch.charCodeAt(0) < 0x20) {
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
    } else out += ch;
  }
  try { return JSON.parse(out); }
  catch (e) { return JSON.parse(repairInnerQuotes(out)); }
}

// 문자열 값 안의 이스케이프 안 된 큰따옴표를 \" 로 복구
function repairInnerQuotes(s) {
  var out = '', inStr = false, escNext = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (escNext) { out += ch; escNext = false; continue; }
    if (ch === '\\' && inStr) { out += ch; escNext = true; continue; }
    if (ch === '"') {
      if (!inStr) { inStr = true; out += ch; continue; }
      var j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (j >= s.length || ',}]:'.indexOf(s[j]) >= 0) { inStr = false; out += ch; }
      else out += '\\"';
      continue;
    }
    out += ch;
  }
  return out;
}

// ── AI 차팅 생성 ─────────────────────────────────────
function buildPrompt(name, memo) {
  return '당신은 한의사를 보조하는 의료 AI입니다.\n' +
    '아래 진료 메모를 분석하여 진료 차팅을 JSON으로만 출력하세요.\n\n' +
    '=== 환자명 ===\n' + name + '\n\n' +
    '=== 진료 메모 (원본) ===\n' + memo + '\n' +
    '\n=== 차팅 작성 기준 ===\n\n' +
    '【공통 원칙】\n' +
    '- 환자가 직접 말한 내용 위주로 기록. 추론·해석 최소화\n' +
    '- 성별·나이는 일절 기재하지 말 것\n' +
    '- 간결하게 작성 (불필요한 설명 생략)\n\n' +
    '[CC] 주증상:\n' +
    '- 주 호소 증상을 한 줄로 간결하게 (부위 + 증상 요약)\n\n' +
    '[OS] 발병:\n' +
    '- 발병 시점, 원인, 계기, 발생 상황\n\n' +
    '[PI] 현병력:\n' +
    '- 증상 양상, 기간, 악화·완화 요인 상세 기술\n' +
    '- P/I: 과거력, 복용 약물 (언급된 경우만)\n' +
    '- ROS: 언급된 항목만 (한열 / 소화 / 수면 / 대소변 / 감정)\n\n' +
    '[PA] 신체평가:\n' +
    '- Pulse: 맥상(한자) - 의미 (예: 맥세삭(脈細數) - 음허화왕)\n' +
    '- Tongue: 설색/설태 (언급된 경우만)\n' +
    '- 기타 신체 소견 (언급된 경우만)\n\n' +
    '[환자진술] Patient Statement:\n' +
    '- 환자가 직접 한 인상적인 진술을 원문에 가깝게 (없으면 빈 문자열)\n\n' +
    '[A] 변증:\n' +
    '- 주변증: 한의학 변증명만 간결하게\n' +
    '- 겸증: 부수 변증 (있는 경우만)\n\n' +
    '[P] 치료계획 (반드시 아래 고정 양식으로 한 줄 작성):\n' +
    '「A- tx : [침 혈자리, 한자 우선] 및 阿是穴 / Wc-tx : [습부항 부위·혈자리] / Mox-tx : [뜸 혈자리] / HP,IR -tx : [핫팩·적외선 부위] / [맥+설, 예: 脈滑舌淡]」\n' +
    '- A-tx(침)와 Wc-tx(습부항)는 가급적 서로 다른 2부위 이상 기입 (부위 기준: 두경부/요배부/상지부/하지부/흉복부)\n' +
    '- 혈자리는 한자 우선(예: 腰陽關, 環跳, 太溪, 양릉천), 침 끝에는 반드시 「및 阿是穴」 포함\n' +
    '- HP,IR-tx는 치료 부위명으로 기입 (예: Lumbar/요하지/경항상지/하지)\n' +
    '- 맨 끝에는 맥진과 설진을 함께 기입 (예: 脈滑舌淡, 맥약긴). 진료 메모에 맥·설 언급이 없으면 변증에 맞춰 임의로 간단히 기입할 것 (빈칸 금지)\n' +
    '- Herb(처방명+기간), Etc(생활지도·재진)는 언급된 경우만 위 줄 다음에 이어서 기입\n\n' +
    '아래 JSON으로만 응답 (마크다운 없이 순수 JSON):\n' +
    '⚠️ JSON 문자열 값 안에 큰따옴표(")를 절대 사용하지 마세요. 인용이 필요하면 『』나 〈〉를 사용하세요.\n' +
    '{\n' +
    '  "chart": {\n' +
    '    "cc": "주증상 한 줄 요약",\n' +
    '    "os": "발병 시점·원인·계기",\n' +
    '    "pi": "현병력 상세",\n' +
    '    "pa": "Pulse: ...\\nTongue: ...",\n' +
    '    "ps": "환자 진술 (없으면 빈 값)",\n' +
    '    "a": "주변증: ...\\n겸증: ...",\n' +
    '    "p": "A- tx : 腰陽關 環跳 太溪 양릉천 및 阿是穴 / Wc-tx : 腎兪, 委中 / Mox-tx : 腰陽關 / HP,IR -tx : 요하지 / 脈滑舌淡"\n' +
    '  }\n}';
}

function analyze() {
  if (!state.patient) { toast('환자를 먼저 선택하세요.', 'err'); return; }
  var memo = $('memo').value.trim();
  if (!memo) { toast('진료 메모를 입력하세요.', 'err'); return; }
  if (!CFG.apiKey) { toast('설정에서 Claude API 키를 입력하세요.', 'err'); show('set'); return; }
  if (rec.on) stopRec();

  $('btn-analyze').disabled = true;
  $('analyzing').style.display = '';

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CFG.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(getName(state.patient), memo) }]
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.error) throw new Error(data.error.message);
      var text = data.content[0].text.trim();
      var m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('JSON 형식을 찾을 수 없습니다.');
      var ch = (safeJsonParse(m[0]) || {}).chart || {};
      state.chart = ch;
      $('c-cc').value = ch.cc || '';
      $('c-os').value = ch.os || '';
      $('c-pi').value = ch.pi || '';
      $('c-pa').value = ch.pa || '';
      $('c-ps').value = ch.ps || '';
      $('c-a').value = ch.a || '';
      $('c-p').value = ch.p || '';
      show('chart');
    })
    .catch(function (e) { toast('차팅 생성 실패: ' + e.message, 'err'); })
    .then(function () {
      $('btn-analyze').disabled = false;
      $('analyzing').style.display = 'none';
    });
}

// ── 차트 텍스트 조립 / 한의맥 저장 ────────────────────
function buildChartText() {
  var parts = [];
  [['CC', 'c-cc'], ['OS', 'c-os'], ['PI', 'c-pi'], ['PA', 'c-pa'],
   ['환자진술', 'c-ps'], ['A', 'c-a'], ['P', 'c-p']].forEach(function (f) {
    var v = $(f[1]).value.trim();
    if (v) parts.push('[' + f[0] + '] ' + v);
  });
  return parts.join('\n\n');
}

function saveChart() {
  if (!state.patient) { toast('환자를 먼저 선택하세요.', 'err'); return; }
  var text = buildChartText();
  if (!text) { toast('차트 내용이 없습니다.', 'err'); return; }

  var btn = $('btn-save');
  btn.disabled = true;
  btn.textContent = '저장 중…';

  // 오늘 waitpat 목록에서 선택한 환자이므로 해당 진료일자·진료번호를 그대로 사용
  var payload = {
    증상: text,
    챠트번호: state.patient.챠트번호,
    진료일자: state.patient.진료일자 || todayStr(),
    진료번호: state.patient.진료번호 || 1
  };

  fetch(base() + '/treat/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ JSONdata: JSON.stringify(payload) })
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function () {
      toast('✅ 한의맥에 저장되었습니다.', 'ok');
      setTimeout(function () { show('list'); loadToday(); }, 900);
    })
    .catch(function (e) { toast('저장 실패: ' + e.message, 'err'); })
    .then(function () {
      btn.disabled = false;
      btn.textContent = '💾 한의맥 저장';
    });
}

function copyAll() {
  var text = buildChartText();
  if (!text) { toast('복사할 내용이 없습니다.', 'err'); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(function () { toast('복사했습니다.', 'ok'); })
      .catch(function () { toast('복사 실패', 'err'); });
  } else {
    // http 환경 등 clipboard API를 쓸 수 없을 때
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('복사했습니다.', 'ok'); }
    catch (e) { toast('복사 실패', 'err'); }
    document.body.removeChild(ta);
  }
}

// ── 초기화 ───────────────────────────────────────────
loadCfg();

$('btn-back').addEventListener('click', goBack);
$('btn-reload').addEventListener('click', loadToday);
$('btn-settings').addEventListener('click', function () {
  $('f-server').value = CFG.server;
  $('f-key').value = CFG.apiKey;
  show('set');
});
$('btn-save-set').addEventListener('click', saveCfg);
$('btn-rec').addEventListener('click', toggleRec);
$('btn-analyze').addEventListener('click', analyze);
$('btn-save').addEventListener('click', saveChart);
$('btn-copy').addEventListener('click', copyAll);

$('plist').addEventListener('click', function (e) {
  var item = e.target.closest('.pitem');
  if (item) pickPatient(parseInt(item.dataset.i, 10));
});

loadToday();
