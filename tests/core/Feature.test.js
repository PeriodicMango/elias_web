// ---------------------------------------------------------------------------
// Feature base class — contract tests
// ---------------------------------------------------------------------------
// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { Feature } from "../../../app/frontend/js/core/Feature.js";

// Concrete implementation for testing
class TestFeature extends Feature {
  mountCalls = 0;
  unmountCalls = 0;
  resumeCalls = 0;
  pauseCalls = 0;
  tickCalls = 0;
  lastTick = null;

  async mount(container) {
    this.mountCalls++;
    this.container = container;
  }

  async unmount() {
    this.unmountCalls++;
    this.container = null;
  }

  onResume() { this.resumeCalls++; }
  onPause()  { this.pauseCalls++; }
  onTimeTick(now) { this.tickCalls++; this.lastTick = now; }
}

class NoImplFeature extends Feature {
  constructor() { super("noimpl", "tool"); }
  // Does NOT implement mount/unmount — should throw
}

describe("Feature base class", () => {
  it("stores id, category, and config", () => {
    const f = new TestFeature("test-feature", "companion", { foo: 42 });
    expect(f.id).toBe("test-feature");
    expect(f.category).toBe("companion");
    expect(f.config.foo).toBe(42);
  });

  it("defaults container to null", () => {
    const f = new TestFeature("test", "tool");
    expect(f.container).toBeNull();
  });

  it("throws if mount() is not implemented", async () => {
    const f = new NoImplFeature();
    await expect(f.mount(document.createElement("div"))).rejects.toThrow("mount() not implemented");
  });

  it("throws if unmount() is not implemented", async () => {
    const f = new NoImplFeature();
    await expect(f.unmount()).rejects.toThrow("unmount() not implemented");
  });

  it("getWidgetData returns null by default", () => {
    const f = new TestFeature("test", "tool");
    expect(f.getWidgetData()).toBeNull();
  });

  it("overridable getWidgetData works", () => {
    class WithWidget extends TestFeature {
      getWidgetData() { return { key: "value" }; }
    }
    const f = new WithWidget("test", "tool");
    expect(f.getWidgetData()).toEqual({ key: "value" });
  });

  it("calls mount with container and sets this.container", async () => {
    const f = new TestFeature("test", "tool");
    const el = document.createElement("div");
    await f.mount(el);
    expect(f.mountCalls).toBe(1);
    expect(f.container).toBe(el);
  });

  it("calls unmount and clears container", async () => {
    const f = new TestFeature("test", "tool");
    await f.mount(document.createElement("div"));
    await f.unmount();
    expect(f.unmountCalls).toBe(1);
    expect(f.container).toBeNull();
  });

  it("lifecycle hooks are no-op by default on base class", () => {
    const f = new Feature("base", "utility", {});
    // Should not throw
    f.onResume();
    f.onPause();
    f.onTimeTick(new Date());
  });

  it("lifecycle hooks are called on subclass", () => {
    const f = new TestFeature("test", "companion");
    f.onResume();
    f.onPause();
    f.onTimeTick(new Date("2026-01-01T12:00:00Z"));
    expect(f.resumeCalls).toBe(1);
    expect(f.pauseCalls).toBe(1);
    expect(f.tickCalls).toBe(1);
    expect(f.lastTick).toBeInstanceOf(Date);
  });
});
