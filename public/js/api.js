// API client — fetch wrappers

const BASE = "";

function handleAuthError() {
  // Show login page — don't auto-redirect (avoids redirect loop)
  const app = document.getElementById("app-view");
  const login = document.getElementById("login-view");
  if (app) app.classList.add("hidden");
  if (login) login.classList.remove("hidden");
}

export async function getJSON(path: string): Promise<any> {
  const res = await fetch(BASE + path);
  if (res.status === 401) { handleAuthError(); throw new Error("Unauthorized"); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function postJSON(path: string, body?: any): Promise<any> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { handleAuthError(); throw new Error("Unauthorized"); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function putJSON(path: string, body?: any): Promise<any> {
  const res = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { handleAuthError(); throw new Error("Unauthorized"); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteJSON(path: string, body?: any): Promise<any> {
  const res = await fetch(BASE + path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { handleAuthError(); throw new Error("Unauthorized"); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
