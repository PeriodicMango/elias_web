import { Router } from "express";

const router = Router();

let isPaused: Function;
let getProactiveDisabledPersonas: Function;
let setPersonaProactiveDisabled: Function;
let listPersonas: Function;

async function load() {
  const p = await import("../../elias/src/helpers/proactive.js");
  isPaused = p.isPaused;
  getProactiveDisabledPersonas = p.getProactiveDisabledPersonas;
  setPersonaProactiveDisabled = p.setPersonaProactiveDisabled;
  const per = await import("../../elias/src/helpers/personas.js");
  listPersonas = per.listPersonas;
}

router.get("/", async (_req, res) => {
  try {
    if (!isPaused) await load();
    const [paused, disabled, names] = await Promise.all([
      isPaused(), getProactiveDisabledPersonas(), listPersonas(),
    ]);

    // Read pause until
    let pausedUntil: string | null = null;
    try {
      const { readDataJson } = await import("../../elias/src/helpers/auth.js");
      const data = await readDataJson();
      pausedUntil = (data.proactivePausedUntil as string) ?? null;
    } catch {}

    const personas = await Promise.all(
      (names as string[]).map(async (name: string) => {
        const titleMod = await import("../../elias/src/helpers/personas.js");
        return {
          name,
          displayName: await titleMod.getPersonaTitle(name),
          proactiveEnabled: !(disabled as string[]).includes(name),
        };
      }),
    );

    res.json({ paused, pausedUntil, personas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/pause", async (req, res) => {
  try {
    const { duration } = req.body as { duration?: string };
    if (!duration) return res.status(400).json({ error: "duration 是必填项（如 30m, 1h）。" });

    // Parse duration
    const match = duration.match(/^(\d+)\s*(m|min|分钟|h|小时)$/i);
    if (!match) return res.status(400).json({ error: "格式无效。示例: 30m, 1h" });
    const n = parseInt(match[1]!, 10);
    const unit = match[2]!.toLowerCase();
    const ms = unit.startsWith("h") || unit === "小时" ? n * 3600000 : n * 60000;
    const until = new Date(Date.now() + ms).toISOString();

    const { readDataJson } = await import("../../elias/src/helpers/auth.js");
    const data = await readDataJson();
    data.proactivePausedUntil = until;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { PATHS } = await import("../../elias/src/config.js");
    await fs.writeFile(path.join(PATHS.base, "data.json"), JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true, pausedUntil: until });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/resume", async (_req, res) => {
  try {
    const { readDataJson } = await import("../../elias/src/helpers/auth.js");
    const data = await readDataJson();
    delete data.proactivePausedUntil;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { PATHS } = await import("../../elias/src/config.js");
    await fs.writeFile(path.join(PATHS.base, "data.json"), JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:persona", async (req, res) => {
  try {
    if (!setPersonaProactiveDisabled) await load();
    const { persona } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    if (enabled === undefined) return res.status(400).json({ error: "enabled 是必填项。" });
    await setPersonaProactiveDisabled(persona!, !enabled);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as settingsProactiveRouter };
