// Shared Upstash Redis client for the API functions.
// Works with either the Upstash marketplace integration
// (UPSTASH_REDIS_REST_*) or the older Vercel KV integration (KV_REST_API_*).
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Redis layout:
//   subs      (hash)        field = subscription endpoint, value = subscription object
//   reminders (sorted set)  member = reminder key, score = fireAt (epoch ms)
//   rdata     (hash)        field = reminder key, value = { title, body }
export const KEYS = { subs: "subs", reminders: "reminders", rdata: "rdata" };
