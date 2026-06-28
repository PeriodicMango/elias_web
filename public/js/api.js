// API client — fetch wrappers

const BASE = "";

export async function getJSON(path: string): Promise<any> {
  const res = await fetch(BASE + path);
  if (res.status === 401) { window.location.href = "/auth/login"; throw new Error("Unauthorized"); }
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
  if (res.status === 401) { window.location.href = "/auth/login"; throw new Error("Unauthorized"); }
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
  if (res.status === 401) { window.location.href = "/auth/login"; throw new Error("Unauthorized"); }
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
  if (res.status === 401) { window.location.href = "/auth/login"; throw new Error("Unauthorized"); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
