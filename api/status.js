// GET /api/status  — diagnostic. Reports how many devices are subscribed and
// how many reminders are scheduled, so we can tell whether the phone actually
// registered for push. Protected by CRON_SECRET (same Bearer token as dispatch).
import { redis, KEYS } from "./_redis.js";

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = Date.now();
    const devices = await redis.hlen(KEYS.subs);
    const reminders = await redis.zcard(KEYS.reminders);
    const dueNow = await redis.zcount(KEYS.reminders, 0, now);

    // Soonest upcoming reminder, if any.
    const soonest = await redis.zrange(KEYS.reminders, 0, 0, {
      withScores: true,
    });
    let next = null;
    if (soonest.length >= 2) {
      const fireAt = Number(soonest[1]);
      next = {
        key: soonest[0],
        fireAt,
        inMinutes: Math.round((fireAt - now) / 60000),
      };
    }

    return res.status(200).json({
      devices, // push subscriptions stored (your phone should be >= 1)
      reminders, // total reminders scheduled
      dueNow, // reminders ready to fire right now
      next, // soonest upcoming reminder
      now,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
