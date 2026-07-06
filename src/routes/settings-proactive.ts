import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const pauseSchema = z.object({
  duration: z.string().min(1, "duration 是必填项"),
});

const personaToggleSchema = z.object({
  enabled: z.boolean(),
});

const proactiveLoader = createLoader(() => import("../../../../eliasCore/src/helpers/proactive.js"));
const personasLoader = createLoader(() => import("../../../../eliasCore/src/helpers/personas.js"));
const configLoader = createLoader(() => import("../../../../eliasCore/src/config.js"));

router.get("/", async (_req, res) => {
  try {
    const [proactive, p] = await Promise.all([proactiveLoader(), personasLoader()]);
    const [paused, disabled, names] = await Promise.all([
      proactive.isPaused(),
      proactive.getProactiveDisabledPersonas(),
      p.listPersonas(),
    ]);

    // Read pause until
    let pausedUntil: string | null = null;
    try {
      const config = await configLoader();
      const data = await config.readDataJson();
      pausedUntil = (data.proactivePausedUntil as string) ?? null;
    } catch {}

    const personas = await Promise.all(
      names.map(async (name: string) => ({
        name,
        displayName: await p.getPersonaTitle(name),
        proactiveEnabled: !(disabled as string[]).includes(name),
      })),
    );

    res.json({ paused, pausedUntil, personas });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

router.post("/pause", validate(pauseSchema), async (req, res) => {
  try {
    const { duration } = req.body as z.infer<typeof pauseSchema>;

    // Parse duration
    const match = duration.match(/^(\d+)\s*(m|min|分钟|h|小时)$/i);
    if (!match) return res.status(400).json({ error: "格式无效。示例: 30m, 1h" });
    const n = parseInt(match[1]!, 10);
    const unit = match[2]!.toLowerCase();
    const ms = unit.startsWith("h") || unit === "小时" ? n * 3600000 : n * 60000;
    const until = new Date(Date.now() + ms).toISOString();

    const config = await configLoader();
    const data = await config.readDataJson();
    data.proactivePausedUntil = until;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { PATHS } = await configLoader();
    await fs.writeFile(path.join(PATHS.base, "data.json"), JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true, pausedUntil: until });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

router.post("/resume", async (_req, res) => {
  try {
    const config = await configLoader();
    const data = await config.readDataJson();
    delete data.proactivePausedUntil;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { PATHS } = await configLoader();
    await fs.writeFile(path.join(PATHS.base, "data.json"), JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

router.put("/:persona", validate(personaToggleSchema), async (req, res) => {
  try {
    const proactive = await proactiveLoader();
    const { persona } = req.params;
    const { enabled } = req.body as z.infer<typeof personaToggleSchema>;
    await proactive.setPersonaProactiveDisabled(persona!, !enabled);
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

export { router as settingsProactiveRouter };
