// Elias Console — Application Controller
import { getJSON, postJSON } from "./api.js";

// --- State ---
const state = {
  user: null as { id: string; username: string; avatar: string } | null,
  personas: [] as Array<{ name: string; displayName: string; triggers: string[] }>,
  activePersona: "elias",
  activeTab: "chat",
};

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
});

async function checkAuth() {
  try {
    const user = await getJSON("/api/auth/me");
    state.user = user;
    showApp();
  } catch {
    // Not logged in — check URL for error
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) {
      showError(params.get("error") || "Unknown error");
    } else {
      showLogin();
    }
  }
}

function showLogin() {
  document.getElementById("login-view")!.classList.remove("hidden");
  document.getElementById("app-view")!.classList.add("hidden");
  document.getElementById("error-view")!.classList.add("hidden");
}

function showError(msg: string) {
  document.getElementById("error-view")!.classList.remove("hidden");
  document.getElementById("login-view")!.classList.add("hidden");
  document.getElementById("app-view")!.classList.add("hidden");
  document.getElementById("error-msg")!.textContent = msg;
}

async function showApp() {
  document.getElementById("app-view")!.classList.remove("hidden");
  document.getElementById("login-view")!.classList.add("hidden");
  document.getElementById("error-view")!.classList.add("hidden");

  // User info in sidebar
  document.getElementById("sidebar-username")!.textContent = state.user!.username;
  if (state.user!.avatar) {
    document.getElementById("sidebar-avatar")!.setAttribute(
      "src",
      `https://cdn.discordapp.com/avatars/${state.user!.id}/${state.user!.avatar}.png?size=64`
    );
  }
  document.getElementById("btn-logout")!.addEventListener("click", () => {
    window.location.href = "/auth/logout";
  });

  // Load personas
  await loadPersonas();

  // Render sidebar
  renderSidebar();

  // Load persisted theme
  loadTheme();

  // Render default tab
  switchTab("chat");
}

// --- Personas ---
async function loadPersonas() {
  try {
    const data = await getJSON("/api/personas");
    state.personas = data.personas;
    if (state.personas.length > 0 && !state.personas.find((p) => p.name === state.activePersona)) {
      state.activePersona = state.personas[0]!.name;
    }
  } catch (e) {
    console.error("Failed to load personas:", e);
  }
}

// --- Sidebar ---
function renderSidebar() {
  const nav = document.getElementById("sidebar-nav")!;
  nav.innerHTML = "";

  const tabs = [
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "kb", icon: "🧠", label: "Knowledge Base" },
    { id: "goals", icon: "📋", label: "Goals" },
    { id: "settings", icon: "⚙️", label: "Settings" },
    { id: "style", icon: "🎨", label: "Style" },
  ];

  for (const tab of tabs) {
    const item = document.createElement("div");
    item.className = `nav-item${state.activeTab === tab.id ? " active" : ""}`;
    item.innerHTML = `<span class="nav-icon">${tab.icon}</span> ${tab.label}`;
    item.addEventListener("click", () => switchTab(tab.id));
    nav.appendChild(item);
  }

  // Persona list
  const list = document.getElementById("persona-list")!;
  list.innerHTML = "";
  for (const p of state.personas) {
    const item = document.createElement("div");
    item.className = `persona-item${p.name === state.activePersona ? " active" : ""}`;
    item.innerHTML = `<span class="persona-dot"></span> ${p.displayName}`;
    item.addEventListener("click", () => {
      state.activePersona = p.name;
      renderSidebar();
      if (state.activeTab === "chat") renderChat();
    });
    list.appendChild(item);
  }
}

