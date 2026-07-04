import { Router } from "express";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const authLoader = createLoader(() => import("../../../../eliasCore/src/helpers/auth.js"));

router.get("/", async (_req, res) => {
  try {
    const auth = await authLoader();
    const id = await auth.getMasterId();
    res.json({ masterId: id || "未设置" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/transfer", async (req, res) => {
  try {
    const auth = await authLoader();
    const { newId } = req.body as { newId?: string };
    if (!newId) return res.status(400).json({ error: "newId 是必填项（17-20位Discord用户ID）。" });
    const result = await auth.transferMaster(newId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, message: `Master 已转让至 ${newId}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as settingsMasterRouter };
