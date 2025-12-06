const API_BASE = 'https://script.google.com/macros/s/AKfycbzVE12JMAg-HyB1Zrk3mjs-tl0ZvEmZIkBwpGVjQgQchW8Jic6nyP7T4G5MqaEnJmsR4Q/exec';

document.addEventListener('DOMContentLoaded', () => {
  const { ui } = App;
  const yearSpan = document.querySelector('[data-role="calendar-year"]');
  const monthSpan = document.querySelector('[data-role="calendar-month"]');
  const grid = document.querySelector('[data-role="calendar-grid"]');
  const prevBtn = document.querySelector('[data-role="calendar-prev"]');
  const nextBtn = document.querySelector('[data-role="calendar-next"]');

  if (!yearSpan || !monthSpan || !grid) {
    console.error('calendar: 缺少必要的掛載節點');
    return;
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // yyyy-MM-dd

  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth() + 1; // 1-12

  // 初始化：顯示本月
  updateHeader();
  renderCalendar(currentYear, currentMonth);

  // 上一個月 / 下一個月
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const { year, month } = shiftMonth(currentYear, currentMonth, -1);
      currentYear = year;
      currentMonth = month;
      updateHeader();
      renderCalendar(currentYear, currentMonth);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const { year, month } = shiftMonth(currentYear, currentMonth, 1);
      currentYear = year;
      currentMonth = month;
      updateHeader();
      renderCalendar(currentYear, currentMonth);
    });
  }

  function updateHeader() {
    yearSpan.textContent = String(currentYear);
    monthSpan.textContent = String(currentMonth);
  }

  function shiftMonth(year, month, diff) {
    // month: 1-12, diff: +1 / -1
    const base = new Date(year, month - 1 + diff, 1);
    return {
      year: base.getFullYear(),
      month: base.getMonth() + 1,
    };
  }

  function pad2(n) {
    return ('0' + n).slice(-2);
  }

  async function renderCalendar(year, month) {
    grid.innerHTML = '';

    // 先取得該月所有 DailyEvents，並依 date 彙總 tags
    let eventsMap = {};
    try {
      eventsMap = await fetchMonthEvents(year, month);
    } catch (err) {
      console.error('載入月事件失敗', err);
    } finally {
      ui.hideLoading(); // 不管成功 / 失敗，都把 overlay 關掉
    }

    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();

    // 前置空格（讓 1 號對齊正確星期）
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day';
      grid.appendChild(empty);
    }

    // 實際日期格
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;

      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      dayDiv.dataset.date = dateStr;

      // 如果是今天，套用特別樣式（藍色外框在 CSS 的 .calendar-day--today）
      if (dateStr === todayStr) {
        dayDiv.classList.add('calendar-day--today');
      }

      const numDiv = document.createElement('div');
      numDiv.className = 'calendar-day-number';
      numDiv.textContent = String(day);

      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'calendar-day-tags';

      const tags = eventsMap[dateStr] || [];
      tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'calendar-tag';
        span.textContent = tag;
        tagsDiv.appendChild(span);
      });

      dayDiv.appendChild(numDiv);
      dayDiv.appendChild(tagsDiv);

      // 點擊某一天：詢問是否跳轉到 daily
      dayDiv.addEventListener('click', () => {
        handleDayClick(dateStr);
      });

      grid.appendChild(dayDiv);
    }
  }

  async function fetchMonthEvents(year, month) {
    const params = new URLSearchParams({
      resource: 'monthEvents',
      year: String(year),
      month: String(month),
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`);
    const data = await res.json();

    const events = data.events || [];
    const map = {};

    events.forEach(ev => {
      const d = ev.date;       // yyyy-MM-dd（後端已 format）
      const tags = parseTags(ev.tags);
      if (!d) return;
      if (!map[d]) {
        map[d] = new Set();
      }
      tags.forEach(t => map[d].add(t));
    });

    // 將 Set 轉成 Array，方便 render
    const result = {};
    Object.keys(map).forEach(d => {
      result[d] = Array.from(map[d]);
    });
    return result;
  }

  function parseTags(tagStr) {
    if (!tagStr) return [];
    return String(tagStr)
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }

  function handleDayClick(dateStr) {
    const ok = window.confirm(`要前往 ${dateStr} 的記事頁面嗎？`);
    if (!ok) return;

   
    window.location.href = `index.html?date=${encodeURIComponent(dateStr)}`;
  }
});
