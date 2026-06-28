import { Router } from "express";

const router = Router();

let getMasterId: Function;
let transferMaster: Function;

async function load() {
  const a = await import("../../elias/src/helpers/auth.js");
  getMasterId = a.getMasterId;
  transferMaster = a.transferMaster;
}

router.get("/", async (_req, res) => {
  try {
    if (!getMasterId) await load();
    const id = await getMasterId();
    res.json({ masterId: id || "未设置" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/transfer", async (req, res) => {
  try {
    if (!transferMaster) await load();
    const { newId } = req.body as { newId?: string };
    if (!newId) return res.status(400).json({ error: "newId 是必填项（17-20位Discord用户ID）。" });
    const result = await transferMaster(newId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, message: `Master 已转让至 ${newId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as settingsMasterRouter };
