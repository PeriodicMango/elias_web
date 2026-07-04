import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const personasLoader = createLoader(() => import("../../../../eliasCore/src/helpers/personas.js"));
const commandsLoader = createLoader(() => import("../../../../eliasCore/src/helpers/commands.js"));
const channelLoader = createLoader(() => import("../../../../eliasCore/src/helpers/channelRegistry.js"));

// GET /api/personas — list all personas (basic info)
router.get("/", async (_req, res) => {
  try {
    const p = await personasLoader();
    const names = await p.listPersonas();
    const personas = await Promise.all(
      names.map(async (name: string) => ({
        name,
        displayName: await p.getPersonaTitle(name),
        triggers: await p.getPersonaTriggers(name),
        masterTitle: await p.getMasterTitle(name),
      })),
    );
    res.json({ personas });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /api/personas/:name — full persona details (file content + avatar)
router.get("/:name", async (req, res) => {
  try {
    const p = await personasLoader();
    const { name } = req.params;
    const { PATHS } = await import("../../../../eliasCore/src/config.js");

    // Read persona file
    const personaFile = path.join(PATHS.base, "personas", `${name}.md`);
    let fileContent = "";
    try { fileContent = await fs.readFile(personaFile, "utf8"); } catch {
      return res.status(404).json({ error: `人格 ${name} 不存在。` });
    }

    // Get channels.json avatar
    const cr = await channelLoader();
    const channels = await cr.loadChannels();
    const channelCfg = channels?.personas?.[name] || {};
    const avatarUrl = (channelCfg as { avatarUrl?: string }).avatarUrl || "";

    res.json({
      name,
      displayName: await p.getPersonaTitle(name),
      triggers: await p.getPersonaTriggers(name),
      masterTitle: await p.getMasterTitle(name),
      avatarUrl,
      fileContent,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// PUT /api/personas/:name — update persona file and/or avatar
router.put("/:name", async (req, res) => {
  try {
    const p = await personasLoader();
    const { name } = req.params;
    const { fileContent, avatarUrl } = req.body as {
      fileContent?: string;
      avatarUrl?: string;
    };
    const { PATHS } = await import("../../../../eliasCore/src/config.js");

    let updated = false;

    // Update persona file
    if (fileContent !== undefined) {
      const personaFile = path.join(PATHS.base, "personas", `${name}.md`);
      try { await fs.access(personaFile); } catch {
        return res.status(404).json({ error: `人格 ${name} 不存在。` });
      }
      await fs.writeFile(personaFile, fileContent, "utf8");
      updated = true;

      // Clear persona cache so changes take effect immediately
      try { p.clearPersonaCache(); } catch {}
    }

    // Handle avatar data (base64 image upload)
    const { avatarData } = req.body as { avatarData?: string };
    let finalAvatarUrl = avatarUrl;

    if (avatarData && avatarData.startsWith("data:image")) {
      const match = avatarData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const data = Buffer.from(match[2]!, "base64");
        const avatarDir = path.resolve(
          path.dirname(new URL(import.meta.url).pathname),
          "..", "..", "public", "avatars",
        );
        await fs.mkdir(avatarDir, { recursive: true });
        const filename = `${name}.${ext}?v=${Date.now()}`;
        await fs.writeFile(path.join(avatarDir, `${name}.${ext}`), data);
        finalAvatarUrl = `/avatars/${filename}`;
      }
    }

    // Update avatar URL in channels.json
    if (finalAvatarUrl !== undefined) {
      const cr = await channelLoader();
      const channels = await cr.loadChannels();
      if (!channels.personas) channels.personas = {};
      if (!channels.personas[name]) {
        channels.personas[name] = {
          channelId: null,
          displayName: await p.getPersonaTitle(name),
          avatarUrl: "",
          enabled: false,
        };
      }
      channels.personas[name].avatarUrl = finalAvatarUrl;
      await cr.saveChannels(channels);
      updated = true;
    }

    res.json({ ok: true, updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// POST /api/personas/rename
router.post("/rename", async (req, res) => {
  try {
    const c = await commandsLoader();
    const { from, to } = req.body as { from?: string; to?: string };
    if (!from || !to) {
      return res.status(400).json({ error: "from 和 to 是必填项。" });
    }
    const result = await c.renamePersona(from, to);
    res.json({ ok: true, message: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

export { router as personasRouter };
