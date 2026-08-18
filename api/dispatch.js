// GET/POST /api/dispatch  (pinged on a schedule by an external cron, e.g.
// cron-job.org — the free Vercel plan's built-in cron only runs once a day).
// Sends any reminders whose fireAt has passed, then removes them.
// Protected by CRON_SECRET, sent as an "Authorization: Bearer <secret>" header.
import webpush from "web-push";
import { redis, KEYS } from "./_redis.js";

function configureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@studyhub.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export default async function handler(req, res) {
  // Cron auth: Vercel sends "Authorization: Bearer <CRON_SECRET>".
  const auth = req.headers["authorization"] || "";
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: "VAPID keys not configured" });
  }
  configureVapid();

  const now = Date.now();

  try {
    // Reminders that are now due.
    const dueKeys = await redis.zrange(KEYS.reminders, 0, now, {
      byScore: true,
    });
    if (!dueKeys.length) {
      return res.status(200).json({ sent: 0, due: 0 });
    }

    // Current device subscriptions: { endpoint: subscriptionObject }.
    const subs = (await redis.hgetall(KEYS.subs)) || {};
    const endpoints = Object.keys(subs);

    let sent = 0;
    const deadEndpoints = new Set();

    for (const key of dueKeys) {
      const data = (await redis.hget(KEYS.rdata, key)) || {};
      const payload = JSON.stringify({
        title: data.title || "Study Hub",
        body: data.body || "",
        tag: key,
      });

      for (const endpoint of endpoints) {
        if (deadEndpoints.has(endpoint)) continue;
        try {
          await webpush.sendNotification(subs[endpoint], payload);
          sent++;
        } catch (err) {
          // 404/410 -> subscription is gone; drop it.
          if (err.statusCode === 404 || err.statusCode === 410) {
            deadEndpoints.add(endpoint);
          } else {
            console.warn("push send failed:", err.statusCode, err.body);
          }
        }
      }
    }

    // Clean up fired reminders and dead subscriptions.
    await redis.zrem(KEYS.reminders, ...dueKeys);
    await redis.hdel(KEYS.rdata, ...dueKeys);
    if (deadEndpoints.size) {
      await redis.hdel(KEYS.subs, ...deadEndpoints);
    }

    return res.status(200).json({
      sent,
      due: dueKeys.length,
      devices: endpoints.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
