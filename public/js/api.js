const BASE = "";
function handleAuthError() {
  const app = document.getElementById("app-view");
  const login = document.getElementById("login-view");
  if (app) app.classList.add("hidden");
  if (login) login.classList.remove("hidden");
}
async function getJSON(path) {
  const res = await fetch(BASE + path);
  if (res.status === 401) {
    handleAuthError();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}
async function postJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : void 0
  });
  if (res.status === 401) {
    handleAuthError();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
async function putJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : void 0
  });
  if (res.status === 401) {
    handleAuthError();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
async function deleteJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : void 0
  });
  if (res.status === 401) {
    handleAuthError();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
export {
  deleteJSON,
  getJSON,
  postJSON,
  putJSON
};
