import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const masterTransferSchema = z.object({
  newId: z.string().min(17, "newId 是必填项（17-20位Discord用户ID）"),
});

const authLoader = createLoader(() => import("../../../../eliasCore/src/helpers/auth.js"));

router.get("/", async (_req, res) => {
  try {
    const auth = await authLoader();
    const id = await auth.getMasterId();
    res.json({ masterId: id || "未设置" });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

router.post("/transfer", validate(masterTransferSchema), async (req, res) => {
  try {
    const auth = await authLoader();
    const { newId } = req.body as z.infer<typeof masterTransferSchema>;
    const result = await auth.transferMaster(newId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, message: `Master 已转让至 ${newId}` });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

export { router as settingsMasterRouter };
