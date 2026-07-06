import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load eliasCore .env FIRST so its config.ts finds API keys
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", "eliasCore", ".env") });
// Then load web-specific .env (non-override)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import session from "express-session";
import helmet from "helmet";
import createSqliteStore from "connect-sqlite3";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { personasRouter } from "./routes/personas.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { settingsApiRouter } from "./routes/settings-api.js";
import { settingsProactiveRouter } from "./routes/settings-proactive.js";
import { settingsGroupchatRouter } from "./routes/settings-groupchat.js";
import { settingsMasterRouter } from "./routes/settings-master.js";
import { vaultRouter } from "./routes/vault.js";
import { goalsRouter } from "./routes/goals.js";
import { activityRouter } from "./routes/activity.js";
import { homeRouter } from "./routes/home.js";
import { notificationsRouter } from "./routes/notifications.js";
import { requireSession } from "./middleware/auth.js";

const PORT = Number(process.env.WEB_PORT) || 3457;
if (!process.env.SESSION_SECRET) {
  console.error("[SYSTEM LOG] SESSION_SECRET is required. Set it in .env and restart.");
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET!;

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.discordapp.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https:"],
        connectSrc: ["'self'", "https://discord.com", "https://cdn.discordapp.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Body parsing
app.use(express.json());

// CORS — allow cross-origin API access (Capacitor app, PWA, etc.)
app.use("/api", (_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Session — SQLite-backed (survives restarts, no external DB needed)
const SQLiteStore = createSqliteStore(session);
const sessionDbPath = path.resolve(__dirname, "..", "sessions.db");

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: path.resolve(__dirname, "..") }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

// --- Public routes (no auth) ---
app.use("/auth", authRouter);

// --- API routes (require session) ---
// Rate limit /api/chat — 10 req/min per IP (LLM calls cost money)
const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "请求太频繁，请稍后再试。" },
});
app.use("/api/chat", chatLimiter, requireSession, chatRouter);
app.use("/api/personas", requireSession, personasRouter);
app.use("/api/dashboard", requireSession, dashboardRouter);
app.use("/api/settings/api", requireSession, settingsApiRouter);
app.use("/api/settings/proactive", requireSession, settingsProactiveRouter);
app.use("/api/settings/groupchat", requireSession, settingsGroupchatRouter);
app.use("/api/settings/master", requireSession, settingsMasterRouter);
app.use("/api/vault", requireSession, vaultRouter);
app.use("/api/goals", requireSession, goalsRouter);
app.use("/api/activity", requireSession, activityRouter);
app.use("/api/home", requireSession, homeRouter);
app.use("/api/notifications", notificationsRouter);

// --- Static frontend ---
// Try Capacitor app frontend first (local dev), fall back to local public/ (cloud)
const appFrontend = path.resolve(__dirname, "..", "..", "app", "frontend");
const localPublic = path.resolve(__dirname, "..", "public");
const staticDir = fs.existsSync(appFrontend) ? appFrontend : localPublic;
console.log(`[ELIAS-WEB] Serving static from: ${staticDir}`);
app.use(express.static(staticDir));

// --- Health check ---
app.get("/health", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    uptime: process.uptime(),
    memory: {
      heapMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    },
  });
});

// --- SPA fallback — serve index.html for any non-API route ---
const indexFile = path.join(staticDir, "index.html");
app.get("*", (_req, res) => {
  res.sendFile(indexFile);
});

// Wire proactive → push notifications
(async () => {
  try {
    const proactive = await import(
      "../../../../eliasCore/src/helpers/proactive.js" as string
    );
    const { sendPushNotification } = await import("./routes/notifications.js");
    proactive.setPushNotifier(
      async (persona: string, _displayName: string, message: string) => {
        const body =
          message.length > 120 ? message.slice(0, 117) + "…" : message;
        await sendPushNotification(persona, body);
      },
    );
    console.log("[ELIAS-WEB] Push notifier registered with proactive");
  } catch {
    // Proactive/push notification not available — skip
  }
})();

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ELIAS-WEB] Listening on http://0.0.0.0:${PORT}`);
});

export { app };
