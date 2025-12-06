const DAILY_SHEET_NAME = 'DailyEvents';
const TODOS_SHEET_NAME = 'Todos';

const SC = 'wwwwwwwwwwwww';

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('找不到工作表：' + name);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 取得事件 or 標籤
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const resource = params.resource || '';  // resource=tags / events
  const date = params.date || '';


  // 1) 取得標籤：來自 Todos 工作表
  if (resource === 'tags') {
    const tags = getAllTagsFromTodos_();
    return json_({ ok: true, tags });
  }

  // 2) 取得 Todos 工作表
  if (resource === 'todos') {
    const tags = getTodos_();
    return json_({ ok: true, tags });
  }

  // 3) 取得當天事件列表（預設）
  const events = getEventsByDate_(date);
  return json_({ ok: true, events });
}

// 新增 daily 事件、待辦…等
function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action;

  // --- 簡單 API 驗證 ---
  const clientSecret = params.secret || '';
  if (!SC || clientSecret !== SC) {
    // 不回太多細節，避免暴露資訊
    return json_({ ok: false, error: 'unauthorized' });
  }

  if (action === 'createEvent') {
    const event = createEvent_(params);
    return json_({ ok: true, event });
  }

  if (action === 'deleteEvent') {
    const ok = deleteEvent_(params.id);
    return json_({ ok });
  }

  if (action === 'createTodo') {
    const todo = createTodo_(params);
    return json_({ ok: true, todo });
  }

  if (action === 'deleteTodo') {
    const ok = deleteTodo_(params.id);
    return json_({ ok });
  }



  return json_({ ok: false, error: '未知的 action' });
}

/** 依日期取得 DailyEvents */
function getEventsByDate_(date) {
  const sheet = getSheet_(DAILY_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0];
  const rows = values.slice(1);

  const idx = {
    id: header.indexOf('id'),
    date: header.indexOf('date'),
    time: header.indexOf('time'),
    title: header.indexOf('title'),
    notes: header.indexOf('notes'),
    tags: header.indexOf('tags'),
    createdAt: header.indexOf('createdAt'),
  };

  return rows
    .filter(r => !date || String(r[idx.date]) === date)
    .map(r => ({
      id: r[idx.id],
      date: formatDateCell_(r[idx.date]),
      time: formatTimeCell_(r[idx.time]),
      title: r[idx.title],
      notes: r[idx.notes],
      tags: r[idx.tags],
      createdAt: r[idx.createdAt],
    }));
}


function getTodos_() {
  const sheet = getSheet_(TODOS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0];
  const rows = values.slice(1);

  const idx = {
    id: header.indexOf('id'),
    dueDate: header.indexOf('dueDate'),
    title: header.indexOf('title'),
    notes: header.indexOf('notes'),
    tags: header.indexOf('tags'),
    status: header.indexOf('status'),
    createdAt: header.indexOf('createdAt'),
  };

  return rows
    .map(r => ({
      id: r[idx.id],
      dueDate: formatDateCell_(r[idx.dueDate]),
      title: r[idx.title],
      notes: r[idx.notes],
      tags: r[idx.tags],
      status: r[idx.status],
      createdAt: r[idx.createdAt],
    }));
}

/** 建立 DailyEvents 事件 */
function createEvent_(params) {
  const sheet = getSheet_(DAILY_SHEET_NAME);
  const id = 'EVT_' + Date.now();

  const date = sanitizeCell_(params.date, 20);          // yyyy-MM-dd
  const time = sanitizeCell_(params.time || '', 20);    // HH:mm 或空字串
  const title = sanitizeCell_(params.title || '', 200);
  const notes = sanitizeCell_(params.notes || '', 2000);
  const tags = sanitizeCell_(params.tags || '', 300);   // 逗號分隔標籤
  const createdAt = new Date().toISOString();

  sheet.appendRow([id, date, time, title, notes, tags, createdAt]);

  return { id, date, time, title, notes, tags, createdAt };
}

