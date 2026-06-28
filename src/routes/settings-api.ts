import { Router } from "express";

const router = Router();

let getModel: Function;
let getApiUrl: Function;
let getApiKey: Function;
let readDataJson: Function;

async function load() {
  const c = await import("../../elias/src/config.js");
  getModel = c.getModel;
  getApiUrl = c.getApiUrl;
  getApiKey = c.getApiKey;
  const a = await import("../../elias/src/helpers/auth.js");
  readDataJson = a.readDataJson;
}

router.get("/", async (_req, res) => {
  if (!getModel) await load();
  const [model, apiUrl, apiKey] = await Promise.all([getModel(), getApiUrl(), getApiKey()]);
  res.json({
    model,
    apiUrl,
    apiKey: (apiKey as string).slice(0, 8) + "****",
  });
});

router.put("/", async (req, res) => {
  if (!readDataJson) await load();
  const { model, url, key } = req.body as { model?: string; url?: string; key?: string };
  const data = await readDataJson();
  if (model !== undefined) data.deepseekModel = model;
  if (url !== undefined) data.deepseekUrl = url;
  if (key !== undefined) data.deepseekKey = key;
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { PATHS } = await import("../../elias/src/config.js");
  await fs.writeFile(
    path.join(PATHS.base, "data.json"),
    JSON.stringify(data, null, 2),
    "utf8",
  );
  res.json({ ok: true });
});

export { router as settingsApiRouter };
