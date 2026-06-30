# elias-web

Web admin console for Elias. Discord OAuth2 login, chat interface, persona editor, knowledge base browser.

## Features

- Discord OAuth2 authentication (master-only write access)
- Chat with any persona (dual-pipeline + fast mode, thinking toggle)
- Persona management (edit YAML, upload avatars, rename)
- Knowledge base browser (file tree, editor, search)
- Goals viewer
- Style customization (light/dark/blue themes, accent colors, font size)
- Session persistence (30-day cookie)

## Structure

```
src/
  server.ts         ← Express app, session, static serving, SPA fallback
  routes/
    auth.ts         ← Discord OAuth2 login/callback/logout
    chat.ts         ← POST /api/chat, POST /api/chat/clear
    personas.ts     ← GET/PUT persona details, avatar upload
    vault.ts        ← KB tree, read, write, delete, search
    goals.ts        ← GET goals, POST add, PUT done
    dashboard.ts    ← System status
    settings-api.ts ← API config read/write
    settings-master.ts    ← Master info + transfer
    settings-proactive.ts ← Proactive pause/resume
    settings-groupchat.ts ← Group chat toggles
    activity.ts     ← Activity log viewer
public/
  css/main.css      ← Design system (Hyperspace + Tabler inspired)
  js/
    app.js          ← SPA: auth state, tab routing, theme engine
    api.js          ← fetch() wrappers with auth handling
  index.html        ← App shell
```

## Setup

```bash
npm install
```

Requires `eliasCore` in `../../../eliasCore/`. Environment variables in `.env`:

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=...
SESSION_SECRET=...
```

The eliasCore `.env` (with `DEEPSEEK_API_KEY`) is also loaded automatically.

## Running

```bash
npm start
# or: npx tsx src/server.ts
# Listens on port 3457
```

## URLs

- HTTP: `http://209.38.16.128:3457`
- HTTPS via Tailscale: `https://ubuntu-s-1vcpu-1gb-syd1.tail5e2b17.ts.net`
