// GET/POST /api/dispatch  (pinged on a schedule by an external cron, e.g.
// cron-job.org — the free Vercel plan's built-in cron only runs once a day).
// For each install, sends any reminders whose fireAt has passed, then removes
// them. Reminders are scoped per install, so devices only get their own.
// Protected by CRON_SECRET, sent as an "Authorization: Bearer <secret>" header.
import webpush from "web-push";
import { redis, USERS, userKeys } from "./_redis.js";

function configureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@studyhub.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: "VAPID keys not configured" });
  }
  configureVapid();

  const now = Date.now();

  try {
    const uids = (await redis.smembers(USERS)) || [];
    let sent = 0;
    let due = 0;
    let devices = 0;

    for (const uid of uids) {
      const K = userKeys(uid);
      const dueKeys = await redis.zrange(K.rem, 0, now, { byScore: true });
      if (!dueKeys.length) continue;
      due += dueKeys.length;

      const subs = (await redis.hgetall(K.subs)) || {};
      const endpoints = Object.keys(subs);
      devices += endpoints.length;
      const dead = new Set();

      for (const key of dueKeys) {
        const data = (await redis.hget(K.rdata, key)) || {};
        const payload = JSON.stringify({
          title: data.title || "Study Hub",
          body: data.body || "",
          tag: key,
        });
        for (const endpoint of endpoints) {
          if (dead.has(endpoint)) continue;
          try {
            await webpush.sendNotification(subs[endpoint], payload);
            sent++;
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) dead.add(endpoint);
            else console.warn("push send failed:", err.statusCode);
          }
        }
      }

      await redis.zrem(K.rem, ...dueKeys);
      await redis.hdel(K.rdata, ...dueKeys);
      if (dead.size) await redis.hdel(K.subs, ...dead);
    }

    return res.status(200).json({ sent, due, devices, users: uids.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
