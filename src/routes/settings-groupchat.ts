import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const gcToggleSchema = z.object({
  enabled: z.boolean(),
});

const channelLoader = createLoader(() => import("../../../../eliasCore/src/helpers/channelRegistry.js"));
const personasLoader = createLoader(() => import("../../../../eliasCore/src/helpers/personas.js"));

router.get("/", async (_req, res) => {
  try {
    const cr = await channelLoader();
    const p = await personasLoader();
    const [channels, names] = await Promise.all([cr.loadChannels(), p.listPersonas()]);
    const gcPersonas: string[] = channels?.groupChat?.personas ?? [];
    const personas = await Promise.all(
      names.map(async (name: string) => ({
        name,
        displayName: await p.getPersonaTitle(name),
        inGroupChat: gcPersonas.includes(name),
      })),
    );
    res.json({
      enabled: channels?.groupChat?.enabled ?? false,
      channelId: channels?.groupChat?.channelId ?? null,
      personas,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put("/:persona", validate(gcToggleSchema), async (req, res) => {
  try {
    const cr = await channelLoader();
    const { persona } = req.params;
    const { enabled } = req.body as z.infer<typeof gcToggleSchema>;

    const channels = await cr.loadChannels();
    const gc = channels.groupChat ?? {};
    let list: string[] = gc.personas ?? [];
    if (enabled && !list.includes(persona!)) list.push(persona!);
    if (!enabled) list = list.filter((n: string) => n !== persona);
    channels.groupChat = { ...gc, personas: list };
    await cr.saveChannels(channels);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as settingsGroupchatRouter };
