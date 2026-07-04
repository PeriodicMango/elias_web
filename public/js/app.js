import { getJSON, postJSON } from "./api.js";
const state = {
  user: null,
  personas: [],
  activePersona: "elias",
  activeTab: "chat",
  chatMessages: []
};
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
});
async function checkAuth() {
  try {
    const user = await getJSON("/api/auth/me");
    state.user = user;
    showApp();
  } catch {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) {
      showError(params.get("error") || "Unknown error");
    } else {
      showLogin();
    }
  }
}
function showLogin() {
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("app-view").classList.add("hidden");
  document.getElementById("error-view").classList.add("hidden");
}
function showError(msg) {
  document.getElementById("error-view").classList.remove("hidden");
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("app-view").classList.add("hidden");
  document.getElementById("error-msg").textContent = msg;
}
async function showApp() {
  document.getElementById("app-view").classList.remove("hidden");
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("error-view").classList.add("hidden");
  document.getElementById("sidebar-username").textContent = state.user.username;
  if (state.user.avatar) {
    document.getElementById("sidebar-avatar").setAttribute(
      "src",
      `https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png?size=64`
    );
  }
  document.getElementById("btn-logout").addEventListener("click", () => {
    window.location.href = "/auth/logout";
  });

  // Sidebar toggle
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle");
  const collapsed = localStorage.getItem("elias-sidebar-collapsed") === "true";
  if (collapsed) sidebar.classList.add("collapsed");
  const doToggle = () => {
    sidebar.classList.toggle("collapsed");
    localStorage.setItem("elias-sidebar-collapsed", String(sidebar.classList.contains("collapsed")));
  };
  toggleBtn.addEventListener("click", doToggle);
  // Click logo area to expand when collapsed
  document.querySelector(".sidebar-logo").addEventListener("click", (e) => {
    if (sidebar.classList.contains("collapsed") && e.target !== toggleBtn) doToggle();
  });

  await loadPersonas();
  renderSidebar();
  loadTheme();
  switchTab("home");
}
async function loadPersonas() {
  try {
    const data = await getJSON("/api/personas");
    state.personas = data.personas;
    // Load avatar URLs for each persona
    for (const p of state.personas) {
      try {
        const full = await getJSON(`/api/personas/${p.name}`);
        p.avatarUrl = full.avatarUrl || "";
      } catch { p.avatarUrl = ""; }
    }
    if (state.personas.length > 0 && !state.personas.find((p) => p.name === state.activePersona)) {
      state.activePersona = state.personas[0].name;
    }
  } catch (e) {
    console.error("Failed to load personas:", e);
  }
}
function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  nav.innerHTML = "";
  const tabs = [
    { id: "home", icon: "\u{1F3E0}", label: "Home" },
    { id: "chat", icon: "\u{1F4AC}", label: "Chat" },
    { id: "personas", icon: "\u{1F465}", label: "Personas" },
    { id: "kb", icon: "\u{1F9E0}", label: "Knowledge Base" },
    { id: "goals", icon: "\u{1F4CB}", label: "Goals" },
    { id: "settings", icon: "\u2699\uFE0F", label: "Settings" },
    { id: "style", icon: "\u{1F3A8}", label: "Style" }
  ];
  for (const tab of tabs) {
    const item = document.createElement("div");
    item.className = `nav-item${state.activeTab === tab.id ? " active" : ""}`;
    item.innerHTML = `<span class="nav-icon">${tab.icon}</span> <span class="nav-label">${tab.label}</span>`;
    item.addEventListener("click", () => switchTab(tab.id));
    nav.appendChild(item);
  }
  const list = document.getElementById("persona-list");
  list.innerHTML = "";
  for (const p of state.personas) {
    const item = document.createElement("div");
    item.className = `persona-item${p.name === state.activePersona ? " active" : ""}`;
    item.innerHTML = `<span class="persona-dot"></span> <span class="persona-label">${p.displayName}</span>`;
    item.addEventListener("click", () => {
      if (state.activePersona !== p.name) state.chatMessages = [];
      state.activePersona = p.name;
      renderSidebar();
      if (state.activeTab === "chat") renderChat();
    });
    list.appendChild(item);
  }
}
async function switchTab(tabId) {
  state.activeTab = tabId;
  renderSidebar();
  const main = document.getElementById("main-content");
  main.innerHTML = '<div class="spinner"></div>';
  try {
    switch (tabId) {
      case "home":
        await renderHomeTab();
        break;
      case "chat":
        await renderChat();
        break;
      case "personas":
        await renderPersonasTab();
        break;
      case "kb":
        await renderKB();
        break;
      case "goals":
        await renderGoals();
        break;
      case "settings":
        await renderSettings();
        break;
      case "style":
        renderStyle();
        break;
    }
  } catch (e) {
    main.innerHTML = `<div class="card"><div class="card-body">\u52A0\u8F7D\u5931\u8D25: ${e.message}</div></div>`;
  }
  document.querySelectorAll(".nav-item").forEach((el) => {
    const text = el.textContent?.trim().toLowerCase() ?? "";
    const navIds = { home: ["home"], chat: ["chat"], personas: ["personas"], kb: ["knowledgebase"], goals: ["goals"], settings: ["settings"], style: ["style"] };
    const matches = navIds[tabId] || [tabId];
    el.classList.toggle("active", matches.some(m => text.includes(m)));
  });
}
async function renderChat() {
  const main = document.getElementById("main-content");
  const p = state.personas.find((x) => x.name === state.activePersona);
  const title = p?.displayName || state.activePersona;
  main.innerHTML = `
    <div class="chat-container">
      <div class="card" style="flex:1;display:flex;flex-direction:column;">
        <div class="card-header">
          \u{1F4AC} ${title}
          <div style="display:flex;gap:8px;">
            <label class="toggle" title="Fast mode (skip deep thinking)">
              <span style="font-size:var(--fs-sm);">Quick</span>
              <span class="toggle-track" id="fast-toggle"></span>
            </label>
            <button class="btn btn-sm" id="btn-clear-history">Clear</button>
          </div>
        </div>
        <div class="chat-messages" id="chat-msgs">
          <div class="chat-empty">\u9009\u62E9\u4E00\u4E2A\u4EBA\u683C\uFF0C\u5F00\u59CB\u5BF9\u8BDD</div>
        </div>
        <div class="chat-input-area" style="padding:var(--space-md);">
          <input class="form-input" id="chat-input" placeholder="\u8F93\u5165\u6D88\u606F..." autofocus>
          <button class="btn btn-primary" id="btn-send">\u53D1\u9001</button>
        </div>
      </div>
    </div>
  `;
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("btn-send");
  const msgs = document.getElementById("chat-msgs");
  let fastMode = false;
  const fastTrack = document.getElementById("fast-toggle");
  fastTrack.addEventListener("click", () => {
    fastMode = !fastMode;
    fastTrack.classList.toggle("on", fastMode);
  });
  document.getElementById("btn-clear-history").addEventListener("click", async () => {
    await postJSON("/api/chat/clear");
    state.chatMessages = [];
    msgs.innerHTML = '<div class="chat-empty">\u5386\u53F2\u5DF2\u6E05\u9664</div>';
  });
  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.disabled = true;
    btn.disabled = true;
    addMsg("user", text);
    const loadingEl = addMsg("assistant", '<span class="spinner"></span>', true);
    try {
      const data = await postJSON("/api/chat", {
        persona: state.activePersona,
        message: text,
        fastMode
      });
      let msgHTML = escapeHtml(data.reply);
      if (data.thinking && data.thinking.trim()) {
        const thinkingId = "thinking-" + Date.now();
        msgHTML += '<div class="thinking-toggle" onclick="var t=document.getElementById(\'' + thinkingId + '\');t.classList.toggle(\'hidden\');this.classList.toggle(\'open\');"><span class="thinking-arrow">\u25B6</span> Thinking</div><pre class="thinking-content hidden" id="' + thinkingId + '">' + escapeHtml(data.thinking.trim()) + "</pre>";
      }
      loadingEl.querySelector(".msg-content").innerHTML = msgHTML;
      if (data.mood && data.mood !== "\u5E73\u9759") {
        const meta = loadingEl.querySelector(".msg-meta");
        meta.innerHTML += ` <span class="msg-mood">${escapeHtml(data.mood)}</span>`;
      }
      loadingEl.classList.remove("loading");
    } catch (e) {
      loadingEl.querySelector(".msg-content").innerHTML = `\u274C ${escapeHtml(e.message)}`;
      loadingEl.classList.remove("loading");
    }
    input.disabled = false;
    btn.disabled = false;
    input.focus();
    msgs.scrollTop = msgs.scrollHeight;
  }
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  btn.addEventListener("click", send);
  msgContainer = msgs;

  // Check for pending message from homepage chatbox
  const pending = sessionStorage.getItem("elias-pending-message");
  if (pending) {
    sessionStorage.removeItem("elias-pending-message");
    input.value = pending;
    send();
  }
  // Restore messages from state
  for (const m of state.chatMessages) {
    const restored = addMsg(m.role, m.content, false);
    if (m.loading) restored.classList.add("loading");
  }
}
let msgContainer = null;
let msgCounter = 0;
function addMsg(role, content, loading = false) {
  if (!msgContainer) throw new Error("Chat not rendered");
  const empty = msgContainer.querySelector(".chat-empty");
  if (empty) empty.remove();
  const el = document.createElement("div");
  el.className = `msg ${role}${loading ? " loading" : ""}`;
  const persona = state.personas.find((p) => p.name === state.activePersona);
  const avatarLetter = role === "user" ? state.user?.username?.[0] || "U" : persona?.displayName?.[0] || "E";
  const avatarUrl = role === "user" ? (state.user?.avatar ? `https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png?size=64` : "") : (persona?.avatarUrl || "");
  const avatarHTML = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='<span>${escapeHtml(avatarLetter)}</span>';" alt="">` : escapeHtml(avatarLetter);
  el.innerHTML = `
    <div class="msg-avatar">${avatarHTML}</div>
    <div class="msg-bubble">
      <div class="msg-meta">${role === "user" ? "\u4F60" : persona?.displayName || "Elias"}</div>
      <div class="msg-content">${content}</div>
    </div>
  `;
  msgContainer.appendChild(el);
  msgContainer.scrollTop = msgContainer.scrollHeight;
  // Save to state for persistence across tab switches
  state.chatMessages.push({ role, content, loading, el: null });
  return el;
}
// --- Home Tab ---
async function renderHomeTab() {
  const { renderHome } = await import("/js/home.js");
  await renderHome(state.activePersona);

  // Listen for chatbox submit → switch to chat tab
  window.addEventListener("elias-home-chat", () => {
    switchTab("chat");
  });
}