// --- Tab Routing ---
async function switchTab(tabId: string) {
  state.activeTab = tabId;
  renderSidebar();
  const main = document.getElementById("main-content")!;
  main.innerHTML = '<div class="spinner"></div>';

  try {
    switch (tabId) {
      case "chat": await renderChat(); break;
      case "kb": await renderKB(); break;
      case "goals": await renderGoals(); break;
      case "settings": await renderSettings(); break;
      case "style": renderStyle(); break;
    }
  } catch (e: any) {
    main.innerHTML = `<div class="card"><div class="card-body">加载失败: ${e.message}</div></div>`;
  }

  // Update nav active state
  document.querySelectorAll(".nav-item").forEach((el) => {
    const id = (el as HTMLElement).textContent?.trim().toLowerCase().replace(/[^a-z]/g, "") ?? "";
    el.classList.toggle("active", id === tabId || (tabId === "kb" && id.includes("knowledge")));
  });
}

// --- Chat Tab ---
async function renderChat() {
  const main = document.getElementById("main-content")!;
  const p = state.personas.find((x) => x.name === state.activePersona);
  const title = p?.displayName || state.activePersona;

  main.innerHTML = `
    <div class="chat-container">
      <div class="card" style="flex:1;display:flex;flex-direction:column;">
        <div class="card-header">
          💬 ${title}
          <div style="display:flex;gap:8px;">
            <label class="toggle" title="Fast mode (skip deep thinking)">
              <span style="font-size:var(--fs-sm);">Quick</span>
              <span class="toggle-track" id="fast-toggle"></span>
            </label>
            <button class="btn btn-sm" id="btn-clear-history">Clear</button>
          </div>
        </div>
        <div class="chat-messages" id="chat-msgs">
          <div class="chat-empty">选择一个人格，开始对话</div>
        </div>
        <div class="chat-input-area" style="padding:var(--space-md);">
          <input class="form-input" id="chat-input" placeholder="输入消息..." autofocus>
          <button class="btn btn-primary" id="btn-send">发送</button>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById("chat-input") as HTMLInputElement;
  const btn = document.getElementById("btn-send")!;
  const msgs = document.getElementById("chat-msgs")!;
  let fastMode = false;

  // Fast mode toggle
  const fastTrack = document.getElementById("fast-toggle")!;
  fastTrack.addEventListener("click", () => {
    fastMode = !fastMode;
    fastTrack.classList.toggle("on", fastMode);
  });

  // Clear history
  document.getElementById("btn-clear-history")!.addEventListener("click", async () => {
    await postJSON("/api/chat/clear");
    msgs.innerHTML = '<div class="chat-empty">历史已清除</div>';
  });

  // Send message
  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.disabled = true;
    (btn as HTMLButtonElement).disabled = true;

    // Add user message
    addMsg("user", text);
    const loadingEl = addMsg("assistant", '<span class="spinner"></span>', true);

    try {
      const data = await postJSON("/api/chat", {
        persona: state.activePersona,
        message: text,
        fastMode,
      });
      // Replace loading bubble
      loadingEl.querySelector(".msg-content")!.innerHTML = escapeHtml(data.reply);
      // Add mood badge
      if (data.mood && data.mood !== "平静") {
        const meta = loadingEl.querySelector(".msg-meta")!;
        meta.innerHTML += ` <span class="msg-mood">${escapeHtml(data.mood)}</span>`;
      }
      loadingEl.classList.remove("loading");
    } catch (e: any) {
      loadingEl.querySelector(".msg-content")!.innerHTML = `❌ ${escapeHtml(e.message)}`;
      loadingEl.classList.remove("loading");
    }

    input.disabled = false;
    (btn as HTMLButtonElement).disabled = false;
    input.focus();
    msgs.scrollTop = msgs.scrollHeight;
  }

  // Press Enter to send
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  btn.addEventListener("click", send);

  msgContainer = msgs;
}

// Chat helpers (module-level for reuse)
let msgContainer: HTMLElement | null = null;
let msgCounter = 0;

function addMsg(role: "user" | "assistant", content: string, loading = false): HTMLElement {
  if (!msgContainer) throw new Error("Chat not rendered");
  const empty = msgContainer.querySelector(".chat-empty");
  if (empty) empty.remove();

  const el = document.createElement("div");
  el.className = `msg ${role}${loading ? " loading" : ""}`;
  const avatarLetter = role === "user" ? (state.user?.username?.[0] || "U") : (state.personas.find((p) => p.name === state.activePersona)?.displayName?.[0] || "E");
  el.innerHTML = `
    <div class="msg-avatar">${escapeHtml(avatarLetter)}</div>
    <div class="msg-bubble">
      <div class="msg-meta">${role === "user" ? "你" : state.personas.find((p) => p.name === state.activePersona)?.displayName || "Elias"}</div>
      <div class="msg-content">${content}</div>
    </div>
  `;
  msgContainer.appendChild(el);
  msgContainer.scrollTop = msgContainer.scrollHeight;
  return el;
}

// --- KB Tab ---
async function renderKB() {
  const main = document.getElementById("main-content")!;
  main.innerHTML = `
    <div class="card"><div class="card-header">🧠 Knowledge Base</div>
      <div class="card-body kb-layout">
        <div class="kb-tree" id="kb-tree"><div class="spinner"></div></div>
        <div class="kb-editor">
          <div class="kb-breadcrumb" id="kb-path"></div>
          <textarea class="form-textarea" id="kb-textarea" placeholder="选择一个文件..." readonly></textarea>
          <div class="kb-actions">
            <button class="btn btn-primary" id="kb-save" disabled>保存</button>
            <button class="btn" id="kb-new">新建文件</button>
            <button class="btn btn-danger btn-sm" id="kb-delete" disabled>删除</button>
            <span style="margin-left:auto;font-size:var(--fs-sm);color:var(--text-secondary);" id="kb-source"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  let currentFile: { path: string; source: string } | null = null;

  // Load tree
  const data = await getJSON("/api/vault/tree");
  renderTree(data.roots, document.getElementById("kb-tree")!);

  document.getElementById("kb-save")!.addEventListener("click", async () => {
    if (!currentFile || currentFile.source === "vault") return;
    const content = (document.getElementById("kb-textarea") as HTMLTextAreaElement).value;
    await postJSON("/api/vault/write", { filePath: currentFile.path, content });
    alert("已保存。");
  });

  document.getElementById("kb-new")!.addEventListener("click", async () => {
    const name = prompt("文件名（如 notes/备忘录.md）:");
    if (!name) return;
    const content = prompt("内容（可选）:") || "";
    await postJSON("/api/vault/write", { filePath: name, content });
    // Reload tree
    const d = await getJSON("/api/vault/tree");
    renderTree(d.roots, document.getElementById("kb-tree")!);
  });

  document.getElementById("kb-delete")!.addEventListener("click", async () => {
    if (!currentFile || currentFile.source === "vault") return;
    if (!confirm(`确认删除 ${currentFile.path}?`)) return;
    await fetch("/api/vault/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: currentFile.path }),
    });
    currentFile = null;
    (document.getElementById("kb-textarea") as HTMLTextAreaElement).value = "";
    document.getElementById("kb-path")!.textContent = "";
    (document.getElementById("kb-save") as HTMLButtonElement).disabled = true;
    (document.getElementById("kb-delete") as HTMLButtonElement).disabled = true;
    const d = await getJSON("/api/vault/tree");
    renderTree(d.roots, document.getElementById("kb-tree")!);
  });
}

