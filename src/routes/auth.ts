import { Router } from "express";

const router = Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? "http://localhost:3457/auth/callback";

// Import elias auth to check master ID
let getMasterId: () => Promise<string>;
async function loadEliasAuth() {
  const mod = await import("../../elias/src/helpers/auth.js");
  getMasterId = mod.getMasterId;
}

// --- GET /auth/login --- redirect to Discord OAuth ---
router.get("/login", (_req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).send("DISCORD_CLIENT_ID not configured.");
  }
  const url =
    `https://discord.com/api/oauth2/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify`;
  res.redirect(url);
});

// --- GET /auth/callback --- Discord OAuth callback ---
router.get("/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    return res.status(400).send("Missing authorization code.");
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
      console.error(`[AUTH] Token exchange failed: ${tokenRes.status}`);
      return res.status(500).send("Discord token exchange failed.");
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
    if (!getMasterId) await loadEliasAuth();
    const masterId = await getMasterId();
    if (masterId && user.id !== masterId) {
      return res.status(403).send("你不是我的 Master。");
    }

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      avatar: user.avatar ?? "",
    };

    res.redirect("/");
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
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in." });
  }
  res.json(req.session.user);
});

export { router as authRouter };
