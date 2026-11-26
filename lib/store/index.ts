import { createMemoryStore } from "./memoryStore";
import { createRedisStore } from "./redisStore";
import type { GiftStore } from "./types";

export type { GiftStore } from "./types";

const g = globalThis as unknown as { __giftStore?: GiftStore; __giftStoreWarned?: boolean };

/** Returns the active store: Redis when its env vars exist, otherwise in-memory (dev only). */
export function getStore(): GiftStore {
  if (g.__giftStore) return g.__giftStore;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    g.__giftStore = createRedisStore(url, token);
  } else {
    if (!g.__giftStoreWarned) {
      g.__giftStoreWarned = true;
      const msg = "[gift-drop] KV_REST_API_URL / KV_REST_API_TOKEN not set: using IN-MEMORY storage (local development only).";
      if (process.env.VERCEL) console.error(msg + " Add Upstash Redis in Vercel before the event!");
      else console.warn(msg);
    }
    g.__giftStore = createMemoryStore();
  }
  return g.__giftStore;
}
