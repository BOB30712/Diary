// daily.js

document.addEventListener('DOMContentLoaded', () => {
  const { API_BASE, SC } = App.config;
  const todaySpan = document.querySelector('[data-role="today-display"]');
  const form = document.querySelector('[data-role="daily-form"]');
  const list = document.querySelector('[data-role="daily-list"]');
  const tagSelect = document.querySelector('[data-role="tag-select"]');

  // 先看 URL 有沒有指定 date=YYYY-MM-DD，沒有就用今天
  const url = new URL(window.location.href);
  const paramDate = url.searchParams.get('date');

  const today = new Date();
  const defaultDateStr = today.toISOString().slice(0, 10);

  const currentDateStr = (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate))
    ? paramDate
    : defaultDateStr;

  if (todaySpan) {
    todaySpan.textContent = currentDateStr;
  }

  // 初始化：載入今天的事件
  loadEvents(currentDateStr);

  // 載入標籤選單（從 Todos）
  loadTagOptions();

  // 表單送出：呼叫 API 新增事件
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);

      let payload = {
        action: 'createEvent',
        date: currentDateStr,  // ★ 使用目前頁面代表的日期
        title: (fd.get('title') || '').toString().trim(),
        time: (fd.get('time') || '').toString().trim(),
        tags: '',
        notes: (fd.get('notes') || '').toString().trim(),
      };

      if (!payload.title) {
        alert('請輸入事件標題');
        return;
      }

      // 從 select multiple 取出所有選取的標籤
      let tags = '';
      if (tagSelect) {
        console.log(tagSelect.value)
        const selected = Array.from(tagSelect.selectedOptions)
          .map(opt => opt.value)
          .filter(Boolean);
        tags = selected.join(',');
        payload.tags = tagSelect.value;
      }

      // 用 URLSearchParams，避免 JSON CORS 問題
      const body = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => body.append(k, v));
      body.append('secret', SC);

      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          //headers: { 'Content-Type': 'application/json' },
          //body: JSON.stringify(payload),
          body: body,
        });
        const data = await res.json();
        if (data.ok && data.event) {
          appendEventItem(data.event);
          form.reset();
          // reset 後也要把 select 清空選取
          if (tagSelect) {
            Array.from(tagSelect.options).forEach(opt => opt.selected = false);
          }
        } else {
          console.error(data);
          alert('儲存事件失敗');
        }
      } catch (err) {
        console.error(err);
        alert('儲存事件時發生錯誤');
      }
    });
  }

  // 從 API 載入事件
  async function loadEvents(dateStr) {
    try {
      const res = await fetch(`${API_BASE}?date=${encodeURIComponent(dateStr)}`);
      const data = await res.json();
      renderEventList(data.events || []);
    } catch (err) {
      console.error(err);
      alert('載入事件失敗');
    }
  }

  function renderEventList(events) {
    if (!list) return;
    list.innerHTML = '';
    events.forEach(ev => appendEventItem(ev));
  }

  function appendEventItem(ev) {
    if (!list) return;

    const li = document.createElement('li');
    li.className = 'list-item';
    li.dataset.id = ev.id;

    li.innerHTML = `
      <div class="item-main">
        <h3 class="item-title"></h3>
        <div class="item-meta"></div>
        <p style="margin:0; font-size:0.85rem; color:var(--text-main);"></p>
      </div>
      <div class="item-actions">
        <!-- 先只做刪除，編輯之後再補 -->
        <button class="btn btn-danger" type="button" data-role="delete">刪除</button>
      </div>
    `;

    li.querySelector('.item-title').textContent = ev.title || '';
    li.querySelector('p').textContent = ev.notes || '';

    const meta = [];
    if (ev.time) {
      meta.push(`時間：${ev.time}`);
    }
    if (ev.tags) {
      const tagHtml = tagToSpan(ev.tags);
      meta.push(`標籤：${tagHtml}`);
    }
    li.querySelector('.item-meta').innerHTML = meta.join(' · ') || ' ';

    // 綁定刪除按鈕
    const deleteBtn = li.querySelector('[data-role="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDelete(ev.id, li));
    }

    list.appendChild(li);
  }



  function tagToSpan(tag) {
    let cls = 'tag';
    if (tag.includes('工作')) cls += ' tag--work';
    else if (tag.includes('個人')) cls += ' tag--personal';
    else if (tag.includes('會議')) cls += ' tag--meeting';
    else if (tag.includes('學習')) cls += ' tag--study';
    return `<span class="${cls}">${tag}</span>`;
  }

  async function handleDelete(id, li) {
    if (!id) return;
    if (!confirm('確定要刪除這個事件嗎？')) return;

    const body = new URLSearchParams();
    body.append('action', 'deleteEvent');
    body.append('id', id);
    body.append('secret', SC);

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        // headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      const data = await res.json();
      if (data.ok) {
        li.remove();
      } else {
        console.error(data);
        alert('刪除失敗');
      }
    } catch (err) {
      console.error(err);
      alert('刪除時發生錯誤');
    }
  }

  // ★ 從 Todos 取得標籤清單，填入 select
  async function loadTagOptions() {

    if (!tagSelect) return;
    tagSelect.innerHTML = '<option value="">載入中...</option>';

    try {
      const res = await fetch(`${API_BASE}?resource=tags`);
      const data = await res.json();
      const tags = data.tags || [];

      tagSelect.innerHTML = '';
      if (!tags.length) {
        tagSelect.innerHTML = '<option value="">尚未建立待辦標籤</option>';
        return;
      }

      tags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        tagSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      tagSelect.innerHTML = '<option value="">標籤載入失敗</option>';
    }
  }

});
