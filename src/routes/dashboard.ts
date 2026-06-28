import { Router } from "express";

const router = Router();

let getModel: Function;
let getApiUrl: Function;
let getMasterId: Function;
let listPersonas: Function;

async function load() {
  const c = await import("../../elias/src/config.js");
  getModel = c.getModel;
  getApiUrl = c.getApiUrl;
  const a = await import("../../elias/src/helpers/auth.js");
  getMasterId = a.getMasterId;
  const p = await import("../../elias/src/helpers/personas.js");
  listPersonas = p.listPersonas;
}

router.get("/", async (_req, res) => {
  try {
    if (!getModel) await load();
    const [model, apiUrl, masterId, personas] = await Promise.all([
      getModel(), getApiUrl(), getMasterId(), listPersonas(),
    ]);

    const fs = await import("node:fs/promises");
    const { PATHS } = await import("../../elias/src/config.js");

    let kbOk = false, eliasDataOk = false;
    try { await fs.access(PATHS.knowledgeBase); kbOk = true; } catch {}
    try { await fs.access(PATHS.eliasData); eliasDataOk = true; } catch {}

    const mem = process.memoryUsage();
    res.json({
      uptime: process.uptime(),
      memory: { heapMB: Math.round(mem.heapUsed / 1024 / 1024), rssMB: Math.round(mem.rss / 1024 / 1024) },
      model, apiUrl,
      masterId: masterId ? `${(masterId as string).slice(0, 4)}****` : "未设置",
      personas: (personas as string[]).length,
      kbOk, eliasDataOk,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as dashboardRouter };
