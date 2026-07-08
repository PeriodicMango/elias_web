import { Router } from "express";
import { createLoader } from "../lazyLoad.js";
import crypto from "node:crypto";

const router = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? "http://localhost:3457/auth/callback";
const TAILSCALE_URL = process.env.TAILSCALE_URL ?? "";

const authLoader = createLoader(() => import("../../../../eliasCore/src/helpers/auth.js"));

// ---------------------------------------------------------------------------
// API tokens — JWT-like tokens for cross-origin auth (Capacitor, PWA)
// ---------------------------------------------------------------------------
const apiTokens = new Map<string, { user: { id: string; username: string; avatar: string }; expires: number }>();

// Clean expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of apiTokens) {
    if (entry.expires < now) apiTokens.delete(token);
  }
}, 300_000).unref();

/**
 * Verify a Bearer token from the Authorization header.
 * Returns user data or null.
 */
export function verifyApiToken(token: string): { id: string; username: string; avatar: string } | null {
  const entry = apiTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    if (entry) apiTokens.delete(token);
    return null;
  }
  return entry.user;
}

// POST /api/auth/token — generate an API token for the current session
router.post("/token", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  apiTokens.set(token, {
    user: { ...req.session.user },
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.json({ token });
});

// ---------------------------------------------------------------------------
// Session handoff — transfers login from HTTP IP to HTTPS Tailscale domain
// ---------------------------------------------------------------------------
const handoffTokens = new Map<string, { user: { id: string; username: string; avatar: string }; expires: number }>();

// Clean expired tokens every 60s
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of handoffTokens) {
    if (entry.expires < now) handoffTokens.delete(token);
  }
}, 60_000).unref();

// GET /auth/handoff?token=... — receive session from OAuth callback handoff
router.get("/handoff", (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) return res.redirect("/");

  const entry = handoffTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    handoffTokens.delete(token ?? "");
    return res.status(410).send("登录已过期，请重新登录。");
  }

  handoffTokens.delete(token);
  req.session.user = entry.user;
  req.session.save(() => res.redirect("/"));
});

// --- GET /auth/login --- redirect to Discord OAuth ---
router.get("/login", (_req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).send("DISCORD_CLIENT_ID not configured.");
  }

  // Detect if login was initiated from the Tailscale HTTPS domain
  const referer = _req.get("Referer") ?? "";
  const fromPWA = referer.includes(".ts.net") ? "1" : "0";

  const url =
    `https://discord.com/api/oauth2/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify` +
    `&state=${fromPWA}`;
  res.redirect(url);
});

// --- GET /auth/callback --- Discord OAuth callback ---
router.get("/callback", async (req, res) => {
  console.log(`[AUTH] Callback hit, URL: ${req.url}, query:`, JSON.stringify(req.query));
  const code = req.query.code as string | undefined;
  const fromPWA = (req.query.state as string) === "1";

  if (!code) {
    return res.status(400).send(`No code. URL: ${req.url}, query: ${JSON.stringify(req.query)}`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[AUTH] Token exchange failed: ${tokenRes.status} — ${errText}`);
      return res.status(500).send(`Discord token exchange failed: ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
    };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(500).send("No access token from Discord.");
    }

    // Fetch user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return res.status(500).send("Failed to fetch Discord user.");
    }

    const user = (await userRes.json()) as {
      id: string;
      username: string;
      avatar: string;
    };

    // Verify this user is the master
    const auth = await authLoader();
    const masterId = await auth.getMasterId();
    if (masterId && user.id !== masterId) {
      return res.status(403).send("你不是我的 Master。");
    }

    // If login came from PWA (Tailscale HTTPS), hand off session
    if (fromPWA && TAILSCALE_URL) {
      const token = crypto.randomBytes(32).toString("hex");
      handoffTokens.set(token, {
        user: { id: user.id, username: user.username, avatar: user.avatar ?? "" },
        expires: Date.now() + 60_000, // 1 minute TTL
      });
      return res.redirect(`${TAILSCALE_URL}/auth/handoff?token=${token}`);
    }

    // Normal flow — set session on current domain
    req.session.user = {
      id: user.id,
      username: user.username,
      avatar: user.avatar ?? "",
    };

    console.log(`[AUTH] User set: ${user.username}, saving session...`);
    req.session.save((err) => {
      console.log(`[AUTH] Save done — err: ${err ? err.message : "none"}, hasUser: ${!!req.session.user}`);
      res.redirect("/");
    });
  } catch (err) {
    console.error(`[AUTH] Callback error:`, err);
    res.status(500).send("Authentication error.");
  }
});

// --- GET /auth/logout ---
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// --- GET /api/auth/me ---
router.get("/me", (req, res) => {
  console.log(`[AUTH] /me called — hasSession: ${!!req.session}, hasUser: ${!!req.session.user}`);
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in." });
  }
  res.json(req.session.user);
});

export { router as authRouter };
