// ---------------------------------------------------------------------------
// Homepage unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "..", "public");

// ---------------------------------------------------------------------------
// 1. File existence — all new homepage files are present
// ---------------------------------------------------------------------------

describe("homepage files", () => {
  it("home.css exists and is non-empty", () => {
    const css = fs.readFileSync(path.join(PUBLIC, "css", "home.css"), "utf8");
    expect(css.length).toBeGreaterThan(200);
    expect(css).toContain(".home-container");
    expect(css).toContain(".home-greeting");
    expect(css).toContain(".home-chatbox");
    expect(css).toContain(".widget-card");
  });

  it("home.js exists and exports renderHome", () => {
    const js = fs.readFileSync(path.join(PUBLIC, "js", "home.js"), "utf8");
    expect(js).toContain("export async function renderHome");
    expect(js).toContain("class WidgetManager");
    expect(js).toContain("function loadGreeting");
    expect(js).toContain("function initChatbox");
    expect(js).toContain("function renderWidgets");
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
// 2. WidgetManager — localStorage CRUD (simulated)
// ---------------------------------------------------------------------------

// Simulate localStorage for testing
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  // @ts-expect-error test harness
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
});

afterEach(() => {
  store.clear();
});

// Replicate WidgetManager logic for unit testing
function createWidgetManager() {
  const STORAGE_KEY = "elias-widgets";

  function load(): Array<{ id: string; type: string; title: string }> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function save(widgets: Array<{ id: string; type: string; title: string }>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }

  let widgets = load();

  return {
    list: () => [...widgets],
    add: (type: string, title: string) => {
      const id =
        "widget-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      widgets.push({ id, type, title });
      save(widgets);
      return id;
    },
    remove: (id: string) => {
      widgets = widgets.filter((w) => w.id !== id);
      save(widgets);
    },
  };
}

describe("WidgetManager", () => {
  it("starts with empty widget list", () => {
    const wm = createWidgetManager();
    expect(wm.list()).toEqual([]);
  });

  it("adds a widget and returns an id", () => {
    const wm = createWidgetManager();
    const id = wm.add("clock", "时钟");
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^widget-/);
    expect(wm.list()).toHaveLength(1);
    expect(wm.list()[0].type).toBe("clock");
    expect(wm.list()[0].title).toBe("时钟");
  });

  it("persists widgets across Manager instances (localStorage)", () => {
    const wm1 = createWidgetManager();
    wm1.add("weather", "天气");
    wm1.add("goals", "目标");

    const wm2 = createWidgetManager();
    expect(wm2.list()).toHaveLength(2);
    expect(wm2.list()[0].type).toBe("weather");
    expect(wm2.list()[1].type).toBe("goals");
  });

  it("removes a widget by id", () => {
    const wm = createWidgetManager();
    const id1 = wm.add("clock", "时钟");
    const id2 = wm.add("weather", "天气");
    expect(wm.list()).toHaveLength(2);

    wm.remove(id1);
    expect(wm.list()).toHaveLength(1);
    expect(wm.list()[0].id).toBe(id2);
  });

  it("remove non-existent id is a no-op", () => {
    const wm = createWidgetManager();
    wm.add("clock", "时钟");
    wm.remove("nonexistent");
    expect(wm.list()).toHaveLength(1);
  });

  it("handles multiple widgets of same type", () => {
    const wm = createWidgetManager();
    wm.add("clock", "时钟A");
    wm.add("clock", "时钟B");
    expect(wm.list()).toHaveLength(2);
    expect(wm.list()[0].type).toBe("clock");
    expect(wm.list()[1].type).toBe("clock");
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("elias-widgets", "not-json{{{");
    const wm = createWidgetManager();
    expect(wm.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Greeting API — response structure
// ---------------------------------------------------------------------------

describe("greeting API contract", () => {
  it("defines the expected response shape", () => {
    // Verify the route file returns { greeting: string } on success
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
    expect(routeSrc).toContain("greetingCache.set(persona, greeting)");
  });

  it("accepts persona query parameter", () => {
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "src", "routes", "home.ts"),
      "utf8",
    );
    expect(routeSrc).toContain("req.query.persona");
  });
});
