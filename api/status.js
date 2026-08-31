// GET /api/status  — diagnostic. Aggregates across all installs: how many
// devices are subscribed and how many reminders are scheduled. Pass ?uid=... to
// scope to one install. Protected by CRON_SECRET (Bearer token).
import { redis, USERS, safeUid, userKeys } from "./_redis.js";

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = Date.now();
    const one = safeUid(req.query?.uid);
    const uids = one ? [one] : (await redis.smembers(USERS)) || [];

    let devices = 0;
    let reminders = 0;
    let dueNow = 0;
    let soonest = null;

    for (const uid of uids) {
      const K = userKeys(uid);
      devices += await redis.hlen(K.subs);
      reminders += await redis.zcard(K.rem);
      dueNow += await redis.zcount(K.rem, 0, now);
      const next = await redis.zrange(K.rem, 0, 0, { withScores: true });
      if (next.length >= 2) {
        const fireAt = Number(next[1]);
        if (!soonest || fireAt < soonest.fireAt) {
          soonest = { fireAt, inMinutes: Math.round((fireAt - now) / 60000) };
        }
      }
    }

    return res.status(200).json({
      users: uids.length,
      devices,
      reminders,
      dueNow,
      next: soonest,
      now,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
