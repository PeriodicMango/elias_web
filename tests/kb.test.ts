/**
 * KB / Vault API tests
 * Usage: npx tsx tests/kb.test.ts [base-url]
 */

const BASE = process.argv[2] || "http://localhost:3457";

function log(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`Testing KB APIs: ${BASE}\n`);

  let passed = 0;
  let failed = 0;

  // ---- Tree ----
  console.log("=== /api/vault/tree ===");
  let treeData: any;
  {
    const res = await fetch(`${BASE}/api/vault/tree`);
    const ok = res.status === 200;
    log("GET /api/vault/tree → 200", ok);
    if (ok) passed++; else { failed++; console.log("  status:", res.status); }

    treeData = await res.json();
    log("  has roots array", Array.isArray(treeData.roots));
    if (Array.isArray(treeData.roots)) passed++; else failed++;

    if (treeData.roots.length > 0) {
      log(`  roots count > 0 (${treeData.roots.length})`, true);
      passed++;

      const root = treeData.roots[0];
      log("  root has name", !!root.name, root.name);
      if (root.name) passed++; else failed++;
      log("  root has type", root.type === "directory", root.type);
      if (root.type === "directory") passed++; else failed++;
      log("  root has children array", Array.isArray(root.children));
      if (Array.isArray(root.children)) passed++; else failed++;

      // Find a .md file
      let foundFile: { path: string; name: string } | null = null;
      function findFile(node: any) {
        if (foundFile) return;
        if (node.type === "file" && node.name.endsWith(".md")) {
          foundFile = { path: node.path, name: node.name };
          return;
        }
        if (node.children) {
          for (const c of node.children) findFile(c);
        }
      }
      for (const r of treeData.roots) findFile(r);
      log(`  found .md file in tree`, !!foundFile, foundFile?.path || "none");
      if (foundFile) {
        passed++;

        // Try reading the file from elias_data
        console.log("\n=== /api/vault/read ===");
        const readRes = await fetch(
          `${BASE}/api/vault/read?path=${encodeURIComponent(foundFile.path)}&source=data`
        );
        log(`GET /api/vault/read?path=${foundFile.path} → ${readRes.status}`, readRes.status === 200);
        if (readRes.status === 200) passed++; else failed++;

        const readData = await readRes.json();
        log("  has content", typeof readData.content === "string" && readData.content.length > 0,
          `length: ${readData.content?.length || 0}`);
        if (readData.content) passed++; else failed++;

        // Also try reading from vault source
        console.log("\n=== /api/vault/read (vault) ===");
        const vaultRes = await fetch(
          `${BASE}/api/vault/read?path=${encodeURIComponent(foundFile.path)}&source=vault`
        );
        log(`GET (vault source) → ${vaultRes.status}`, [200, 404].includes(vaultRes.status));
        if ([200, 404].includes(vaultRes.status)) passed++; else failed++;
      } else {
        log("  no .md files in tree — skipping read tests", true);
        passed++;
      }
    } else {
      log("  roots is empty — skipping", true);
      passed++;
    }
  }

  // ---- Search ----
  console.log("\n=== /api/vault/search ===");
  {
    const res = await fetch(`${BASE}/api/vault/search?q=test`);
    log(`GET /api/vault/search?q=test → ${res.status}`, res.status === 200);
    if (res.status === 200) passed++; else failed++;

    const data = await res.json();
    log("  has results array", Array.isArray(data.results));
    if (Array.isArray(data.results)) passed++; else failed++;
  }

  // ---- Write + Delete (on elias_data) ----
  console.log("\n=== /api/vault/write + delete ===");
  {
    const testPath = "_test_kb_unit_test.md";
    const testContent = "---\ntags:\n  - test\n---\n\n- [2026-06-28] Unit test entry.";

    // Write
    const writeRes = await fetch(`${BASE}/api/vault/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: testPath, content: testContent }),
    });
    log(`POST /api/vault/write → ${writeRes.status}`, writeRes.status === 200, `path: ${testPath}`);
    if (writeRes.status === 200) passed++; else failed++;

    // Read back
    const readBack = await fetch(
      `${BASE}/api/vault/read?path=${encodeURIComponent(testPath)}&source=data`
    );
    const rbData = await readBack.json();
    log("  read back matches", rbData.content === testContent);
    if (rbData.content === testContent) passed++; else failed++;

    // Delete
    const delRes = await fetch(`${BASE}/api/vault/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: testPath }),
    });
    log(`DELETE /api/vault/delete → ${delRes.status}`, delRes.status === 200);
    if (delRes.status === 200) passed++; else failed++;

    // Verify deleted
    const verifyDel = await fetch(
      `${BASE}/api/vault/read?path=${encodeURIComponent(testPath)}&source=data`
    );
    log("  verify deleted (404)", verifyDel.status === 404);
    if (verifyDel.status === 404) passed++; else failed++;
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
