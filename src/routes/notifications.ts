// ---------------------------------------------------------------------------
// Push Notification Subscriptions
// ---------------------------------------------------------------------------
// Stores browser push subscriptions in elias_data/push-subscriptions.json.
// The proactive module calls sendPush() to notify all subscribed devices.
// ---------------------------------------------------------------------------

import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import webpush from "web-push";

const router = Router();

// ---------------------------------------------------------------------------
// VAPID keys — generated once, stored in data.json
// ---------------------------------------------------------------------------

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (vapidKeys) return { publicKey: vapidKeys.publicKey, privateKey: vapidKeys.privateKey };

  const { PATHS } = await import("../../../../eliasCore/src/config.js");
  const dataPath = path.join(PATHS.base, "data.json");

  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.vapidPublicKey && data.vapidPrivateKey) {
      vapidKeys = {
        publicKey: data.vapidPublicKey as string,
        privateKey: data.vapidPrivateKey as string,
      };
      return vapidKeys;
    }
  } catch { /* data.json may not exist yet */ }

  // Generate new keys
  const newKeys = webpush.generateVAPIDKeys();
  vapidKeys = newKeys;
  // Save to data.json
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    data.vapidPublicKey = newKeys.publicKey;
    data.vapidPrivateKey = newKeys.privateKey;
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
  } catch {
    console.warn("[NOTIFICATIONS] Could not save VAPID keys to data.json");
  }

  return vapidKeys;
}

// ---------------------------------------------------------------------------
// Subscription storage
// ---------------------------------------------------------------------------

const SUBSCRIPTIONS_FILE = "push-subscriptions.json";

async function getSubscriptionsPath(): Promise<string> {
  const { PATHS } = await import("../../../../eliasCore/src/config.js");
  return path.join(PATHS.eliasData, SUBSCRIPTIONS_FILE);
}

async function loadSubscriptions(): Promise<webpush.PushSubscription[]> {
  try {
    const filePath = await getSubscriptionsPath();
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as webpush.PushSubscription[];
  } catch {
    return [];
  }
}

async function saveSubscriptions(subs: webpush.PushSubscription[]): Promise<void> {
  const filePath = await getSubscriptionsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(subs, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/notifications/subscribe — register a push subscription
router.post("/subscribe", async (req, res) => {
  try {
    const sub = req.body as webpush.PushSubscription;
    if (!sub.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    const subs = await loadSubscriptions();
    // Deduplicate by endpoint
    const filtered = subs.filter((s) => s.endpoint !== sub.endpoint);
    filtered.push(sub);
    await saveSubscriptions(filtered);

    res.json({ ok: true, count: filtered.length });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

// DELETE /api/notifications/unsubscribe — remove a subscription
router.delete("/subscribe", async (req, res) => {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });

    const subs = await loadSubscriptions();
    const filtered = subs.filter((s) => s.endpoint !== endpoint);
    await saveSubscriptions(filtered);

    res.json({ ok: true, count: filtered.length });
  } catch (err: unknown) {
    console.error("[ROUTE] Error:", err);
    res.status(500).json({ error: "操作失败，请稍后重试" });
  }
});

// ---------------------------------------------------------------------------
// Push sender — called by proactive module
// ---------------------------------------------------------------------------

/**
 * Send a push notification to all subscribed devices.
 * Called by the proactive module after generating a message.
 */
export async function sendPushNotification(
  title: string,
  body: string,
): Promise<{ sent: number; failed: number }> {
  const subs = await loadSubscriptions();
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const keys = await getVapidKeys();
  webpush.setVapidDetails(
    "mailto:elias@periodicmango.dev",
    keys.publicKey,
    keys.privateKey,
  );

  let sent = 0;
  let failed = 0;

  const payload = JSON.stringify({ title, body, icon: "/icon.svg" });

  const results = await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub, payload)),
  );

  for (const result of results) {
    if (result.status === "fulfilled") sent++;
    else {
      failed++;
      // Remove subscriptions that returned 410 (Gone — expired)
      if (
        result.reason &&
        typeof result.reason === "object" &&
        "statusCode" in result.reason &&
        (result.reason as { statusCode: number }).statusCode === 410
      ) {
        const idx = results.indexOf(result);
        if (idx >= 0) subs.splice(idx, 1);
      }
    }
  }

  // Save cleaned subscriptions
  if (failed > 0) await saveSubscriptions(subs);

  return { sent, failed };
}

export { router as notificationsRouter };
