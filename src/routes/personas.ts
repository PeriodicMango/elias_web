import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";

const router = Router();

let listPersonas: Function;
let getPersonaTitle: Function;
let getPersonaTriggers: Function;
let getMasterTitle: Function;
let renamePersona: Function;
let loadChannels: Function;
let saveChannels: Function;

async function load() {
  const p = await import("../../../elias/src/helpers/personas.js");
  listPersonas = p.listPersonas;
  getPersonaTitle = p.getPersonaTitle;
  getPersonaTriggers = p.getPersonaTriggers;
  getMasterTitle = p.getMasterTitle;
  const c = await import("../../../elias/src/helpers/commands.js");
  renamePersona = (c as any).renamePersona;
  const cr = await import("../../../elias/src/helpers/channelRegistry.js");
  loadChannels = cr.loadChannels;
  saveChannels = cr.saveChannels;
}

// GET /api/personas — list all personas (basic info)
router.get("/", async (_req, res) => {
  try {
    if (!listPersonas) await load();
    const names = await listPersonas();
    const personas = await Promise.all(
      names.map(async (name: string) => ({
        name,
        displayName: await getPersonaTitle(name),
        triggers: await getPersonaTriggers(name),
        masterTitle: await getMasterTitle(name),
      })),
    );
    res.json({ personas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/personas/:name — full persona details (file content + avatar)
router.get("/:name", async (req, res) => {
  try {
    if (!listPersonas) await load();
    const { name } = req.params;
    const { PATHS } = await import("../../../elias/src/config.js");

    // Read persona file
    const personaFile = path.join(PATHS.base, "personas", `${name}.md`);
    let fileContent = "";
    try { fileContent = await fs.readFile(personaFile, "utf8"); } catch {
      return res.status(404).json({ error: `人格 ${name} 不存在。` });
    }

    // Get channels.json avatar
    const channels = await loadChannels();
    const channelCfg = channels?.personas?.[name] || {};
    const avatarUrl = channelCfg.avatarUrl || "";

    res.json({
      name,
      displayName: await getPersonaTitle(name),
      triggers: await getPersonaTriggers(name),
      masterTitle: await getMasterTitle(name),
      avatarUrl,
      fileContent,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/personas/:name — update persona file and/or avatar
router.put("/:name", async (req, res) => {
  try {
    if (!listPersonas) await load();
    const { name } = req.params;
    const { fileContent, avatarUrl } = req.body as {
      fileContent?: string;
      avatarUrl?: string;
    };
    const { PATHS } = await import("../../../elias/src/config.js");

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
      try {
        const p = await import("../../../elias/src/helpers/personas.js");
        if ((p as any).clearPersonaCache) (p as any).clearPersonaCache();
      } catch {}
    }

    // Update avatar in channels.json
    if (avatarUrl !== undefined) {
      const channels = await loadChannels();
      if (!channels.personas) channels.personas = {};
      if (!channels.personas[name]) {
        channels.personas[name] = {
          channelId: null,
          displayName: await getPersonaTitle(name),
          avatarUrl: "",
          enabled: false,
        };
      }
      channels.personas[name].avatarUrl = avatarUrl;
      await saveChannels(channels);
      updated = true;
    }

    res.json({ ok: true, updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/personas/rename
router.post("/rename", async (req, res) => {
  try {
    if (!renamePersona) await load();
    const { from, to } = req.body as { from?: string; to?: string };
    if (!from || !to) {
      return res.status(400).json({ error: "from 和 to 是必填项。" });
    }
    const result = await renamePersona(from, to);
    res.json({ ok: true, message: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export { router as personasRouter };