function renderTree(roots: any[], container: HTMLElement) {
  container.innerHTML = "";
  for (const root of roots) {
    const node = buildTreeNode(root, 0, root.name);
    container.appendChild(node);
  }
}

function buildTreeNode(node: any, depth: number, source: string): HTMLElement {
  const div = document.createElement("div");
  if (node.type === "directory") {
    const header = document.createElement("div");
    header.className = "tree-item dir";
    header.style.paddingLeft = `${12 + depth * 16}px`;
    header.innerHTML = `<span class="icon">📁</span> ${node.name}`;
    const children = document.createElement("div");
    children.className = "tree-children";
    if (node.children) {
      for (const child of node.children) {
        children.appendChild(buildTreeNode(child, depth + 1, source));
      }
    }
    header.addEventListener("click", () => children.classList.toggle("collapsed"));
    div.appendChild(header);
    div.appendChild(children);
  } else {
    div.className = "tree-item";
    div.style.paddingLeft = `${12 + depth * 16}px`;
    const ext = node.name.split(".").pop() || "";
    const icon = ext === "md" ? "📝" : "📄";
    div.innerHTML = `<span class="icon">${icon}</span> ${node.name}`;
    div.addEventListener("click", async () => {
      document.querySelectorAll(".tree-item").forEach((el) => el.classList.remove("active"));
      div.classList.add("active");
      const src = source.includes("Vault") ? "vault" : "data";
      await openFile(node.path, src);
    });
  }
  return div;
}

