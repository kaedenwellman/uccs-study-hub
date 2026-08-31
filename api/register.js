// POST /api/register
// Body: { uid, subscription?, reminders?, unsubscribe?, endpoint? }
//   - uid: per-install id so each device only gets its own reminders
//   - subscription: a PushSubscription JSON -> stored (keyed by endpoint)
//   - reminders: [{ key, title, body, fireAt }] -> replaces the future schedule
//   - unsubscribe + endpoint: removes that device's subscription
// Guarded by the x-app-token header.
import { redis, USERS, safeUid, userKeys } from "./_redis.js";

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

  const uid = safeUid(body.uid);
  if (!uid) return res.status(400).json({ error: "Missing or invalid uid." });
  const K = userKeys(uid);

  try {
    // Unsubscribe a device.
    if (body.unsubscribe && body.endpoint) {
      await redis.hdel(K.subs, body.endpoint);
      return res.status(200).json({ ok: true, unsubscribed: true });
    }

    // Store / refresh this device's subscription.
    if (body.subscription && body.subscription.endpoint) {
      await redis.sadd(USERS, uid);
      await redis.hset(K.subs, { [body.subscription.endpoint]: body.subscription });
    }

    // Replace the future schedule (leave any due-but-unsent entries intact).
    if (Array.isArray(body.reminders)) {
      await redis.sadd(USERS, uid);
      const now = Date.now();

      const existingFuture = await redis.zrange(K.rem, `(${now}`, "+inf", {
        byScore: true,
      });
      if (existingFuture.length) {
        await redis.zrem(K.rem, ...existingFuture);
        await redis.hdel(K.rdata, ...existingFuture);
      }

      const future = body.reminders.filter(
        (r) => r && r.key && Number(r.fireAt) > now,
      );
      if (future.length) {
        await redis.zadd(
          K.rem,
          ...future.map((r) => ({ score: Number(r.fireAt), member: r.key })),
        );
        const rdata = {};
        for (const r of future) {
          rdata[r.key] = { title: r.title || "Study Hub", body: r.body || "" };
        }
        await redis.hset(K.rdata, rdata);
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
