// ---------------------------------------------------------------------------
// GreetingBubble tests
// ---------------------------------------------------------------------------
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GreetingBubble } from "../../../app/frontend/js/features/live2d/GreetingBubble.js";

describe("GreetingBubble", () => {
  let bubble;
  let parent;
  let originalFetch;

  beforeEach(() => {
    bubble = new GreetingBubble("elias");
    parent = document.createElement("div");
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("stores persona on construction", () => {
    expect(bubble.persona).toBe("elias");
    const b2 = new GreetingBubble("wanshi");
    expect(b2.persona).toBe("wanshi");
  });

  it("defaults persona to elias", () => {
    const b = new GreetingBubble();
    expect(b.persona).toBe("elias");
  });

  it("starts with empty text and not visible", () => {
    expect(bubble.text).toBe("");
    expect(bubble.visible).toBe(false);
  });

  it("mount creates DOM element", () => {
    bubble.mount(parent);
    const el = parent.querySelector(".greeting-bubble");
    expect(el).not.toBeNull();
    expect(el.classList.contains("visible")).toBe(false);
  });

  it("unmount removes DOM element", () => {
    bubble.mount(parent);
    expect(parent.querySelector(".greeting-bubble")).not.toBeNull();
    bubble.unmount();
    expect(parent.querySelector(".greeting-bubble")).toBeNull();
  });

  it("show adds visible class", () => {
    bubble.mount(parent);
    bubble.show();
    expect(bubble.visible).toBe(true);
    const el = parent.querySelector(".greeting-bubble");
    expect(el.classList.contains("visible")).toBe(true);
  });

  it("hide removes visible class", () => {
    bubble.mount(parent);
    bubble.show();
    bubble.hide();
    expect(bubble.visible).toBe(false);
    const el = parent.querySelector(".greeting-bubble");
    expect(el.classList.contains("visible")).toBe(false);
  });

  it("sets persona setter triggers refresh", async () => {
    bubble.refresh = vi.fn();
    bubble.persona = "raw";
    expect(bubble.refresh).toHaveBeenCalled();
    expect(bubble.persona).toBe("raw");
  });

  it("refresh fetches greeting from API", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ greeting: "你好，指挥官。" }),
    });

    bubble.mount(parent);
    const result = await bubble.refresh();

    expect(fetch).toHaveBeenCalledWith("/api/home/greeting?persona=elias");
    expect(result).toBe("你好，指挥官。");
    expect(bubble.text).toBe("你好，指挥官。");
    expect(parent.querySelector(".greeting-bubble").textContent).toBe("你好，指挥官。");
  });

  it("refresh falls back on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    bubble.mount(parent);
    const result = await bubble.refresh();

    expect(result).toBe("嗯。");
    expect(bubble.text).toBe("嗯。");
  });

  it("refresh falls back on HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    bubble.mount(parent);
    const result = await bubble.refresh();

    expect(result).toBe("嗯。");
    expect(bubble.text).toBe("嗯。");
  });

  it("refresh updates DOM element content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ greeting: "唔…来了啊。" }),
    });

    bubble.mount(parent);
    await bubble.refresh();

    const el = parent.querySelector(".greeting-bubble");
    expect(el.textContent).toBe("唔…来了啊。");
  });

  it("refresh uses correct persona in URL", async () => {
    const rawBubble = new GreetingBubble("wanshi");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ greeting: "zzz" }),
    });

    await rawBubble.refresh();
    expect(fetch).toHaveBeenCalledWith("/api/home/greeting?persona=wanshi");
  });
});
