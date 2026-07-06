import { Router } from "express";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const configLoader = createLoader(() => import("../../../../eliasCore/src/config.js"));
const authLoader = createLoader(() => import("../../../../eliasCore/src/helpers/auth.js"));
const personasLoader = createLoader(() => import("../../../../eliasCore/src/helpers/personas.js"));

router.get("/", async (_req, res) => {
  try {
    const [config, auth, personas] = await Promise.all([
      configLoader(),
      authLoader(),
      personasLoader(),
    ]);

    const [model, apiUrl, masterId, personaList] = await Promise.all([
      config.getModel(),
      config.getApiUrl(),
      auth.getMasterId(),
      personas.listPersonas(),
    ]);

    const fs = await import("node:fs/promises");
    const { PATHS } = await configLoader();

    let kbOk = false, eliasDataOk = false;
    try { await fs.access(PATHS.knowledgeBase); kbOk = true; } catch {}
    try { await fs.access(PATHS.eliasData); eliasDataOk = true; } catch {}

    const mem = process.memoryUsage();
    res.json({
      uptime: process.uptime(),
      memory: { heapMB: Math.round(mem.heapUsed / 1024 / 1024), rssMB: Math.round(mem.rss / 1024 / 1024) },
      model, apiUrl,
      masterId: masterId ? `${masterId.slice(0, 4)}****` : "未设置",
      personas: personaList.length,
      kbOk, eliasDataOk,
    });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

export { router as dashboardRouter };
