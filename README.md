# Elias Web Console

Express API server for the Elias companion bot. Serves the web console frontend (SPA) and provides REST API endpoints for chat, persona management, knowledge base, and system settings.

Frontend is served from `platforms/app/frontend/` (separate repo), falling back to `public/` if unavailable.

## Quick Start

```bash
npm install
cp .env.example .env   # edit with your values
npm start              # http://localhost:3457
```

## Required Env Vars

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Session signing secret |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret |
| `DISCORD_REDIRECT_URI` | OAuth callback URL |

eliasCore `.env` (API keys, model) is auto-loaded from `../../../eliasCore/.env`.

## Architecture

```
src/
  server.ts            ← Express app, session, CORS, static serving
  lazyLoad.ts          ← Dynamic import helper
  middleware/auth.ts    ← Session cookie + Bearer token auth
  routes/
    auth.ts            ← Discord OAuth, JWT tokens, session handoff
    chat.ts            ← Chat with personas (LLM)
    personas.ts        ← Persona CRUD + avatar upload
    vault.ts           ← Knowledge base file tree + search
    goals.ts           ← Goals list + add/done
    dashboard.ts       ← System status (uptime, memory, model)
    home.ts            ← LLM-generated greeting for homepage
    settings-api.ts, settings-proactive.ts,
    settings-groupchat.ts, settings-master.ts
    activity.ts        ← Daily activity log viewer
```

## Test

```bash
npx vitest run
```

71 tests covering Feature system, API client, greeting bubble, and homepage.

## API Docs

[API.md](../app/API.md) — all 36 endpoints with request/response shapes and error codes.

## Deploy

```bash
# Cloud: pull both repos
cd /root/elias/platforms/web && git pull
cd /root/elias/platforms/app && git pull
systemctl restart elias-web.service
```

## License

MIT
