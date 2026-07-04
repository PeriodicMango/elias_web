import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load eliasCore .env FIRST so its config.ts finds API keys
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", "eliasCore", ".env") });
// Then load web-specific .env (non-override)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import session from "express-session";

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
import { requireSession } from "./middleware/auth.js";

const PORT = Number(process.env.WEB_PORT) || 3457;
if (!process.env.SESSION_SECRET) {
  console.error("[SYSTEM LOG] SESSION_SECRET is required. Set it in .env and restart.");
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET!;

const app = express();

// Body parsing
app.use(express.json());

// Session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      // sameSite omitted — some browsers restrict SameSite cookies on HTTP/IP sites
    },
  }),
);

// --- Public routes (no auth) ---
app.use("/auth", authRouter);

// --- API routes (require session) ---
app.use("/api/auth", authRouter); // /api/auth/me
app.use("/api/chat", requireSession, chatRouter);
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

// --- Static frontend ---
app.use(express.static(path.resolve(__dirname, "..", "public")));

// --- SPA fallback — serve index.html for any non-API route ---
app.get("*", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "..", "public", "index.html"));
});

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ELIAS-WEB] Listening on http://0.0.0.0:${PORT}`);
});

export { app };