// --- Personas Tab ---
async function renderPersonasTab() {
  const main = document.getElementById("main-content");
  const data = await getJSON("/api/personas");
  const personas = data.personas || [];

  // Load full details for each persona
  const details = await Promise.all(
    personas.map((p) => getJSON(`/api/personas/${p.name}`).catch(() => null))
  );

  let html = "";
  for (const d of details) {
    if (!d) continue;
    html += `
      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:var(--space-md);">
            ${d.avatarUrl ? `<img src="${escapeHtml(d.avatarUrl)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'" alt="">` : '<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:var(--fs-lg);">' + escapeHtml(d.displayName[0] || "?") + '</div>'}
            <div>
              <strong style="font-size:var(--fs-lg);">${escapeHtml(d.displayName)}</strong>
              <div style="font-size:var(--fs-sm);color:var(--text-secondary);">${escapeHtml(d.name)} — 触发词: ${escapeHtml(d.triggers?.join(", ") || "无")}</div>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">头像</label>
            <div style="display:flex;gap:var(--space-sm);align-items:center;">
              <input class="form-input" value="${escapeHtml(d.avatarUrl || "")}" placeholder="URL 或上传图片" data-pname="${escapeHtml(d.name)}" data-field="avatarUrl" style="flex:1;">
              <input type="file" accept="image/*" data-pname="${escapeHtml(d.name)}" data-field="avatarFile" style="display:none;">
              <button class="btn btn-sm" data-pname="${escapeHtml(d.name)}" data-action="upload-avatar">上传</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">称呼我为</label>
            <input class="form-input" value="${escapeHtml(d.masterTitle || "")}" placeholder="指挥官" data-pname="${escapeHtml(d.name)}" data-field="masterTitle">
            <span style="font-size:var(--fs-sm);color:var(--text-secondary);">修改后需在下方文件内容中同步更新 YAML frontmatter 的 master_title</span>
          </div>
          <div class="form-group">
            <label class="form-label">显示名称</label>
            <input class="form-input" value="${escapeHtml(d.displayName || "")}" placeholder="Display Name" data-pname="${escapeHtml(d.name)}" data-field="displayName">
            <span style="font-size:var(--fs-sm);color:var(--text-secondary);">修改后需在下方文件内容中同步更新 YAML frontmatter 的 display_name</span>
          </div>
          <div class="form-group">
            <label class="form-label">人格文件 (personas/${escapeHtml(d.name)}.md)</label>
            <textarea class="form-textarea" style="min-height:300px;" data-pname="${escapeHtml(d.name)}" data-field="fileContent">${escapeHtml(d.fileContent || "")}</textarea>
          </div>
          <button class="btn btn-primary" data-pname="${escapeHtml(d.name)}" data-action="save-persona">保存 ${escapeHtml(d.displayName)}</button>
        </div>
      </div>`;
  }

  main.innerHTML = html;

  // Upload button handlers
  main.querySelectorAll("[data-action='upload-avatar']").forEach((btn) => {
    btn.addEventListener("click", function () {
      const pname = this.dataset.pname;
      const card = this.closest(".card");
      const fileInput = card.querySelector("[data-field='avatarFile']");
      fileInput.click();
      fileInput.addEventListener("change", function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          card.querySelector("[data-field='avatarUrl']").value = e.target.result;
          // Update preview
          const img = card.querySelector(".card-header img");
          if (img) img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    });
  });

  // Save button handlers
  main.querySelectorAll("[data-action='save-persona']").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const pname = this.dataset.pname;
      const card = this.closest(".card");
      const fileContent = card.querySelector("[data-field='fileContent']").value;
      const avatarUrl = card.querySelector("[data-field='avatarUrl']").value;

      // For masterTitle and displayName, update the YAML in fileContent
      let updatedContent = fileContent;
      const masterTitle = card.querySelector("[data-field='masterTitle']").value;
      const displayName = card.querySelector("[data-field='displayName']").value;

      // Update master_title in YAML frontmatter
      updatedContent = updatedContent.replace(/master_title:\s*.*/g, `master_title: ${masterTitle}`);
      if (!updatedContent.includes("master_title:")) {
        updatedContent = updatedContent.replace(/---\n/, `---\nmaster_title: ${masterTitle}\n`);
      }

      // Update display_name in YAML frontmatter
      updatedContent = updatedContent.replace(/display_name:\s*.*/g, `display_name: ${displayName}`);
      if (!updatedContent.includes("display_name:")) {
        updatedContent = updatedContent.replace(/---\n/, `---\ndisplay_name: ${displayName}\n`);
      }

      const avatarValue = card.querySelector("[data-field='avatarUrl']").value;
      const isBase64 = avatarValue.startsWith("data:image");
      const body = isBase64
        ? JSON.stringify({ fileContent: updatedContent, avatarData: avatarValue })
        : JSON.stringify({ fileContent: updatedContent, avatarUrl: avatarValue });

      try {
        await fetch(`/api/personas/${pname}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        });
        alert("已保存！刷新页面后生效。");
      } catch (e) {
        alert("保存失败: " + (e.message || e));
      }
    });
  });
}

async function renderKB() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="card"><div class="card-header">\u{1F9E0} Knowledge Base</div>
      <div class="card-body kb-layout">
        <div class="kb-tree" id="kb-tree"><div class="spinner"></div></div>
        <div class="kb-editor">
          <div class="kb-breadcrumb" id="kb-path"></div>
          <textarea class="form-textarea" id="kb-textarea" placeholder="\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6..." readonly></textarea>
          <div class="kb-actions">
            <button class="btn btn-primary" id="kb-save" disabled>\u4FDD\u5B58</button>
            <button class="btn" id="kb-new">\u65B0\u5EFA\u6587\u4EF6</button>
            <button class="btn btn-danger btn-sm" id="kb-delete" disabled>\u5220\u9664</button>
            <span style="margin-left:auto;font-size:var(--fs-sm);color:var(--text-secondary);" id="kb-source"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  kbCurrentFile = null;
  const data = await getJSON("/api/vault/tree");
  renderTree(data.roots, document.getElementById("kb-tree"));
  document.getElementById("kb-save").addEventListener("click", async () => {
    if (!kbCurrentFile || kbCurrentFile.source === "vault") return;
    const content = document.getElementById("kb-textarea").value;
    await postJSON("/api/vault/write", { filePath: kbCurrentFile.path, content });
    alert("\u5DF2\u4FDD\u5B58\u3002");
  });
  document.getElementById("kb-new").addEventListener("click", async () => {
    const name = prompt("\u6587\u4EF6\u540D\uFF08\u5982 notes/\u5907\u5FD8\u5F55.md\uFF09:");
    if (!name) return;
    const content = prompt("\u5185\u5BB9\uFF08\u53EF\u9009\uFF09:") || "";
    await postJSON("/api/vault/write", { filePath: name, content });
    const d = await getJSON("/api/vault/tree");
    renderTree(d.roots, document.getElementById("kb-tree"));
  });
  document.getElementById("kb-delete").addEventListener("click", async () => {
    if (!kbCurrentFile || kbCurrentFile.source === "vault") return;
    if (!confirm(`\u786E\u8BA4\u5220\u9664 ${kbCurrentFile.path}?`)) return;
    await fetch("/api/vault/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: kbCurrentFile.path })
    });
    kbCurrentFile = null;
    document.getElementById("kb-textarea").value = "";
    document.getElementById("kb-path").textContent = "";
    document.getElementById("kb-save").disabled = true;
    document.getElementById("kb-delete").disabled = true;
    const d = await getJSON("/api/vault/tree");
    renderTree(d.roots, document.getElementById("kb-tree"));
  });
}
function renderTree(roots, container) {
  container.innerHTML = "";
  for (const root of roots) {
    const node = buildTreeNode(root, 0, root.name);
    container.appendChild(node);
  }
}
function buildTreeNode(node, depth, source) {
  const div = document.createElement("div");
  if (node.type === "directory") {
    const header = document.createElement("div");
    header.className = "tree-item dir";
    header.style.paddingLeft = `${12 + depth * 16}px`;
    header.innerHTML = `<span class="icon">\u{1F4C1}</span> ${node.name}`;
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
    const icon = ext === "md" ? "\u{1F4DD}" : "\u{1F4C4}";
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
async function openFile(path, source) {
  try {
    const data = await getJSON(`/api/vault/read?path=${encodeURIComponent(path)}&source=${source}`);
    const textarea = document.getElementById("kb-textarea");
    if (!textarea) { console.error("kb-textarea not found"); return; }
    textarea.value = data.content || "";
    document.getElementById("kb-path").textContent = `${source === "vault" ? "Vault" : "Elias Data"} \u203A ${path}`;
    document.getElementById("kb-source").textContent = source === "vault" ? "\u53EA\u8BFB (Obsidian Vault)" : "\u53EF\u7F16\u8F91 (Elias Data)";
    document.getElementById("kb-save").disabled = source === "vault";
    document.getElementById("kb-delete").disabled = source === "vault";
    textarea.readOnly = source === "vault";
    kbCurrentFile = { path, source };
  } catch (e) {
    alert("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25: " + (e.message || e));
    console.error("openFile error:", e);
  }
}
let kbCurrentFile = null;
async function renderGoals() {
  const main = document.getElementById("main-content");
  const data = await getJSON("/api/goals");
  const goals = data.goals || [];
  const activeGoals = goals.filter((g) => !g.text.includes("| done:"));
  const doneGoals = goals.filter((g) => g.text.includes("| done:"));
  main.innerHTML = `
    <div class="card">
      <div class="card-header">\u{1F4CB} Active Goals</div>
      <div class="card-body" id="active-goals">
        ${activeGoals.length ? activeGoals.map((g) => `
          <div class="goal-item">
            <span class="goal-checkbox" data-id="${g.id}" style="cursor:pointer;" title="\u6807\u8BB0\u5B8C\u6210">\u2B1C</span>
            <span class="goal-text">${escapeHtml(g.text.replace(/^-\s*\[[^\]]+\]\s*/, ""))}</span>
          </div>
        `).join("") : '<div style="color:var(--text-secondary);">\u6682\u65E0\u6D3B\u8DC3\u76EE\u6807</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-header">\u2795 Add Goal</div>
      <div class="card-body">
        <div style="display:flex;gap:var(--space-sm);">
          <input class="form-input" id="goal-desc" placeholder="\u76EE\u6807\u63CF\u8FF0" style="flex:1;">
          <input class="form-input" id="goal-due" placeholder="\u622A\u6B62\u65E5\u671F\uFF08\u53EF\u9009\uFF09" style="width:200px;">
          <button class="btn btn-primary" id="btn-add-goal">\u6DFB\u52A0</button>
        </div>
      </div>
    </div>
    ${doneGoals.length ? `
    <div class="card">
      <div class="card-header" id="done-header" style="cursor:pointer;">\u2705 Completed (${doneGoals.length})</div>
      <div class="card-body hidden" id="done-body">
        ${doneGoals.map((g) => `<div class="goal-item"><span class="goal-text goal-done">${escapeHtml(g.text.replace(/^-\s*\[[^\]]+\]\s*/, ""))}</span></div>`).join("")}
      </div>
    </div>` : ""}
  `;
  document.querySelectorAll(".goal-checkbox").forEach((el) => {
    el.addEventListener("click", async function() {
      const id = this.dataset.id;
      await fetch(`/api/goals/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "done" }) });
      renderGoals();
    });
  });
  document.getElementById("btn-add-goal").addEventListener("click", async () => {
    const desc = document.getElementById("goal-desc").value;
    const due = document.getElementById("goal-due").value;
    if (!desc) return;
    await postJSON("/api/goals", { action: "add", description: desc, due: due || "" });
    renderGoals();
  });
  const doneHeader = document.getElementById("done-header");
  if (doneHeader) {
    doneHeader.addEventListener("click", () => {
      document.getElementById("done-body").classList.toggle("hidden");
    });
  }
}
async function renderSettings() {
  const main = document.getElementById("main-content");
  main.innerHTML = '<div class="spinner"></div>';
  const [dashboard, apiCfg, proactive, groupchat, personas, master, addresses] = await Promise.all([
    getJSON("/api/dashboard").catch(() => null),
    getJSON("/api/settings/api").catch(() => null),
    getJSON("/api/settings/proactive").catch(() => null),
    getJSON("/api/settings/groupchat").catch(() => null),
    getJSON("/api/personas").catch(() => null),
    getJSON("/api/settings/master").catch(() => null),
    getJSON("/api/activity/addresses").catch(() => null)
  ]);
  main.innerHTML = `
    <!-- System Status -->
    <div class="card">
      <div class="card-header">\u{1F4CA} System Status</div>
      <div class="card-body">
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${dashboard ? formatUptime(dashboard.uptime) : "?"}</div><div class="stat-label">\u8FD0\u884C\u65F6\u95F4</div></div>
          <div class="stat-card"><div class="stat-value">${dashboard?.memory?.heapMB ?? "?"} MB</div><div class="stat-label">\u5185\u5B58</div></div>
          <div class="stat-card"><div class="stat-value">${dashboard?.model ?? "?"}</div><div class="stat-label">\u6A21\u578B</div></div>
          <div class="stat-card"><div class="stat-value">${dashboard?.personas ?? "?"}</div><div class="stat-label">\u4EBA\u683C\u6570</div></div>
        </div>
        <div style="margin-top:var(--space-md);font-size:var(--fs-sm);color:var(--text-secondary);">
          API: ${dashboard?.apiUrl ?? "?"} |
          Master: ${dashboard?.masterId ?? "\u672A\u8BBE\u7F6E"} |
          KB: ${dashboard?.kbOk ? "\u2705" : "\u274C"} |
          Elias Data: ${dashboard?.eliasDataOk ? "\u2705" : "\u274C"}
        </div>
      </div>
    </div>

    <!-- API Config -->
    <div class="card">
      <div class="card-header">\u{1F511} API Config</div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">Model</label><input class="form-input" id="api-model" value="${escapeHtml(apiCfg?.model || "")}"></div>
        <div class="form-group"><label class="form-label">API URL</label><input class="form-input" id="api-url" value="${escapeHtml(apiCfg?.apiUrl || "")}"></div>
        <div class="form-group"><label class="form-label">API Key</label><input class="form-input" id="api-key" value="${escapeHtml(apiCfg?.apiKey || "")}" placeholder="\u7559\u7A7A\u4E0D\u53D8"></div>
        <button class="btn btn-primary" id="btn-save-api">\u4FDD\u5B58</button>
      </div>
    </div>

    <!-- Proactive -->
    <div class="card">
      <div class="card-header">\u23F0 Proactive</div>
      <div class="card-body">
        <div style="margin-bottom:var(--space-md);display:flex;gap:var(--space-sm);align-items:center;">
          <span style="font-size:var(--fs-sm);">${proactive?.paused ? `\u5DF2\u6682\u505C\u81F3 ${proactive.pausedUntil || "?"}` : "\u8FD0\u884C\u4E2D"}</span>
          <button class="btn btn-sm" id="btn-pause">\u6682\u505C</button>
          <button class="btn btn-sm" id="btn-resume">\u6062\u590D</button>
          <input class="form-input" id="pause-duration" placeholder="30m / 1h" style="width:80px;">
        </div>
        ${(proactive?.personas || []).map((p) => `
          <div class="row">
            <span>${escapeHtml(p.displayName)}</span>
            <label class="toggle" data-persona="${p.name}">
              <span class="toggle-track ${p.proactiveEnabled ? "on" : ""}"><span class="toggle-knob"></span></span>
            </label>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Group Chat -->
    <div class="card">
      <div class="card-header">\u{1F4AC} Group Chat</div>
      <div class="card-body">
        ${(groupchat?.personas || []).map((p) => `
          <div class="row">
            <span>${escapeHtml(p.displayName)}</span>
            <label class="toggle" data-gc-persona="${p.name}">
              <span class="toggle-track ${p.inGroupChat ? "on" : ""}"><span class="toggle-knob"></span></span>
            </label>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Personas -->
    <div class="card">
      <div class="card-header">\u{1F464} Personas</div>
      <div class="card-body">
        ${(personas?.personas || []).map((p) => `
          <div class="row">
            <div>
              <strong>${escapeHtml(p.displayName)}</strong>
              <span style="color:var(--text-secondary);font-size:var(--fs-sm);"> \u2014 ${p.triggers?.join(", ") || "\u65E0\u89E6\u53D1\u8BCD"} (${p.masterTitle})</span>
            </div>
            <button class="btn btn-sm btn-rename" data-from="${p.name}">\u91CD\u547D\u540D</button>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Master -->
    <div class="card">
      <div class="card-header">\u{1F6E1}\uFE0F Master</div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">\u5F53\u524D Master ID</label><code>${escapeHtml(master?.masterId || "\u672A\u8BBE\u7F6E")}</code></div>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md);">
          <input class="form-input" id="new-master-id" placeholder="\u65B0Master\u7684Discord ID" style="flex:1;">
          <button class="btn btn-danger" id="btn-transfer">\u8F6C\u8BA9</button>
        </div>
      </div>
    </div>

    <!-- Activity Logs -->
    <div class="card">
      <div class="card-header">\u{1F4DC} Activity Logs</div>
      <div class="card-body">
        <div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-md);">
          <input class="form-input" type="date" id="activity-date" value="${(/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE")}" style="width:180px;">
          <button class="btn btn-sm btn-primary" id="btn-load-activity">\u67E5\u770B</button>
        </div>
        <pre class="log-output" id="activity-output">\u9009\u62E9\u65E5\u671F\u67E5\u770B\u6D3B\u52A8\u65E5\u5FD7</pre>
      </div>
    </div>

    <!-- Addresses -->
    <div class="card">
      <div class="card-header">\u{1F4CD} Addresses</div>
      <div class="card-body"><pre class="log-output">${escapeHtml(addresses?.content || "\u65E0\u4FDD\u5B58\u7684\u5730\u5740\u3002")}</pre></div>
    </div>
  `;
  document.getElementById("btn-save-api").addEventListener("click", async () => {
    const model = document.getElementById("api-model").value;
    const url = document.getElementById("api-url").value;
    const key = document.getElementById("api-key").value;
    await fetch("/api/settings/api", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, url, key: key || void 0 }) });
    alert("API \u914D\u7F6E\u5DF2\u4FDD\u5B58\u3002");
  });
  document.getElementById("btn-pause").addEventListener("click", async () => {
    const dur = document.getElementById("pause-duration").value || "30m";
    await postJSON("/api/settings/proactive/pause", { duration: dur });
    renderSettings();
  });
  document.getElementById("btn-resume").addEventListener("click", async () => {
    await postJSON("/api/settings/proactive/resume");
    renderSettings();
  });
  document.querySelectorAll(".toggle[data-persona]").forEach((el) => {
    el.addEventListener("click", async function() {
      const persona = this.dataset.persona;
      const track = this.querySelector(".toggle-track");
      const on = !track.classList.contains("on");
      await fetch(`/api/settings/proactive/${persona}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: on }) });
      track.classList.toggle("on", on);
    });
  });
  document.querySelectorAll(".toggle[data-gc-persona]").forEach((el) => {
    el.addEventListener("click", async function() {
      const persona = this.dataset.gcPersona;
      const track = this.querySelector(".toggle-track");
      const on = !track.classList.contains("on");
      await fetch(`/api/settings/groupchat/${persona}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: on }) });
      track.classList.toggle("on", on);
    });
  });
  document.querySelectorAll(".btn-rename").forEach((btn) => {
    btn.addEventListener("click", async function() {
      const from = this.dataset.from;
      const to = prompt(`\u91CD\u547D\u540D "${from}" \u4E3A:`);
      if (!to) return;
      await postJSON("/api/personas/rename", { from, to });
      renderSettings();
    });
  });
  document.getElementById("btn-transfer").addEventListener("click", async () => {
    const newId = document.getElementById("new-master-id").value;
    if (!newId) return;
    if (!confirm(`\u786E\u8BA4\u5C06 Master \u8F6C\u8BA9\u7ED9 ${newId}? \u6B64\u64CD\u4F5C\u4E0D\u53EF\u9006\u3002`)) return;
    await postJSON("/api/settings/master/transfer", { newId });
    alert("Master \u5DF2\u8F6C\u8BA9\u3002");
    renderSettings();
  });
  document.getElementById("btn-load-activity").addEventListener("click", async () => {
    const date = document.getElementById("activity-date").value;
    const data = await getJSON(`/api/activity?date=${date}`);
    document.getElementById("activity-output").textContent = data.content || "\u65E0\u6570\u636E";
  });
}
function renderStyle() {
  const main = document.getElementById("main-content");
  const currentTheme = localStorage.getItem("elias-theme") || "light";
  const currentAccent = localStorage.getItem("elias-accent") || "#3b82f6";
  const currentFontSize = localStorage.getItem("elias-font-size") || "medium";
  const currentCardStyle = localStorage.getItem("elias-card-style") || "flat";
  const accents = ["#3b82f6", "#2563eb", "#0891b2", "#0ea5e9", "#6366f1", "#8b5cf6"];
  main.innerHTML = `
    <div class="card">
      <div class="card-header">\u{1F3A8} Theme</div>
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
      <div class="card-header">\u{1F3AF} Accent Color</div>
      <div class="card-body">
        <div class="color-swatches" id="accent-swatches">
          ${accents.map((c) => `<div class="color-swatch${currentAccent === c ? " selected" : ""}" data-color="${c}" style="background:${c};"></div>`).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">\u{1F524} Font Size</div>
      <div class="card-body">
        <div class="style-grid">
          ${["small", "medium", "large"].map((s) => `
            <div class="theme-card${currentFontSize === s ? " selected" : ""}" data-font="${s}">
              <div style="font-size:${s === "small" ? "0.85rem" : s === "large" ? "1.2rem" : "1rem"};padding:var(--space-md);">Aa \u4F60\u597D</div>
              ${s === "small" ? "Small" : s === "large" ? "Large" : "Medium"}
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">\u{1F4CB} Card Style</div>
      <div class="card-body">
        <div class="style-grid">
          <div class="theme-card${currentCardStyle === "flat" ? " selected" : ""}" data-card="flat">Flat</div>
          <div class="theme-card${currentCardStyle === "elevated" ? " selected" : ""}" data-card="elevated">Elevated</div>
        </div>
      </div>
    </div>

    <button class="btn" id="btn-reset-style">\u91CD\u7F6E\u4E3A\u9ED8\u8BA4</button>
  `;
  document.querySelectorAll("#theme-grid .theme-card").forEach((card) => {
    card.addEventListener("click", function() {
      const theme = this.dataset.theme;
      applyTheme(theme);
      document.querySelectorAll("#theme-grid .theme-card").forEach((c) => c.classList.remove("selected"));
      this.classList.add("selected");
    });
  });
  document.querySelectorAll("#accent-swatches .color-swatch").forEach((sw) => {
    sw.addEventListener("click", function() {
      const color = this.dataset.color;
      applyAccent(color);
      document.querySelectorAll("#accent-swatches .color-swatch").forEach((s) => s.classList.remove("selected"));
      this.classList.add("selected");
    });
  });
  document.querySelectorAll("[data-font]").forEach((el) => {
    el.addEventListener("click", function() {
      const size = this.dataset.font;
      applyFontSize(size);
      document.querySelectorAll("[data-font]").forEach((e) => e.classList.remove("selected"));
      this.classList.add("selected");
    });
  });
  document.querySelectorAll("[data-card]").forEach((el) => {
    el.addEventListener("click", function() {
      const style = this.dataset.card;
      applyCardStyle(style);
      document.querySelectorAll("[data-card]").forEach((e) => e.classList.remove("selected"));
      this.classList.add("selected");
    });
  });
  document.getElementById("btn-reset-style").addEventListener("click", () => {
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
function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("elias-theme", theme);
}
function applyAccent(color) {
  const root = document.documentElement.style;
  root.setProperty("--accent", color);
  root.setProperty("--accent-hover", adjustColor(color, -0.1));
  root.setProperty("--accent-secondary", adjustColor(color, 0.15));
  root.setProperty("--accent-light", color + "20");
  localStorage.setItem("elias-accent", color);
}
function applyFontSize(size) {
  const sizes = {
    small: ["0.8rem", "0.9rem", "1.1rem", "1.3rem"],
    medium: ["0.875rem", "1rem", "1.25rem", "1.5rem"],
    large: ["0.95rem", "1.1rem", "1.4rem", "1.7rem"]
  };
  const [sm, base, lg, xl] = sizes[size] || sizes.medium;
  const root = document.documentElement.style;
  root.setProperty("--fs-sm", sm);
  root.setProperty("--fs-base", base);
  root.setProperty("--fs-lg", lg);
  root.setProperty("--fs-xl", xl);
  localStorage.setItem("elias-font-size", size);
}
function applyCardStyle(style) {
  const elevated = style === "elevated";
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("card-elevated", elevated));
  localStorage.setItem("elias-card-style", style);
}
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor(seconds % 86400 / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16 & 255) + Math.round(amount * 255)));
  const g = Math.min(255, Math.max(0, (num >> 8 & 255) + Math.round(amount * 255)));
  const b = Math.min(255, Math.max(0, (num & 255) + Math.round(amount * 255)));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}
