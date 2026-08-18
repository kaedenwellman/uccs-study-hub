// POST /api/register
// Body: { subscription?, reminders?, unsubscribe?, endpoint? }
//   - subscription: a PushSubscription JSON -> stored (keyed by endpoint)
//   - reminders: [{ key, title, body, fireAt }] -> replaces the future schedule
//   - unsubscribe + endpoint: removes that device's subscription
// Guarded by the x-app-token header.
import { redis, KEYS } from "./_redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers["x-app-token"];
  if (!process.env.APP_TOKEN || token !== process.env.APP_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};

  try {
    // Unsubscribe a device.
    if (body.unsubscribe && body.endpoint) {
      await redis.hdel(KEYS.subs, body.endpoint);
      return res.status(200).json({ ok: true, unsubscribed: true });
    }

    // Store / refresh this device's subscription.
    if (body.subscription && body.subscription.endpoint) {
      await redis.hset(KEYS.subs, {
        [body.subscription.endpoint]: body.subscription,
      });
    }

    // Replace the future schedule (leave any due-but-unsent entries intact).
    if (Array.isArray(body.reminders)) {
      const now = Date.now();

      // Remove existing future entries first so edits/deletes propagate.
      const existingFuture = await redis.zrange(
        KEYS.reminders,
        `(${now}`,
        "+inf",
        { byScore: true },
      );
      if (existingFuture.length) {
        await redis.zrem(KEYS.reminders, ...existingFuture);
        await redis.hdel(KEYS.rdata, ...existingFuture);
      }

      const future = body.reminders.filter(
        (r) => r && r.key && Number(r.fireAt) > now,
      );
      if (future.length) {
        await redis.zadd(
          KEYS.reminders,
          ...future.map((r) => ({ score: Number(r.fireAt), member: r.key })),
        );
        const rdata = {};
        for (const r of future) {
          rdata[r.key] = { title: r.title || "Study Hub", body: r.body || "" };
        }
        await redis.hset(KEYS.rdata, rdata);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
