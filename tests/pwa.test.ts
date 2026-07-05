// ---------------------------------------------------------------------------
// PWA unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "..", "public");

// ---------------------------------------------------------------------------
// 1. manifest.json
// ---------------------------------------------------------------------------

describe("manifest.json", () => {
  const manifestPath = path.join(PUBLIC, "manifest.json");

  it("exists", () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it("is valid JSON", () => {
    const raw = fs.readFileSync(manifestPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("has required PWA fields", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(typeof m.theme_color).toBe("string");
  });

  it("has a valid theme_color hex value", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(m.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("has a valid background_color hex value", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(m.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("has icons array with at least one entry", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(1);
    expect(m.icons[0].src).toBeTruthy();
    expect(m.icons[0].sizes).toBeTruthy();
  });

  it("has display set to standalone", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(m.display).toBe("standalone");
  });

  it("has orientation set", () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(m.orientation).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. service-worker.js
// ---------------------------------------------------------------------------

describe("service-worker.js", () => {
  const swPath = path.join(PUBLIC, "service-worker.js");

  it("exists and is non-empty", () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const content = fs.readFileSync(swPath, "utf8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("defines a cache name", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toMatch(/CACHE_NAME\s*=/);
  });

  it("handles install event", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('addEventListener("install"');
    expect(sw).toContain("event.waitUntil");
  });

  it("handles activate event", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('addEventListener("activate"');
    expect(sw).toContain("caches.delete");
  });

  it("handles fetch event", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('addEventListener("fetch"');
  });

  it("pre-caches index.html", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain("/index.html");
  });

  it("pre-caches main.css", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain("/css/main.css");
  });

  it("pre-caches home.css", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain("/css/home.css");
  });

  it("pre-caches JS files", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain("/js/api.js");
    expect(sw).toContain("/js/app.js");
    expect(sw).toContain("/js/home.js");
  });

  it("skips auth routes (pass-through to network)", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain("/auth");
  });

  it("has network-first strategy for API routes", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain("/api");
  });

  it("has offline navigation fallback", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('mode === "navigate"');
  });
});

// ---------------------------------------------------------------------------
// 3. index.html PWA meta tags
// ---------------------------------------------------------------------------

describe("index.html PWA meta tags", () => {
  const htmlPath = path.join(PUBLIC, "index.html");
  let html: string;

  beforeAll(() => {
    html = fs.readFileSync(htmlPath, "utf8");
  });

  it("links to manifest.json", () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.json">');
  });

  it("has apple-mobile-web-app-capable meta tag", () => {
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('content="yes"');
  });

  it("has theme-color meta tag", () => {
    expect(html).toContain('name="theme-color"');
  });

  it("has apple-mobile-web-app-status-bar-style meta tag", () => {
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
  });

  it("has apple-mobile-web-app-title meta tag", () => {
    expect(html).toContain('name="apple-mobile-web-app-title"');
  });

  it("has apple-touch-icon link", () => {
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it("registers service worker", () => {
    expect(html).toContain("navigator.serviceWorker.register");
    expect(html).toContain("/service-worker.js");
  });

  it("uses icon.svg as favicon", () => {
    expect(html).toContain('/icon.svg');
    expect(html).not.toContain('data:image/svg+xml,');
  });
});

// ---------------------------------------------------------------------------
// 4. icon.svg
// ---------------------------------------------------------------------------

describe("icon.svg", () => {
  const iconPath = path.join(PUBLIC, "icon.svg");

  it("exists and is non-empty", () => {
    expect(fs.existsSync(iconPath)).toBe(true);
    const content = fs.readFileSync(iconPath, "utf8");
    expect(content.length).toBeGreaterThan(50);
  });

  it("is valid SVG with xmlns", () => {
    const content = fs.readFileSync(iconPath, "utf8");
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
    expect(content).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("has viewBox", () => {
    const content = fs.readFileSync(iconPath, "utf8");
    expect(content).toContain("viewBox");
  });

  it("has correct size (512x512)", () => {
    const content = fs.readFileSync(iconPath, "utf8");
    expect(content).toContain('width="512"');
    expect(content).toContain('height="512"');
  });
});
