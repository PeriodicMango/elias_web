// ---------------------------------------------------------------------------
// FeatureRegistry — discovery and lifecycle tests
// ---------------------------------------------------------------------------
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { Feature } from "../../../app/frontend/js/core/Feature.js";
import { FeatureRegistry } from "../../../app/frontend/js/core/FeatureRegistry.js";

// Simple concrete feature for testing
class MockFeature extends Feature {
  mounted = null;
  unmounted = false;

  async mount(container) { this.mounted = container; this.container = container; this.unmounted = false; }
  async unmount() { this.unmounted = true; this.container = null; }
}

describe("FeatureRegistry", () => {
  let registry;

  beforeEach(() => {
    FeatureRegistry.reset();
    registry = FeatureRegistry.instance;
  });

  it("is a singleton", () => {
    const a = FeatureRegistry.instance;
    const b = FeatureRegistry.instance;
    expect(a).toBe(b);
  });

  it("reset creates a new instance", () => {
    const a = FeatureRegistry.instance;
    FeatureRegistry.reset();
    const b = FeatureRegistry.instance;
    expect(a).not.toBe(b);
  });

  it("starts with empty list", () => {
    expect(registry.list()).toEqual([]);
  });

  it("registers a Feature instance", () => {
    const f = new MockFeature("test", "companion");
    registry.register(f);
    expect(registry.list()).toEqual(["test"]);
  });

  it("throws if non-Feature is registered", () => {
    expect(() => registry.register({})).toThrow(TypeError);
  });

  it("overwrites duplicate registration with warning", () => {
    const f1 = new MockFeature("test", "companion");
    const f2 = new MockFeature("test", "tool");
    registry.register(f1);
    registry.register(f2);
    expect(registry.list()).toEqual(["test"]);
    expect(registry.get("test").category).toBe("tool");
  });

  it("get returns undefined for non-existent feature", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("filters by category", () => {
    registry.register(new MockFeature("a", "companion"));
    registry.register(new MockFeature("b", "tool"));
    registry.register(new MockFeature("c", "companion"));
    registry.register(new MockFeature("d", "utility"));

    const companions = registry.byCategory("companion");
    expect(companions.length).toBe(2);
    expect(companions.map((f) => f.id).sort()).toEqual(["a", "c"]);
  });

  it("getTabs returns tab definitions from setTabs", () => {
    registry.setTabs([
      { id: "live2d", icon: "X", label: "L2D" },
      { id: "chat", icon: "C", label: "Chat" },
    ]);
    expect(registry.getTabs()).toEqual([
      { id: "live2d", icon: "X", label: "L2D" },
      { id: "chat", icon: "C", label: "Chat" },
    ]);
  });

  it("getTabs falls back to registered feature metadata", () => {
    registry.register(new MockFeature("test", "companion", { icon: "T", label: "TestF" }));
    // No setTabs call → derived from registered features
    expect(registry.getTabs().length).toBe(1);
    expect(registry.getTabs()[0].id).toBe("test");
  });

  it("getTabs from setTabs when called", () => {
    registry.register(new MockFeature("test", "companion"));
    registry.setTabs([{ id: "test", icon: "!", label: "T" }]);
    const tabs = registry.getTabs();
    expect(tabs).toEqual([{ id: "test", icon: "!", label: "T" }]);
  });

  it("activate mounts a feature and unmounts previous", async () => {
    const f1 = new MockFeature("a", "companion");
    const f2 = new MockFeature("b", "tool");
    registry.register(f1);
    registry.register(f2);

    const el = document.createElement("div");
    await registry.activate("a", el);
    expect(f1.mounted).toBe(el);
    expect(f1.unmounted).toBe(false);

    await registry.activate("b", el);
    expect(f1.unmounted).toBe(true);
    expect(f2.mounted).toBe(el);
  });

  it("activate same tab is a no-op", async () => {
    const f = new MockFeature("a", "companion");
    registry.register(f);

    await registry.activate("a", document.createElement("div"));
    expect(f.mountCalls).toBeUndefined(); // MockFeature has no mount counter
    // After first activation, activating again should not remount
    const mounted = f.mounted;
    await registry.activate("a", document.createElement("div"));
    expect(f.mounted).toBe(mounted); // same container, no re-mount
  });

  it("activate non-existent returns null", async () => {
    const result = await registry.activate("nope", document.createElement("div"));
    expect(result).toBeNull();
  });

  it("broadcast onResume calls all features", () => {
    const calls = [];
    class BroadcastFeature extends Feature {
      async mount() {}
      async unmount() {}
      onResume() { calls.push(this.id); }
    }
    registry.register(new BroadcastFeature("a", "companion"));
    registry.register(new BroadcastFeature("b", "tool"));

    registry.broadcast("onResume");
    expect(calls.sort()).toEqual(["a", "b"]);
  });

  it("broadcast onPause calls all features", () => {
    const calls = [];
    class BroadcastFeature extends Feature {
      async mount() {}
      async unmount() {}
      onPause() { calls.push(this.id); }
    }
    registry.register(new BroadcastFeature("x", "companion"));
    registry.register(new BroadcastFeature("y", "utility"));

    registry.broadcast("onPause");
    expect(calls.sort()).toEqual(["x", "y"]);
  });

  it("tick broadcasts to all features", () => {
    const calls = [];
    class TickFeature extends Feature {
      async mount() {}
      async unmount() {}
      onTimeTick(now) { calls.push({ id: this.id, time: now.getTime() }); }
    }
    registry.register(new TickFeature("t1", "companion"));
    registry.register(new TickFeature("t2", "tool"));

    const now = new Date("2026-07-06T12:00:00Z");
    registry.tick(now);
    expect(calls.length).toBe(2);
    expect(calls[0].time).toBe(now.getTime());
    expect(calls[1].time).toBe(now.getTime());
  });

  it("collectWidgetData aggregates from all features", () => {
    class WidgetFeature extends Feature {
      async mount() {}
      async unmount() {}
      getWidgetData() { return { value: this.id }; }
    }
    registry.register(new WidgetFeature("w1", "companion"));
    registry.register(new WidgetFeature("w2", "tool"));

    const data = registry.collectWidgetData();
    expect(data).toEqual({ w1: { value: "w1" }, w2: { value: "w2" } });
  });

  it("collectWidgetData skips null returns", () => {
    class NoWidgetFeature extends Feature {
      async mount() {}
      async unmount() {}
    }
    registry.register(new NoWidgetFeature("nw", "tool"));
    expect(registry.collectWidgetData()).toEqual({});
  });

  it("deactivate unmounts the active feature and clears state", async () => {
    const f = new MockFeature("a", "companion");
    registry.register(f);

    await registry.activate("a", document.createElement("div"));
    expect(f.mounted).not.toBeNull();
    expect(f.unmounted).toBe(false);

    await registry.deactivate();
    expect(f.unmounted).toBe(true);
  });

  it("deactivate is safe when no feature is active", async () => {
    // Should not throw
    await registry.deactivate();
  });

  it("deactivate then re-activate allows fresh mount", async () => {
    const f = new MockFeature("a", "companion");
    registry.register(f);

    const el = document.createElement("div");
    await registry.activate("a", el);
    await registry.deactivate();
    expect(f.unmounted).toBe(true);

    // Re-activate: should mount fresh (not skip due to same-id guard)
    const el2 = document.createElement("div");
    await registry.activate("a", el2);
    expect(f.mounted).toBe(el2);
    expect(f.unmounted).toBe(false);
  });
});
