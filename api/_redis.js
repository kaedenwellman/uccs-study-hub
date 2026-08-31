// Shared Upstash Redis client for the API functions.
// Works with either the Upstash marketplace integration
// (UPSTASH_REDIS_REST_*) or the older Vercel KV integration (KV_REST_API_*).
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Redis layout (per install/user, so notifications stay isolated):
//   users            (set)         all install ids
//   u:{uid}:subs     (hash)        endpoint -> subscription object
//   u:{uid}:rem      (sorted set)  reminder key -> score = fireAt (epoch ms)
//   u:{uid}:rdata    (hash)        reminder key -> { title, body }
export const USERS = "users";

// Install ids come from the client; keep them to a safe key charset.
export function safeUid(uid) {
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(uid) ? uid : null;
}

export function userKeys(uid) {
  return {
    subs: `u:${uid}:subs`,
    rem: `u:${uid}:rem`,
    rdata: `u:${uid}:rdata`,
  };
}
