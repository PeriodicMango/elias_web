import { Router } from "express";

const router = Router();

let listPersonas: Function;
let getPersonaTitle: Function;
let getPersonaTriggers: Function;
let getMasterTitle: Function;
let renamePersona: Function;

async function load() {
  const p = await import("../../elias/src/helpers/personas.js");
  listPersonas = p.listPersonas;
  getPersonaTitle = p.getPersonaTitle;
  getPersonaTriggers = p.getPersonaTriggers;
  getMasterTitle = p.getMasterTitle;
  const c = await import("../../elias/src/helpers/commands.js");
  renamePersona = (c as any).renamePersona;
}

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
