// ═══════════════════════════════════════════════
// 한의원 진료기록 시스템 v1 - Code.gs
// ═══════════════════════════════════════════════

const SS_ID = '1TvmC4Yj82pGkrTOjQP271sxFrvThY5pyf2-x80BFOqU';
const RECORD_SHEET = '진료기록';

function doGet(e) {
  return HtmlService.createHtmlOutput('<p>한의원 진료기록 시스템</p>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── 공통 POST 라우터 ─────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'saveRecord') {
      var result = saveRecord(data.record);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'getRecords') {
      var records = getRecords();
      return ContentService.createTextOutput(JSON.stringify(records))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'addHerbPatient') {
      var result = addHerbPatient(data.record);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'getHerbPatients') {
      var records = getHerbPatients();
      return ContentService.createTextOutput(JSON.stringify(records))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'updateHerbStatus') {
      var result = updateHerbStatus(data.id, data.status, data.memo);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: '알 수 없는 action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 컬럼 보정(1회 실행용) ────────────────────────
// Apps Script 편집기에서 이 함수를 직접 실행하면
// 누락된 컬럼(한의학변증·양방질환명·진료평가 등)이 시트에 즉시 추가됩니다.
// 재배포만으로는 다음 저장 때 자동 추가되지만, 즉시 확인하고 싶을 때 사용.
function repairColumns() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(RECORD_SHEET);
  if (!sheet) sheet = createRecordSheet(ss);
  var headers = getHeaders(sheet); // 누락 컬럼 자동 추가
  return '현재 컬럼: ' + headers.join(', ');
}

// ── 진료기록 저장 ────────────────────────────────
function saveRecord(record) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(RECORD_SHEET);
  if (!sheet) sheet = createRecordSheet(ss);

  var headers = getHeaders(sheet);
  record.id = record.id || String(Date.now());
  record['저장일시'] = new Date().toLocaleString('ko-KR');

  if (sheet.getLastRow() > 1) {
    var idCol = headers.indexOf('id') + 1;
    var idVals = sheet.getRange(2, idCol, sheet.getLastRow()-1, 1).getValues();
    for (var i = 0; i < idVals.length; i++) {
      if (String(idVals[i][0]).trim() === String(record.id).trim()) {
        sheet.getRange(i+2, 1, 1, headers.length).setValues([headers.map(function(h){ return record[h] || ''; })]);
        return { success: true, id: record.id };
      }
    }
  }
  sheet.appendRow(headers.map(function(h){ return record[h] || ''; }));
  return { success: true, id: record.id };
}

// ── 진료기록 전체 조회 ───────────────────────────
function getRecords() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(RECORD_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i].every(function(c){ return c === '' || c === null; })) continue;
    var obj = {};
    headers.forEach(function(h, idx){ obj[h] = String(data[i][idx] || ''); });
    rows.push(obj);
  }
  return rows.reverse();
}

// ── 헤더 관리 ────────────────────────────────────
// 확장 프로그램(newtab.js)이 저장/불러올 때 쓰는 실제 컬럼과 반드시 일치해야 함.
// 주증상/OS/PI/PA/환자진술: 현재 SOAP 구조 / SOAP_S,SOAP_O: 구버전 데이터 호환용 유지
var RECORD_COLS = ['id','환자명','나이성별','진료일자','상담원문메모','주증상','OS','PI','PA','환자진술','SOAP_S','SOAP_O','SOAP_A','SOAP_P','한의학변증','양방질환명','문자메시지초안','진료평가','처방명','처방구성','용법','기간','복약지도문','상담원문','저장일시'];

function getHeaders(sheet) {
  var all = RECORD_COLS;
  var existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(function(h){ return String(h).trim(); });
  all.forEach(function(col){
    if (existing.indexOf(col) < 0) { sheet.getRange(1, sheet.getLastColumn()+1).setValue(col); existing.push(col); }
  });
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h).trim(); });
}

function createRecordSheet(ss) {
  var sheet = ss.insertSheet(RECORD_SHEET);
  var headers = RECORD_COLS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8f4ea');
  sheet.setFrozenRows(1);
  return sheet;
}

// ════════════════════════════════════════════════
// 첩약 환자 관리 (10일 콜)
// 상태: 미완료 / 완료 / 온다고했는데아직안오심 / 보류
// ════════════════════════════════════════════════

const HERB_SHEET = '첩약환자';

function getHerbHeaders(sheet) {
  var all = ['id','환자명','처방명','기간','등록일','콜예정일','콜상태','완료일시','메모'];
  var existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(function(h){ return String(h).trim(); });
  all.forEach(function(col){
    if (existing.indexOf(col) < 0) { sheet.getRange(1, sheet.getLastColumn()+1).setValue(col); existing.push(col); }
  });
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h).trim(); });
}

function createHerbSheet(ss) {
  var sheet = ss.insertSheet(HERB_SHEET);
  var headers = ['id','환자명','처방명','기간','등록일','콜예정일','콜상태','완료일시','메모'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#fdf6e3');
  sheet.setFrozenRows(1);
  [1,2,3,4,5,6,7,8,9].forEach(function(c,i){
    sheet.setColumnWidth(i+1, [60,80,140,80,90,90,120,110,160][i]);
  });
  return sheet;
}

// 첩약 환자 등록 (복약지도문 저장 시 자동 호출)
function addHerbPatient(record) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(HERB_SHEET);
  if (!sheet) sheet = createHerbSheet(ss);
  var headers = getHerbHeaders(sheet);

  var today = new Date();
  var callDate = new Date(today);
  callDate.setDate(callDate.getDate() + 10);
  var fmt = function(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  };

  var row = {
    id: record.id || String(Date.now()),
    환자명: record.환자명 || '',
    처방명: record.처방명 || '',
    기간: record.기간 || '',
    등록일: fmt(today),
    콜예정일: fmt(callDate),
    콜상태: '미완료',
    완료일시: '',
    메모: record.메모 || ''
  };

  sheet.appendRow(headers.map(function(h){ return row[h] || ''; }));
  return { success: true, id: row.id };
}

// 첩약 환자 목록 조회
function getHerbPatients() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(HERB_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i].every(function(c){ return c === '' || c === null; })) continue;
    var obj = {};
    headers.forEach(function(h, idx){ obj[h] = String(data[i][idx] || ''); });
    rows.push(obj);
  }
  return rows;
}

// 콜 상태 업데이트
// status: '완료' | '미완료' | '온다고했는데아직안오심' | '보류'
function updateHerbStatus(id, status, memo) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(HERB_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return { success: false };
  var headers = getHerbHeaders(sheet);
  var idCol = headers.indexOf('id') + 1;
  var idVals = sheet.getRange(2, idCol, sheet.getLastRow()-1, 1).getValues();
  var now = new Date().toLocaleString('ko-KR');
  for (var i = 0; i < idVals.length; i++) {
    if (String(idVals[i][0]).trim() === String(id).trim()) {
      var row = i + 2;
      sheet.getRange(row, headers.indexOf('콜상태')+1).setValue(status);
      sheet.getRange(row, headers.indexOf('완료일시')+1).setValue(status === '완료' ? now : '');
      if (memo !== undefined && memo !== null) {
        sheet.getRange(row, headers.indexOf('메모')+1).setValue(memo);
      }
      return { success: true };
    }
  }
  return { success: false, error: '해당 ID 없음' };
}
