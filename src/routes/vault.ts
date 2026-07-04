import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createLoader } from "../lazyLoad.js";

const router = Router();

interface TreeNode {
  name: string;
  path: string;
  type: "directory" | "file";
  children: TreeNode[];
}

const sharedLoader = createLoader(() => import("../../../eliasCore/src/helpers/tools/shared.js"));

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
    const shared = await sharedLoader();
    const vaultRoot = shared.VAULT_ROOT as string;
    const eliasDataRoot = shared.ELIAS_DATA_ROOT as string;

    async function tree(dir: string, name: string, maxDepth = 4, prefix = ""): Promise<TreeNode> {
      const node: TreeNode = { name, path: prefix || name, type: "directory", children: [] };
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
          node.children.push({ name: e.name, path: childPath, type: "file", children: [] });
        }
      }
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return node;
    }

    const vaultTree = await tree(vaultRoot, "Vault (Obsidian)").catch(() => null);
    const dataTree = await tree(eliasDataRoot, "Elias Data").catch(() => null);

    res.json({
      roots: [
        ...(dataTree?.children?.length ? [dataTree] : []),
        ...(vaultTree?.children?.length ? [vaultTree] : []),
      ],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /api/vault/read?path=...&source=vault|data
router.get("/read", async (req, res) => {
  try {
    const shared = await sharedLoader();
    const vaultRoot = shared.VAULT_ROOT as string;
    const eliasDataRoot = shared.ELIAS_DATA_ROOT as string;
    const filePath = req.query.path as string;
    const source = (req.query.source as string) || "data";
    if (!filePath) return res.status(400).json({ error: "path 参数是必填项。" });

    const root = source === "vault" ? vaultRoot : eliasDataRoot;
    const fullPath = safeResolve(root, filePath);
    const content = await fs.readFile(fullPath, "utf8");
    res.json({ path: filePath, source, content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: message });
  }
});

// POST /api/vault/write
router.post("/write", async (req, res) => {
  try {
    const shared = await sharedLoader();
    const eliasDataRoot = shared.ELIAS_DATA_ROOT as string;
    const { filePath, content } = req.body as { filePath?: string; content?: string };
    if (!filePath) return res.status(400).json({ error: "filePath 是必填项。" });
    if (content === undefined) return res.status(400).json({ error: "content 是必填项。" });

    const fullPath = safeResolve(eliasDataRoot, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");
    res.json({ ok: true, path: filePath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// DELETE /api/vault/delete
router.delete("/delete", async (req, res) => {
  try {
    const shared = await sharedLoader();
    const eliasDataRoot = shared.ELIAS_DATA_ROOT as string;
    const filePath = req.body.filePath as string;
    if (!filePath) return res.status(400).json({ error: "filePath 是必填项。" });

    const fullPath = safeResolve(eliasDataRoot, filePath);
    await fs.unlink(fullPath);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /api/vault/search?q=...
router.get("/search", async (req, res) => {
  try {
    const shared = await sharedLoader();
    const vaultRoot = shared.VAULT_ROOT as string;
    const eliasDataRoot = shared.ELIAS_DATA_ROOT as string;
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
        const root = source === "vault" ? vaultRoot : eliasDataRoot;
        if (content.toLowerCase().includes(query)) {
          const rel = full.slice(root.length + 1);
          const matchLines = content.split("\n")
            .filter((l) => l.toLowerCase().includes(query))
            .slice(0, 3)
            .map((l) => l.trim());
          results.push({ path: rel, source, matches: matchLines });
          if (results.length >= 20) return;
        }
      }
    }

    await walk(eliasDataRoot, "data");
    await walk(vaultRoot, "vault");
    res.json({ results: results.slice(0, 20) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as vaultRouter };
