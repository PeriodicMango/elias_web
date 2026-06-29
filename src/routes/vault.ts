import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";

const router = Router();

let VAULT_ROOT: string;
let ELIAS_DATA_ROOT: string;

async function loadRoots() {
  const shared = await import("../../../eliasCore/src/helpers/tools/shared.js");
  VAULT_ROOT = shared.VAULT_ROOT;
  ELIAS_DATA_ROOT = shared.ELIAS_DATA_ROOT;
}

function safeResolve(root: string, filePath: string): string {
  const resolved = path.resolve(root, filePath);
  if (!resolved.startsWith(root)) {
    throw new Error(`Access denied: ${filePath} is outside root`);
  }
  return resolved;
}

// GET /api/vault/tree — recursive directory tree of BOTH vault + elias_data
router.get("/tree", async (_req, res) => {
  try {
    if (!VAULT_ROOT) await loadRoots();
    async function tree(dir: string, name: string, maxDepth = 4, prefix = ""): Promise<any> {
      const node: any = { name, path: prefix || name, type: "directory", children: [] };
      if (maxDepth <= 0) return node;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return node; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name);
        const childPath = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) {
          const child = await tree(full, e.name, maxDepth - 1, childPath);
          node.children.push(child);
        } else {
          node.children.push({ name: e.name, path: childPath, type: "file" });
        }
      }
      node.children.sort((a: any, b: any) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return node;
    }

    const vaultTree = await tree(VAULT_ROOT!, "Vault (Obsidian)").catch(() => null);
    const dataTree = await tree(ELIAS_DATA_ROOT!, "Elias Data").catch(() => null);

    res.json({
      roots: [
        ...(dataTree?.children?.length ? [dataTree] : []),
        ...(vaultTree?.children?.length ? [vaultTree] : []),
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/read?path=...&source=vault|data
router.get("/read", async (req, res) => {
  try {
    if (!VAULT_ROOT) await loadRoots();
    const filePath = req.query.path as string;
    const source = (req.query.source as string) || "data";
    if (!filePath) return res.status(400).json({ error: "path 参数是必填项。" });

    const root = source === "vault" ? VAULT_ROOT! : ELIAS_DATA_ROOT!;
    const fullPath = safeResolve(root, filePath);
    const content = await fs.readFile(fullPath, "utf8");
    res.json({ path: filePath, source, content });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/vault/write
router.post("/write", async (req, res) => {
  try {
    if (!ELIAS_DATA_ROOT) await loadRoots();
    const { filePath, content } = req.body as { filePath?: string; content?: string };
    if (!filePath) return res.status(400).json({ error: "filePath 是必填项。" });
    if (content === undefined) return res.status(400).json({ error: "content 是必填项。" });

    const fullPath = safeResolve(ELIAS_DATA_ROOT!, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");
    res.json({ ok: true, path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/vault/delete
router.delete("/delete", async (req, res) => {
  try {
    if (!ELIAS_DATA_ROOT) await loadRoots();
    const filePath = req.body.filePath as string;
    if (!filePath) return res.status(400).json({ error: "filePath 是必填项。" });

    const fullPath = safeResolve(ELIAS_DATA_ROOT!, filePath);
    await fs.unlink(fullPath);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/search?q=...
router.get("/search", async (req, res) => {
  try {
    if (!VAULT_ROOT) await loadRoots();
    const query = (req.query.q as string ?? "").toLowerCase();
    if (!query) return res.json({ results: [] });

    const results: { path: string; source: string; matches: string[] }[] = [];

    async function walk(dir: string, source: string) {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { await walk(full, source); continue; }
        if (!e.name.endsWith(".md")) continue;
        const content = await fs.readFile(full, "utf8");
        if (content.toLowerCase().includes(query)) {
          const rel = full.slice((source === "vault" ? VAULT_ROOT! : ELIAS_DATA_ROOT!).length + 1);
          const matchLines = content.split("\n")
            .filter((l) => l.toLowerCase().includes(query))
            .slice(0, 3)
            .map((l) => l.trim());
          results.push({ path: rel, source, matches: matchLines });
          if (results.length >= 20) return;
        }
      }
    }

    await walk(ELIAS_DATA_ROOT!, "data");
    await walk(VAULT_ROOT!, "vault");
    res.json({ results: results.slice(0, 20) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as vaultRouter };