/** 刪除 DailyEvents 事件 */
function deleteEvent_(id) {
  if (!id) return false;
  const sheet = getSheet_(DAILY_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return false;

  const header = values[0];
  const rows = values.slice(1);
  const idIndex = header.indexOf('id');

  let rowIndexToDelete = -1;
  rows.forEach((r, idx) => {
    if (r[idIndex] === id) {
      rowIndexToDelete = idx + 2; // +1 header, +1 1-based
    }
  });

  if (rowIndexToDelete > -1) {
    sheet.deleteRow(rowIndexToDelete);
    return true;
  }
  return false;
}

/** 建立 Todos 待辦 */
function createTodo_(params) {
  const sheet = getSheet_(TODOS_SHEET_NAME);
  const id = 'TODO_' + Date.now();

  const title = params.title || '';
  const dueDate = params.dueDate || '';
  const type = params.type || '';
  const tags = params.tags || '';
  const notes = params.notes || '';
  const status = 'open'; // 預設未完成
  const createdAt = new Date().toISOString();

  sheet.appendRow([id, title, dueDate, type, tags, notes, status, createdAt]);

  return { id, title, dueDate, type, tags, notes, status, createdAt };
}

/** 刪除 Todos 待辦，並且一併刪除 DailyEvents 中含有相同標籤的事件 */
function deleteTodo_(id) {
  if (!id) return false;

  const sheet = getSheet_(TODOS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return false;

  const header = values[0];
  const rows = values.slice(1);

  const idIndex = header.indexOf('id');
  const tagsIndex = header.indexOf('tags');
  if (idIndex === -1) return false;

  let rowIndexToDelete = -1;
  let todoTags = '';

  rows.forEach((r, idx) => {
    if (r[idIndex] === id) {
      rowIndexToDelete = idx + 2; // +1 header, +1 1-based
      if (tagsIndex !== -1) {
        todoTags = r[tagsIndex] || '';
      }
    }
  });

  if (rowIndexToDelete === -1) {
    return false;
  }

  // 先刪除 DailyEvents 中含有這些標籤的事件
  if (todoTags) {
    deleteDailyEventsByTags_(todoTags);
  }

  // 再刪除 Todos 該筆
  sheet.deleteRow(rowIndexToDelete);
  return true;
}


/**
 * 根據待辦的 tags，刪除 DailyEvents 中含有相同標籤的事件
 * 規則：只要事件的 tags 中「含有任一個待辦標籤」，就會被一起刪除
 * @param {string} tagsStr 逗號分隔的標籤字串（來自 Todos.tags）
 * @return {number} 實際刪除的事件筆數
 */
function deleteDailyEventsByTags_(tagsStr) {
  if (!tagsStr) return 0;

  const sheet = getSheet_(DAILY_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return 0;

  const header = values[0];
  const rows = values.slice(1);

  const tagsIndex = header.indexOf('tags');
  if (tagsIndex === -1) return 0;

  // 待辦的標籤集合
  const targetTags = String(tagsStr)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (!targetTags.length) return 0;

  let deletedCount = 0;

  // 由下往上刪，避免 deleteRow 影響後面列索引
  for (let i = rows.length - 1; i >= 0; i--) {
    const cell = rows[i][tagsIndex];
    if (!cell) continue;

    const eventTags = String(cell)
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // 只要有任何一個共同標籤，就刪掉該事件
    const hasCommon = eventTags.some(t => targetTags.indexOf(t) !== -1);
    if (hasCommon) {
      sheet.deleteRow(i + 2); // +1 header, +1 1-based
      deletedCount++;
    }
  }

  return deletedCount;
}



/** 從 Todos 工作表取得所有「不重複的標籤列表」 */
function getAllTagsFromTodos_() {
  const sheet = getSheet_(TODOS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0];
  const rows = values.slice(1);

  const tagsIndex = header.indexOf('tags');
  if (tagsIndex === -1) return [];

  const tagSet = {};

  rows.forEach(r => {
    const cell = r[tagsIndex];
    if (!cell) return;

    String(cell).split(',').forEach(t => {
      const trimmed = t.trim();
      if (trimmed) {
        tagSet[trimmed] = true;
      }
    });
  });

  return Object.keys(tagSet).sort();
}

/** 把 Date 物件轉成 yyyy-MM-dd，跟前端 todayStr 一致 */
function formatDateCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }
  return value ? String(value) : '';
}

/** 把 Date 物件轉成 HH:mm */
function formatTimeCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }
  return value ? String(value) : '';
}

// 將使用者輸入的字串做簡單清洗：避免公式注入、控制長度
function sanitizeCell_(value, maxLen) {
  const str = value ? String(value) : '';

  // 去掉前後空白
  let s = str.trim();

  // 避免公式注入：若以 = + - @ 開頭，加 ' 轉為純文字
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }

  // 控制最大長度，避免被塞超長內容
  const limit = maxLen || 500;
  if (s.length > limit) {
    s = s.substring(0, limit);
  }

  return s;
}