async function openFile(path: string, source: string) {
  const data = await getJSON(`/api/vault/read?path=${encodeURIComponent(path)}&source=${source}`);
  const textarea = document.getElementById("kb-textarea") as HTMLTextAreaElement;
  textarea.value = data.content;
  document.getElementById("kb-path")!.textContent = `${source === "vault" ? "Vault" : "Elias Data"} › ${path}`;
  document.getElementById("kb-source")!.textContent = source === "vault" ? "只读 (Obsidian Vault)" : "可编辑 (Elias Data)";
  (document.getElementById("kb-save") as HTMLButtonElement).disabled = source === "vault";
  (document.getElementById("kb-delete") as HTMLButtonElement).disabled = source === "vault";
  textarea.readOnly = source === "vault";
  currentFile = { path, source };
}

let currentFile: { path: string; source: string } | null = null;

// --- Goals Tab ---
async function renderGoals() {
  const main = document.getElementById("main-content")!;
  const data = await getJSON("/api/goals");
  const goals = data.goals || [];

  const activeGoals = goals.filter((g: any) => !g.text.includes("| done:"));
  const doneGoals = goals.filter((g: any) => g.text.includes("| done:"));

  main.innerHTML = `
    <div class="card">
      <div class="card-header">📋 Active Goals</div>
      <div class="card-body" id="active-goals">
        ${activeGoals.length ? activeGoals.map((g: any) => `
          <div class="goal-item">
            <span class="goal-checkbox" data-id="${g.id}" style="cursor:pointer;" title="标记完成">⬜</span>
            <span class="goal-text">${escapeHtml(g.text.replace(/^-\s*\[[^\]]+\]\s*/, ""))}</span>
          </div>
        `).join("") : '<div style="color:var(--text-secondary);">暂无活跃目标</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-header">➕ Add Goal</div>
      <div class="card-body">
        <div style="display:flex;gap:var(--space-sm);">
          <input class="form-input" id="goal-desc" placeholder="目标描述" style="flex:1;">
          <input class="form-input" id="goal-due" placeholder="截止日期（可选）" style="width:200px;">
          <button class="btn btn-primary" id="btn-add-goal">添加</button>
        </div>
      </div>
    </div>
    ${doneGoals.length ? `
    <div class="card">
      <div class="card-header" id="done-header" style="cursor:pointer;">✅ Completed (${doneGoals.length})</div>
      <div class="card-body hidden" id="done-body">
        ${doneGoals.map((g: any) => `<div class="goal-item"><span class="goal-text goal-done">${escapeHtml(g.text.replace(/^-\s*\[[^\]]+\]\s*/, ""))}</span></div>`).join("")}
      </div>
    </div>` : ""}
  `;

  // Event handlers
  document.querySelectorAll(".goal-checkbox").forEach((el) => {
    el.addEventListener("click", async function (this: HTMLElement) {
      const id = this.dataset.id!;
      await fetch(`/api/goals/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "done" }) });
      renderGoals();
    });
  });

  document.getElementById("btn-add-goal")!.addEventListener("click", async () => {
    const desc = (document.getElementById("goal-desc") as HTMLInputElement).value;
    const due = (document.getElementById("goal-due") as HTMLInputElement).value;
    if (!desc) return;
    await postJSON("/api/goals", { action: "add", description: desc, due: due || "" });
    renderGoals();
  });

  const doneHeader = document.getElementById("done-header");
  if (doneHeader) {
    doneHeader.addEventListener("click", () => {
      document.getElementById("done-body")!.classList.toggle("hidden");
    });
  }
}

// --- Settings Tab ---
async function renderSettings() {
  const main = document.getElementById("main-content")!;
  main.innerHTML = '<div class="spinner"></div>';

  // Load all settings data in parallel
  const [dashboard, apiCfg, proactive, groupchat, personas, master, addresses] = await Promise.all([
    getJSON("/api/dashboard").catch(() => null),
    getJSON("/api/settings/api").catch(() => null),
    getJSON("/api/settings/proactive").catch(() => null),
    getJSON("/api/settings/groupchat").catch(() => null),
    getJSON("/api/personas").catch(() => null),
    getJSON("/api/settings/master").catch(() => null),
    getJSON("/api/activity/addresses").catch(() => null),
  ]);

  main.innerHTML = `
    <!-- System Status -->
    <div class="card">
      <div class="card-header">📊 System Status</div>
      <div class="card-body">
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${dashboard ? formatUptime(dashboard.uptime) : "?"}</div><div class="stat-label">运行时间</div></div>
          <div class="stat-card"><div class="stat-value">${dashboard?.memory?.heapMB ?? "?"} MB</div><div class="stat-label">内存</div></div>
          <div class="stat-card"><div class="stat-value">${dashboard?.model ?? "?"}</div><div class="stat-label">模型</div></div>
          <div class="stat-card"><div class="stat-value">${dashboard?.personas ?? "?"}</div><div class="stat-label">人格数</div></div>
        </div>
        <div style="margin-top:var(--space-md);font-size:var(--fs-sm);color:var(--text-secondary);">
          API: ${dashboard?.apiUrl ?? "?"} |
          Master: ${dashboard?.masterId ?? "未设置"} |
          KB: ${dashboard?.kbOk ? "✅" : "❌"} |
          Elias Data: ${dashboard?.eliasDataOk ? "✅" : "❌"}
        </div>
      </div>
    </div>

    <!-- API Config -->
    <div class="card">
      <div class="card-header">🔑 API Config</div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">Model</label><input class="form-input" id="api-model" value="${escapeHtml(apiCfg?.model || "")}"></div>
        <div class="form-group"><label class="form-label">API URL</label><input class="form-input" id="api-url" value="${escapeHtml(apiCfg?.apiUrl || "")}"></div>
        <div class="form-group"><label class="form-label">API Key</label><input class="form-input" id="api-key" value="${escapeHtml(apiCfg?.apiKey || "")}" placeholder="留空不变"></div>
        <button class="btn btn-primary" id="btn-save-api">保存</button>
      </div>
    </div>

    <!-- Proactive -->
    <div class="card">
      <div class="card-header">⏰ Proactive</div>
      <div class="card-body">
        <div style="margin-bottom:var(--space-md);display:flex;gap:var(--space-sm);align-items:center;">
          <span style="font-size:var(--fs-sm);">${proactive?.paused ? `已暂停至 ${proactive.pausedUntil || "?"}` : "运行中"}</span>
          <button class="btn btn-sm" id="btn-pause">暂停</button>
          <button class="btn btn-sm" id="btn-resume">恢复</button>
          <input class="form-input" id="pause-duration" placeholder="30m / 1h" style="width:80px;">
        </div>
        ${(proactive?.personas || []).map((p: any) => `
          <div class="row">
            <span>${escapeHtml(p.displayName)}</span>
            <label class="toggle" data-persona="${p.name}">
              <span class="toggle-track ${p.proactiveEnabled ? 'on' : ''}"><span class="toggle-knob"></span></span>
            </label>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Group Chat -->
    <div class="card">
      <div class="card-header">💬 Group Chat</div>
      <div class="card-body">
        ${(groupchat?.personas || []).map((p: any) => `
          <div class="row">
            <span>${escapeHtml(p.displayName)}</span>
            <label class="toggle" data-gc-persona="${p.name}">
              <span class="toggle-track ${p.inGroupChat ? 'on' : ''}"><span class="toggle-knob"></span></span>
            </label>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Personas -->
    <div class="card">
      <div class="card-header">👤 Personas</div>
      <div class="card-body">
        ${(personas?.personas || []).map((p: any) => `
          <div class="row">
            <div>
              <strong>${escapeHtml(p.displayName)}</strong>
              <span style="color:var(--text-secondary);font-size:var(--fs-sm);"> — ${p.triggers?.join(", ") || "无触发词"} (${p.masterTitle})</span>
            </div>
            <button class="btn btn-sm btn-rename" data-from="${p.name}">重命名</button>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Master -->
    <div class="card">
      <div class="card-header">🛡️ Master</div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">当前 Master ID</label><code>${escapeHtml(master?.masterId || "未设置")}</code></div>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md);">
          <input class="form-input" id="new-master-id" placeholder="新Master的Discord ID" style="flex:1;">
          <button class="btn btn-danger" id="btn-transfer">转让</button>
        </div>
      </div>
    </div>

    <!-- Activity Logs -->
    <div class="card">
      <div class="card-header">📜 Activity Logs</div>
      <div class="card-body">
        <div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-md);">
          <input class="form-input" type="date" id="activity-date" value="${new Date().toLocaleDateString("sv-SE")}" style="width:180px;">
          <button class="btn btn-sm btn-primary" id="btn-load-activity">查看</button>
        </div>
        <pre class="log-output" id="activity-output">选择日期查看活动日志</pre>
      </div>
    </div>

    <!-- Addresses -->
    <div class="card">
      <div class="card-header">📍 Addresses</div>
      <div class="card-body"><pre class="log-output">${escapeHtml(addresses?.content || "无保存的地址。")}</pre></div>
    </div>
  `;

  // --- Event bindings ---
  // API save
  document.getElementById("btn-save-api")!.addEventListener("click", async () => {
    const model = (document.getElementById("api-model") as HTMLInputElement).value;
    const url = (document.getElementById("api-url") as HTMLInputElement).value;
    const key = (document.getElementById("api-key") as HTMLInputElement).value;
    await fetch("/api/settings/api", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, url, key: key || undefined }) });
    alert("API 配置已保存。");
  });

  // Proactive
  document.getElementById("btn-pause")!.addEventListener("click", async () => {
    const dur = (document.getElementById("pause-duration") as HTMLInputElement).value || "30m";
    await postJSON("/api/settings/proactive/pause", { duration: dur });
    renderSettings();
  });
  document.getElementById("btn-resume")!.addEventListener("click", async () => {
    await postJSON("/api/settings/proactive/resume");
    renderSettings();
  });
  document.querySelectorAll(".toggle[data-persona]").forEach((el) => {
    el.addEventListener("click", async function (this: HTMLElement) {
      const persona = this.dataset.persona!;
      const track = this.querySelector(".toggle-track")!;
      const on = !track.classList.contains("on");
      await fetch(`/api/settings/proactive/${persona}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: on }) });
      track.classList.toggle("on", on);
    });
  });

  // Group chat
  document.querySelectorAll(".toggle[data-gc-persona]").forEach((el) => {
    el.addEventListener("click", async function (this: HTMLElement) {
      const persona = this.dataset.gcPersona!;
      const track = this.querySelector(".toggle-track")!;
      const on = !track.classList.contains("on");
      await fetch(`/api/settings/groupchat/${persona}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: on }) });
      track.classList.toggle("on", on);
    });
  });

  // Rename
  document.querySelectorAll(".btn-rename").forEach((btn) => {
    btn.addEventListener("click", async function (this: HTMLElement) {
      const from = this.dataset.from!;
      const to = prompt(`重命名 "${from}" 为:`);
      if (!to) return;
      await postJSON("/api/personas/rename", { from, to });
      renderSettings();
    });
  });

  // Master transfer
  document.getElementById("btn-transfer")!.addEventListener("click", async () => {
    const newId = (document.getElementById("new-master-id") as HTMLInputElement).value;
    if (!newId) return;
    if (!confirm(`确认将 Master 转让给 ${newId}? 此操作不可逆。`)) return;
    await postJSON("/api/settings/master/transfer", { newId });
    alert("Master 已转让。");
    renderSettings();
  });

  // Activity
  document.getElementById("btn-load-activity")!.addEventListener("click", async () => {
    const date = (document.getElementById("activity-date") as HTMLInputElement).value;
    const data = await getJSON(`/api/activity?date=${date}`);
    document.getElementById("activity-output")!.textContent = data.content || "无数据";
  });
}

// --- Style Tab ---
function renderStyle() {
  const main = document.getElementById("main-content")!;
  const currentTheme = localStorage.getItem("elias-theme") || "light";
  const currentAccent = localStorage.getItem("elias-accent") || "#5e6ad2";
  const currentFontSize = localStorage.getItem("elias-font-size") || "medium";
  const currentCardStyle = localStorage.getItem("elias-card-style") || "flat";

  const accents = ["#5e6ad2", "#6366f1", "#3b82f6", "#0891b2", "#7c3aed", "#db2777"];

  main.innerHTML = `
    <div class="card">
      <div class="card-header">🎨 Theme</div>
      <div class="card-body">
        <div class="style-grid" id="theme-grid">
          <div class="theme-card${currentTheme === "light" ? " selected" : ""}" data-theme="light">
            <div class="theme-preview light"></div>Light
          </div>
          <div class="theme-card${currentTheme === "dark" ? " selected" : ""}" data-theme="dark">
            <div class="theme-preview dark"></div>Dark
          </div>
          <div class="theme-card${currentTheme === "blue" ? " selected" : ""}" data-theme="blue">
            <div class="theme-preview blue"></div>Blue
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">🎯 Accent Color</div>
      <div class="card-body">
        <div class="color-swatches" id="accent-swatches">
          ${accents.map((c) => `<div class="color-swatch${currentAccent === c ? " selected" : ""}" data-color="${c}" style="background:${c};"></div>`).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">🔤 Font Size</div>
      <div class="card-body">
        <div class="style-grid">
          ${["small", "medium", "large"].map((s) => `
            <div class="theme-card${currentFontSize === s ? " selected" : ""}" data-font="${s}">
              <div style="font-size:${s === "small" ? "0.85rem" : s === "large" ? "1.2rem" : "1rem"};padding:var(--space-md);">Aa 你好</div>
              ${s === "small" ? "Small" : s === "large" ? "Large" : "Medium"}
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">📋 Card Style</div>
      <div class="card-body">
        <div class="style-grid">
          <div class="theme-card${currentCardStyle === "flat" ? " selected" : ""}" data-card="flat">Flat</div>
          <div class="theme-card${currentCardStyle === "elevated" ? " selected" : ""}" data-card="elevated">Elevated</div>
        </div>
      </div>
    </div>

    <button class="btn" id="btn-reset-style">重置为默认</button>
  `;

  // Event: Theme
  document.querySelectorAll("#theme-grid .theme-card").forEach((card) => {
    card.addEventListener("click", function (this: HTMLElement) {
      const theme = this.dataset.theme!;
      applyTheme(theme);
      document.querySelectorAll("#theme-grid .theme-card").forEach((c) => c.classList.remove("selected"));
      this.classList.add("selected");
    });
  });

  // Accent
  document.querySelectorAll("#accent-swatches .color-swatch").forEach((sw) => {
    sw.addEventListener("click", function (this: HTMLElement) {
      const color = this.dataset.color!;
      applyAccent(color);
      document.querySelectorAll("#accent-swatches .color-swatch").forEach((s) => s.classList.remove("selected"));
      this.classList.add("selected");
    });
  });

  // Font size
  document.querySelectorAll("[data-font]").forEach((el) => {
    el.addEventListener("click", function (this: HTMLElement) {
      const size = this.dataset.font!;
      applyFontSize(size);
      document.querySelectorAll("[data-font]").forEach((e) => e.classList.remove("selected"));
      this.classList.add("selected");
    });
  });

  // Card style
  document.querySelectorAll("[data-card]").forEach((el) => {
    el.addEventListener("click", function (this: HTMLElement) {
      const style = this.dataset.card!;
      applyCardStyle(style);
      document.querySelectorAll("[data-card]").forEach((e) => e.classList.remove("selected"));
      this.classList.add("selected");
    });
  });

  // Reset
  document.getElementById("btn-reset-style")!.addEventListener("click", () => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-light");
    document.documentElement.style.removeProperty("--accent-hover");
    document.documentElement.style.removeProperty("--accent-secondary");
    document.documentElement.style.removeProperty("--fs-sm");
    document.documentElement.style.removeProperty("--fs-base");
    document.documentElement.style.removeProperty("--fs-lg");
    document.documentElement.style.removeProperty("--fs-xl");
    document.querySelectorAll(".card").forEach((c) => c.classList.remove("card-elevated"));
    renderStyle();
  });
}

// --- Theme Engine ---
function loadTheme() {
  const theme = localStorage.getItem("elias-theme");
  if (theme) applyTheme(theme);
  const accent = localStorage.getItem("elias-accent");
  if (accent) applyAccent(accent);
  const fontSize = localStorage.getItem("elias-font-size");
  if (fontSize) applyFontSize(fontSize);
  const cardStyle = localStorage.getItem("elias-card-style");
  if (cardStyle) applyCardStyle(cardStyle);
}

function applyTheme(theme: string) {
  if (theme === "light") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("elias-theme", theme);
}

function applyAccent(color: string) {
  const root = document.documentElement.style;
  root.setProperty("--accent", color);
  root.setProperty("--accent-hover", adjustColor(color, -0.1));
  root.setProperty("--accent-secondary", adjustColor(color, 0.15));
  root.setProperty("--accent-light", color + "20");
  localStorage.setItem("elias-accent", color);
}

function applyFontSize(size: string) {
  const sizes: Record<string, string[]> = {
    small: ["0.8rem", "0.9rem", "1.1rem", "1.3rem"],
    medium: ["0.875rem", "1rem", "1.25rem", "1.5rem"],
    large: ["0.95rem", "1.1rem", "1.4rem", "1.7rem"],
  };
  const [sm, base, lg, xl] = sizes[size] || sizes.medium!;
  const root = document.documentElement.style;
  root.setProperty("--fs-sm", sm!);
  root.setProperty("--fs-base", base!);
  root.setProperty("--fs-lg", lg!);
  root.setProperty("--fs-xl", xl!);
  localStorage.setItem("elias-font-size", size);
}

function applyCardStyle(style: string) {
  const elevated = style === "elevated";
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("card-elevated", elevated));
  localStorage.setItem("elias-card-style", style);
}

// --- Utilities ---
function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(amount * 255)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(amount * 255)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(amount * 255)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
