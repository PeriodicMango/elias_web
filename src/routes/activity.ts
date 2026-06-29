import { Router } from "express";

const router = Router();

let getActivity: Function;
let listAddresses: Function;

async function load() {
  const a = await import("../../../eliasCore/src/helpers/tools/executors/activity.js");
  getActivity = a.getActivity;
  listAddresses = a.listAddresses;
}

// GET /api/activity?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    if (!getActivity) await load();
    const date = (req.query.date as string) || new Date().toLocaleString("sv-SE", { timeZone: "Australia/Sydney" }).slice(0, 10);
    const result = await getActivity({ date });
    res.json({ date, content: result.content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/activity/addresses
router.get("/addresses", async (_req, res) => {
  try {
    if (!listAddresses) await load();
    const result = await listAddresses({});
    res.json({ content: result.content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as activityRouter };
