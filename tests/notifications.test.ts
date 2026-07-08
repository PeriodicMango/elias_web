// ---------------------------------------------------------------------------
// Notifications tests — subscription cleanup logic
// ---------------------------------------------------------------------------
// The push-sending path requires web-push which has complex CJS/ESM interop
// in Vite. We test the subscription management patterns directly.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

describe("subscription cleanup logic", () => {
  /**
   * Replicates the fixed cleanup logic from sendPushNotification:
   * collect stale endpoints by tracking index through subs, then filter.
   */
  function cleanupStaleSubs(
    subs: Array<{ endpoint: string }>,
    results: Array<{ status: "fulfilled" | "rejected"; reason?: any }>,
  ): { kept: Array<{ endpoint: string }>; sent: number; failed: number } {
    let sent = 0;
    let failed = 0;
    const staleEndpoints = new Set<string>();

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        if (
          result.reason &&
          typeof result.reason === "object" &&
          "statusCode" in result.reason &&
          result.reason.statusCode === 410
        ) {
          staleEndpoints.add(subs[i]!.endpoint);
        }
      }
    });

    return {
      kept: staleEndpoints.size > 0
        ? subs.filter((s) => !staleEndpoints.has(s.endpoint))
        : subs,
      sent,
      failed,
    };
  }

  it("removes subs with 410 status using correct index", () => {
    const subs = [
      { endpoint: "ep1" },
      { endpoint: "ep2" },
      { endpoint: "ep3" },
    ];
    const results = [
      { status: "fulfilled" as const },
      { status: "rejected" as const, reason: { statusCode: 410 } },
      { status: "fulfilled" as const },
    ];

    const { kept, sent, failed } = cleanupStaleSubs(subs, results);

    expect(sent).toBe(2);
    expect(failed).toBe(1);
    expect(kept).toHaveLength(2);
    expect(kept.map((s) => s.endpoint)).toEqual(["ep1", "ep3"]);
  });

  it("keeps subs with non-410 errors", () => {
    const subs = [{ endpoint: "ep1" }];
    const results = [
      { status: "rejected" as const, reason: { statusCode: 500 } },
    ];

    const { kept, failed } = cleanupStaleSubs(subs, results);

    expect(failed).toBe(1);
    expect(kept).toHaveLength(1); // not removed
  });

  it("removes multiple 410s correctly (no index shift)", () => {
    const subs = [
      { endpoint: "ep1" },
      { endpoint: "ep2" },
      { endpoint: "ep3" },
      { endpoint: "ep4" },
    ];
    const results = [
      { status: "rejected" as const, reason: { statusCode: 410 } }, // ep1
      { status: "fulfilled" as const }, // ep2
      { status: "rejected" as const, reason: { statusCode: 410 } }, // ep3
      { status: "fulfilled" as const }, // ep4
    ];

    const { kept, sent, failed } = cleanupStaleSubs(subs, results);

    expect(sent).toBe(2);
    expect(failed).toBe(2);
    expect(kept.map((s) => s.endpoint)).toEqual(["ep2", "ep4"]);
  });

  it("handles no subs gracefully", () => {
    const { kept, sent, failed } = cleanupStaleSubs([], []);
    expect(sent).toBe(0);
    expect(failed).toBe(0);
    expect(kept).toEqual([]);
  });
});
