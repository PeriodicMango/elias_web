import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const apiSettingsSchema = z.object({
  model: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
});

const configLoader = createLoader(() => import("../../../../eliasCore/src/config.js"));

router.get("/", async (_req, res) => {
  const config = await configLoader();
  const [model, apiUrl, apiKey] = await Promise.all([
    config.getModel(), config.getApiUrl(), config.getApiKey(),
  ]);
  res.json({
    model,
    apiUrl,
    apiKey: (apiKey as string).slice(0, 8) + "****",
  });
});

router.put("/", validate(apiSettingsSchema), async (req, res) => {
  const config = await configLoader();
  const { model, url, key } = req.body as z.infer<typeof apiSettingsSchema>;
  const data = await config.readDataJson();
  if (model !== undefined) data.deepseekModel = model;
  if (url !== undefined) data.deepseekUrl = url;
  if (key !== undefined) data.deepseekKey = key;
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { PATHS } = await configLoader();
  await fs.writeFile(
    path.join(PATHS.base, "data.json"),
    JSON.stringify(data, null, 2),
    "utf8",
  );
  res.json({ ok: true });
});

export { router as settingsApiRouter };
