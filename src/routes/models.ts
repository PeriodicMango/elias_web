// ---------------------------------------------------------------------------
// Models API — list, upload (ZIP), delete 3D/Live2D character models
// ---------------------------------------------------------------------------
// Models live at platforms/app/frontend/models/<name>/
// Each directory contains a model file (.pmx, .moc3, .model3.json) + textures.
// ---------------------------------------------------------------------------

import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import AdmZip from "adm-zip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve to platforms/app/frontend/models/
const MODELS_DIR = path.resolve(__dirname, "..", "..", "..", "app", "frontend", "models");

// Ensure the models directory exists
try { await fs.mkdir(MODELS_DIR, { recursive: true }); } catch { /* ok */ }

const router = Router();

// Multer — memory storage, 50MB limit, ZIP only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isZip =
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      file.originalname.toLowerCase().endsWith(".zip");
    cb(null, isZip);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect renderer type from a model directory's contents. */
async function detectModelType(dirPath: string): Promise<"pmx" | "live2d" | "unknown"> {
  try {
    const files = await fs.readdir(dirPath);
    for (const f of files) {
      if (f.endsWith(".pmx")) return "pmx";
      if (f.endsWith(".moc3") || f.endsWith(".model3.json")) return "live2d";
    }
  } catch { /* dir doesn't exist */ }
  return "unknown";
}

/**
 * Find the primary model file within a directory.
 * Returns the path relative to MODELS_DIR, e.g. "anaxagoras/星穹铁道—那刻夏.pmx".
 */
async function findModelFile(dirPath: string, dirName: string): Promise<string | null> {
  try {
    const files = await fs.readdir(dirPath);

    // Prefer .pmx
    const pmx = files.find(f => f.endsWith(".pmx"));
    if (pmx) return `${dirName}/${pmx}`;

    // Then .model3.json (Live2D)
    const model3 = files.find(f => f.endsWith(".model3.json"));
    if (model3) return `${dirName}/${model3}`;

    // Then .moc3
    const moc3 = files.find(f => f.endsWith(".moc3"));
    if (moc3) return `${dirName}/${moc3}`;
  } catch { /* */ }
  return null;
}

/** Count files in a directory (non-recursive). */
async function countFiles(dirPath: string): Promise<number> {
  try {
    const files = await fs.readdir(dirPath);
    return files.length;
  } catch { return 0; }
}

/** Validate model name: alphanumeric, CJK chars, hyphens, underscores. No path separators. */
function isValidModelName(name: string): boolean {
  return /^[\w一-鿿㐀-䶿-]+$/u.test(name) && !name.includes("..");
}

// ---------------------------------------------------------------------------
// GET /api/models — list all available models
// ---------------------------------------------------------------------------
router.get("/", async (_req, res) => {
  try {
    const entries = await fs.readdir(MODELS_DIR, { withFileTypes: true });
    const models = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(MODELS_DIR, entry.name);
      const rendererType = await detectModelType(dirPath);
      const modelPath = await findModelFile(dirPath, entry.name);
      const fileCount = await countFiles(dirPath);

      models.push({
        name: entry.name,
        rendererType,
        modelPath: modelPath ?? `models/${entry.name}/`,
        fileCount,
      });
    }

    // Sort: working models first, then unknown
    models.sort((a, b) => {
      const order = { pmx: 0, live2d: 1, unknown: 2 };
      return (order[a.rendererType] ?? 2) - (order[b.rendererType] ?? 2);
    });

    res.json({ models });
  } catch (err) {
    console.error("[MODELS] Error listing:", err);
    res.status(500).json({ error: "获取模型列表失败，请稍后重试" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/models — upload a model ZIP
// ---------------------------------------------------------------------------
router.post("/", upload.single("file"), async (req, res) => {
  try {
    // Validate file presence
    if (!req.file) {
      return res.status(400).json({ error: "请选择ZIP文件" });
    }

    // Validate model name
    const modelName = (req.body.name || "").trim();
    if (!modelName) {
      return res.status(400).json({ error: "请输入模型名称" });
    }
    if (!isValidModelName(modelName)) {
      return res.status(400).json({ error: "模型名称只能包含字母、数字、中文、连字符和下划线" });
    }

    const targetDir = path.join(MODELS_DIR, modelName);

    // Check for existing model
    try {
      await fs.access(targetDir);
      return res.status(409).json({ error: `模型 "${modelName}" 已存在，请先删除旧版本或使用不同的名称` });
    } catch { /* doesn't exist — good */ }

    // Extract ZIP
    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch {
      return res.status(400).json({ error: "无法解析ZIP文件，请确认文件未损坏" });
    }

    await fs.mkdir(targetDir, { recursive: true });
    zip.extractAllTo(targetDir, true);

    // Validate: directory must contain a supported model file
    const type = await detectModelType(targetDir);
    if (type === "unknown") {
      // Clean up — not a valid model directory
      await fs.rm(targetDir, { recursive: true, force: true });
      return res.status(400).json({
        error: "ZIP文件中未找到支持的模型文件（.pmx / .moc3 / .model3.json）",
      });
    }

    const modelPath = await findModelFile(targetDir, modelName);
    const fileCount = await countFiles(targetDir);

    res.json({
      ok: true,
      model: {
        name: modelName,
        rendererType: type,
        modelPath: modelPath ?? `models/${modelName}/`,
        fileCount,
      },
    });
  } catch (err) {
    console.error("[MODELS] Error uploading:", err);
    res.status(500).json({ error: "上传模型失败，请稍后重试" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/models/:name — delete a model directory
// ---------------------------------------------------------------------------
router.delete("/:name", async (req, res) => {
  try {
    const { name } = req.params;

    // Guard against path traversal
    if (!isValidModelName(name) || name.includes("/") || name.includes("..")) {
      return res.status(400).json({ error: "无效的模型名称" });
    }

    const targetDir = path.join(MODELS_DIR, name);

    try {
      await fs.access(targetDir);
    } catch {
      return res.status(404).json({ error: `模型 "${name}" 不存在` });
    }

    await fs.rm(targetDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("[MODELS] Error deleting:", err);
    res.status(500).json({ error: "删除模型失败，请稍后重试" });
  }
});

export { router as modelsRouter };
