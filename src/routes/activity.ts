import { Router } from "express";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const appLoader = createLoader(() =>
  import("../../../../apps/activity/src/activity.js"),
);

// GET /api/activity?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const mod = await appLoader();
    const app = mod.createActivityApp({ vaultRoot: "" }); // vaultRoot resolved internally
    const date = (req.query.date as string) || new Date().toLocaleString("sv-SE", { timeZone: "Australia/Sydney" }).slice(0, 10);
    const result = await app.execute("get_activity", { date });
    res.json({ date, content: result.content });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

// GET /api/activity/addresses
router.get("/addresses", async (_req, res) => {
  try {
    const mod = await appLoader();
    const app = mod.createActivityApp({ vaultRoot: "" });
    const result = await app.execute("list_addresses", {});
    res.json({ content: result.content });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

export { router as activityRouter };
