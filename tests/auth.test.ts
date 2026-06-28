/**
 * Auth flow tests — run against a local or remote server.
 *
 * Usage:  npx tsx tests/auth.test.ts [base-url]
 * Default: http://localhost:3457
 */

const BASE = process.argv[2] || "http://localhost:3457";

function log(label: string, ok: boolean, detail = "") {
  const mark = ok ? "✅" : "❌";
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`Testing: ${BASE}\n`);

  let passed = 0;
  let failed = 0;

  function check(label: string, ok: boolean, detail = "") {
    log(label, ok, detail);
    if (ok) passed++;
    else failed++;
  }

  // ---- 1. Static frontend ----
  console.log("=== Static ===");
  {
    const res = await fetch(`${BASE}/`);
    check("GET / returns HTML", res.status === 200 && (await res.text()).includes("<!DOCTYPE"));
  }
  {
    const res = await fetch(`${BASE}/css/main.css`);
    check("GET /css/main.css", res.status === 200);
  }
  {
    const res = await fetch(`${BASE}/js/app.js`);
    check("GET /js/app.js", res.status === 200);
  }
  {
    const res = await fetch(`${BASE}/js/api.js`);
    check("GET /js/api.js", res.status === 200);
  }

  // ---- 2. Auth endpoints ----
  console.log("\n=== Auth ===");
  {
    const res = await fetch(`${BASE}/auth/login`, { redirect: "manual" });
    check("GET /auth/login → 302", res.status === 302);
    const loc = res.headers.get("location") || "";
    check("  redirects to Discord", loc.includes("discord.com/api/oauth2/authorize"));
    check("  includes client_id", loc.includes("client_id="));
    check("  includes redirect_uri", loc.includes("redirect_uri="));
    check("  includes scope=identify", loc.includes("scope=identify"));
    check("  includes response_type=code", loc.includes("response_type=code"));
  }
  {
    const res = await fetch(`${BASE}/auth/callback`);
    const text = await res.text();
    check("GET /auth/callback (no code) → error", text.includes("No code") || text.includes("Missing"));
  }
  {
    const res = await fetch(`${BASE}/auth/logout`, { redirect: "manual" });
    check("GET /auth/logout → redirect", res.status === 302);
  }

  // ---- 3. API requires auth ----
  console.log("\n=== Auth Required ===");
  {
    const res = await fetch(`${BASE}/api/auth/me`);
    check("GET /api/auth/me → 401 (no session)", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "elias", message: "hi" }),
    });
    check("POST /api/chat → 401 (no session)", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/dashboard`);
    check("GET /api/dashboard → 401", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/personas`);
    check("GET /api/personas → 401", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/vault/tree`);
    check("GET /api/vault/tree → 401", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/goals`);
    check("GET /api/goals → 401", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/settings/api`);
    check("GET /api/settings/api → 401", res.status === 401);
  }
  {
    const res = await fetch(`${BASE}/api/settings/proactive`);
    check("GET /api/settings/proactive → 401", res.status === 401);
  }

  // ---- 4. SPA fallback ----
  console.log("\n=== SPA Fallback ===");
  {
    const res = await fetch(`${BASE}/any-random-path`);
    const text = await res.text();
    check("GET /random-path → index.html", text.includes("<!DOCTYPE") && text.includes("Elias Console"));
  }

  // ---- Summary ----
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
