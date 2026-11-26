"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionResponse } from "./types";

/**
 * Polls /api/session and keeps a clock offset so every device shows the
 * same countdown, driven by the server's endsAt.
 */
export function useSession(intervalMs = 2500, initial: SessionResponse | null = null) {
  const [data, setData] = useState<SessionResponse | null>(initial);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0); // serverTime - localTime
  const bestRtt = useRef(Infinity);

  const refresh = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const t1 = Date.now();
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SessionResponse;
      const rtt = t1 - t0;
      // Prefer the sample with the smallest round trip (most accurate), but keep adapting slowly.
      if (rtt <= bestRtt.current * 1.5 || rtt < 400) {
        bestRtt.current = Math.min(bestRtt.current, rtt);
        offsetRef.current = json.serverNow - (t0 + rtt / 2);
      }
      setData(json);
      setError(false);
      return json;
    } catch {
      setError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (alive) timer = setTimeout(loop, document.hidden ? intervalMs * 3 : intervalMs);
    };
    loop();
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, refresh]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { data, error, refresh, serverNow };
}

/** Re-renders every `ms` and returns ms remaining on the countdown. */
export function useCountdown(data: SessionResponse | null, serverNow: () => number, ms = 250) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  if (!data) return 0;
  if (data.status === "live" && data.endsAt) return Math.max(0, data.endsAt - serverNow());
  return data.remainingMs;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
