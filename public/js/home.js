// ---------------------------------------------------------------------------
// Elias Web Console — Homepage
// ---------------------------------------------------------------------------

// Widget type registry (placeholders — will be replaced by actual app widgets)
const WIDGET_TYPES = {
  clock:    { icon: '🕐', title: '时钟',     description: '当前时间和日期' },
  weather:  { icon: '🌤️', title: '天气',     description: '实时天气信息' },
  goals:    { icon: '📋', title: '目标',     description: '活跃目标概览' },
  activity: { icon: '📊', title: '活动',     description: '近期活动摘要' },
};

// ---------------------------------------------------------------------------
// WidgetManager — manages widget state in localStorage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'elias-widgets';

class WidgetManager {
  constructor() {
    this.widgets = this._load();
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.widgets));
  }

  list() {
    return [...this.widgets];
  }

  add(type, title) {
    const id = 'widget-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    this.widgets.push({ id, type, title });
    this._save();
    return id;
  }

  remove(id) {
    this.widgets = this.widgets.filter(w => w.id !== id);
    this._save();
  }
}

let widgetManager;

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

async function loadGreeting(persona) {
  const el = document.getElementById('home-greeting');
  const textEl = el.querySelector('.home-greeting-text');
  const personaEl = el.querySelector('.home-greeting-persona');

  try {
    const data = await fetch(`/api/home/greeting?persona=${encodeURIComponent(persona)}`).then(r => r.json());
    textEl.textContent = data.greeting || '嗯，来了。';
    personaEl.textContent = `— ${persona}`;
  } catch {
    textEl.textContent = '嗯，来了。';
    personaEl.textContent = '';
  }

  el.classList.add('loaded');
}

// ---------------------------------------------------------------------------
// Chatbox
// ---------------------------------------------------------------------------

function initChatbox() {
  const input = document.getElementById('home-input');
  const btn = document.getElementById('home-send');

  function submit() {
    const text = input.value.trim();
    if (!text) return;
    sessionStorage.setItem('elias-pending-message', text);
    input.value = '';
    // Trigger switchTab('chat') in app.js
    window.dispatchEvent(new CustomEvent('elias-home-chat', { detail: { message: text } }));
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
}

// ---------------------------------------------------------------------------
// Widget rendering
// ---------------------------------------------------------------------------

function renderWidgets() {
  const grid = document.getElementById('widget-grid');
  const widgets = widgetManager.list();
  grid.innerHTML = '';

  if (widgets.length === 0) {
    grid.innerHTML = '<div class="widget-grid-empty">还没有小组件。点击上方按钮添加。</div>';
    return;
  }

  for (const w of widgets) {
    const typeDef = WIDGET_TYPES[w.type] || { icon: '📦', title: w.type, description: '' };
    const card = document.createElement('div');
    card.className = 'widget-card';
    card.innerHTML = `
      <div class="widget-card-header">
        <span class="widget-card-icon">${typeDef.icon}</span>
        <span class="widget-card-title">${escapeHtml(w.title || typeDef.title)}</span>
        <button class="widget-card-remove" data-id="${w.id}" title="移除">✕</button>
      </div>
      <div class="widget-card-body">
        <div class="widget-card-placeholder">${escapeHtml(typeDef.description)}</div>
      </div>
    `;
    card.querySelector('.widget-card-remove').addEventListener('click', () => {
      widgetManager.remove(w.id);
      renderWidgets();
    });
    grid.appendChild(card);
  }
}

function initWidgetAddBtn() {
  const addBtn = document.getElementById('widget-add-btn');
  const menu = document.getElementById('widget-type-menu');

  // Toggle menu
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  // Close menu on outside click
  document.addEventListener('click', () => {
    menu.classList.remove('show');
  });

  // Populate menu items
  menu.innerHTML = '';
  for (const [type, def] of Object.entries(WIDGET_TYPES)) {
    const item = document.createElement('div');
    item.className = 'widget-type-item';
    item.innerHTML = `<span class="widget-type-icon">${def.icon}</span> ${def.title}`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      widgetManager.add(type, def.title);
      renderWidgets();
      menu.classList.remove('show');
    });
    menu.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Entry point — called from app.js when rendering the home tab
// ---------------------------------------------------------------------------

export async function renderHome(persona) {
  widgetManager = new WidgetManager();

  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="home-container">
      <div class="home-greeting-wrapper">
        <div class="home-greeting-glow"></div>
        <div class="home-greeting" id="home-greeting">
          <div class="home-greeting-text">…</div>
          <div class="home-greeting-persona"></div>
        </div>
      </div>

      <div class="home-chatbox" id="home-chatbox">
        <input type="text" id="home-input" placeholder="输入消息，开始对话…" autofocus>
        <button id="home-send">→</button>
      </div>

      <div class="home-widgets">
        <div class="home-widgets-header">
          <span class="home-widgets-title">小组件</span>
          <div style="position:relative;">
            <button class="widget-add-btn" id="widget-add-btn">+ 添加</button>
            <div class="widget-type-menu" id="widget-type-menu"></div>
          </div>
        </div>
        <div class="widget-grid" id="widget-grid"></div>
      </div>
    </div>
  `;

  await loadGreeting(persona);
  initChatbox();
  initWidgetAddBtn();
  renderWidgets();
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
