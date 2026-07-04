import { Router } from "express";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const activityLoader = createLoader(() =>
  import("../../../../eliasCore/src/helpers/tools/executors/activity.js"),
);

// GET /api/activity?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const a = await activityLoader();
    const date = (req.query.date as string) || new Date().toLocaleString("sv-SE", { timeZone: "Australia/Sydney" }).slice(0, 10);
    const result = await a.getActivity({ date });
    res.json({ date, content: result.content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /api/activity/addresses
router.get("/addresses", async (_req, res) => {
  try {
    const a = await activityLoader();
    const result = await a.listAddresses({});
    res.json({ content: result.content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as activityRouter };
