// ---------------------------------------------------------------------------
// Homepage unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "..", "..", "app", "frontend");

// ---------------------------------------------------------------------------
// 1. File existence — all new homepage files are present
// ---------------------------------------------------------------------------

describe("homepage files", () => {
  it("home.css exists and is non-empty", () => {
    const css = fs.readFileSync(path.join(PUBLIC, "css", "home.css"), "utf8");
    expect(css.length).toBeGreaterThan(200);
    expect(css).toContain(".home-container");
    expect(css).toContain(".home-greeting");
  });

  it("home.js exists and exports renderHome", () => {
    const js = fs.readFileSync(path.join(PUBLIC, "js", "home.js"), "utf8");
    expect(js).toContain("export async function renderHome");
    expect(js).toContain("function loadGreeting");
  });

  it("home.ts route file exists", () => {
    const ts = fs.readFileSync(
      path.resolve(__dirname, "..", "src", "routes", "home.ts"),
      "utf8",
    );
    expect(ts).toContain("homeRouter");
    expect(ts).toContain("/greeting");
  });

  it("index.html includes home.css and home.js", () => {
    const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
    expect(html).toContain("home.css");
    expect(html).toContain("home.js");
  });

  it("server.ts registers /api/home route", () => {
    const ts = fs.readFileSync(
      path.resolve(__dirname, "..", "src", "server.ts"),
      "utf8",
    );
    expect(ts).toContain("homeRouter");
    expect(ts).toContain("/api/home");
  });
});

// ---------------------------------------------------------------------------
// 2. Greeting API — response structure
// ---------------------------------------------------------------------------

describe("greeting API contract", () => {
  it("defines the expected response shape", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "src", "routes", "home.ts"),
      "utf8",
    );
    expect(routeSrc).toContain('res.json({ greeting');
    expect(routeSrc).toContain("greetingCache");
    expect(routeSrc).toContain("assemblePrompt");
    expect(routeSrc).toContain("getMasterTitle");
  });

  it("caches greetings per persona", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "src", "routes", "home.ts"),
      "utf8",
    );
    expect(routeSrc).toContain("greetingCache.get(persona)");
    expect(routeSrc).toContain("greetingCache.set(persona, { greeting");
  });

  it("accepts persona query parameter", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "src", "routes", "home.ts"),
      "utf8",
    );
    expect(routeSrc).toContain("req.query.persona");
  });
});
