// todos.js

document.addEventListener('DOMContentLoaded', () => {
  const { API_BASE, SC } = App.config;
  const form = document.querySelector('[data-role="todo-form"]');
  const list = document.querySelector('[data-role="todo-list"]');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const title = (fd.get('title') || '').toString().trim();
      if (!title) {
        alert('請輸入待辦內容');
        return;
      }

      const payload = {
        action: 'createTodo',
        title,
        dueDate: (fd.get('dueDate') || '').toString().trim(),
        tags: (fd.get('tags') || '').toString().trim(),
        notes: (fd.get('notes') || '').toString().trim(),
      };

      // 用 URLSearchParams，避免 JSON CORS 問題
      const body = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => body.append(k, v))
      body.append('secret', SC);

      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          body, // 不手動設 Content-Type，保持「簡單請求」
        });
        const data = await res.json();
        if (data.ok && data.todo) {
          appendTodoItem(data.todo);
          form.reset();
        } else {
          console.error(data);
          alert('新增待辦失敗');
        }
      } catch (err) {
        console.error(err);
        alert('新增待辦時發生錯誤');
      }
    });
  }

  // 初始化：載入所有待辦事項
  loadTodos();
  

  // 從 API 載入事件
  async function loadTodos() {
    try {
      const res = await fetch(`${API_BASE}?resource=todos`);
      const data = await res.json();
      renderTodoList(data.tags || []);
    } catch (err) {
      console.error(err);
      alert('載入事件失敗');
    }
  }

  function renderTodoList(events) {
    if (!list) return;
    list.innerHTML = '';
    events.forEach(ev => appendTodoItem(ev));
  }

  function appendTodoItem(todo) {
    if (!list) return;

    const li = document.createElement('li');
    li.className = 'list-item';
    li.dataset.id = todo.id;

    li.innerHTML = `
      <div class="item-main">
        <h3 class="item-title">${todo.title || ''}</h3>
        <div class="item-meta"></div>
        <p style="margin:0; font-size:0.85rem; color:var(--text-main);">${todo.notes || ''}</p>
      </div>
      <div class="item-actions">
        <!-- 先只做刪除，編輯之後再補 -->
        <button class="btn btn-danger" type="button" data-role="delete">刪除</button>
      </div>
    `;

    const metaParts = [];
    if (todo.dueDate) {
      metaParts.push(`預計完成：${todo.dueDate}`);
    }
    if (todo.tags) {
      metaParts.push(`標籤：${todo.tags}`);
    }

    li.querySelector('.item-meta').innerHTML = metaParts.join(' · ');
    list.prepend(li); // 最新的放最上面

    // 綁定刪除按鈕
    const deleteBtn = li.querySelector('[data-role="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDelete(todo.id, li));
    }

    list.appendChild(li);
  }

  async function handleDelete(id, li) {
    if (!id) return;
    if (!confirm('確定要刪除這個待辦事項嗎？')) return;

    const body = new URLSearchParams();
    body.append('action', 'deleteTodo');
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

});
