import { Router } from "express";

const router = Router();

let loadChannels: Function;
let saveChannels: Function;
let listPersonas: Function;

async function load() {
  const cr = await import("../../../elias/src/helpers/channelRegistry.js");
  loadChannels = cr.loadChannels;
  saveChannels = cr.saveChannels;
  const p = await import("../../../elias/src/helpers/personas.js");
  listPersonas = p.listPersonas;
}

router.get("/", async (_req, res) => {
  try {
    if (!loadChannels) await load();
    const [channels, names] = await Promise.all([loadChannels(), listPersonas()]);
    const gcPersonas: string[] = channels?.groupChat?.personas ?? [];
    const personas = await Promise.all(
      (names as string[]).map(async (name: string) => {
        const { getPersonaTitle } = await import("../../../elias/src/helpers/personas.js");
        return {
          name,
          displayName: await getPersonaTitle(name),
          inGroupChat: gcPersonas.includes(name),
        };
      }),
    );
    res.json({
      enabled: channels?.groupChat?.enabled ?? false,
      channelId: channels?.groupChat?.channelId ?? null,
      personas,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:persona", async (req, res) => {
  try {
    if (!loadChannels) await load();
    const { persona } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    if (enabled === undefined) return res.status(400).json({ error: "enabled 是必填项。" });

    const channels = await loadChannels();
    const gc = channels.groupChat ?? {};
    let list: string[] = gc.personas ?? [];
    if (enabled && !list.includes(persona!)) list.push(persona!);
    if (!enabled) list = list.filter((n: string) => n !== persona);
    channels.groupChat = { ...gc, personas: list };
    await saveChannels(channels);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as settingsGroupchatRouter };
