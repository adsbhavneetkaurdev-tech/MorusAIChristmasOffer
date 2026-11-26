"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { formatClock } from "@/lib/labels";
import { playJackpotPhone, playUnwrap, setSoundEnabled, unlockAudio } from "@/lib/sound";
import type { RevealPrize, SessionResponse } from "@/lib/types";
import { useCountdown, useSession } from "@/lib/useSession";
import { ClaimFormScreen, ClosedScreen, ConfirmScreen, PhoneShell, RevealScreen, UnwrapScreen, type ClaimValues } from "./Screens";

type Stage = "home" | "opening" | "reveal" | "form" | "done" | "all_claimed";

interface Saved {
  runId: string;
  allocId: string;
  prize: RevealPrize;
  code?: string;
}

const DEVICE_KEY = "gd_device";
const STATE_KEY = "gd_gift";
const SOUND_KEY = "gd_sound";

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}

function getDeviceId(): string {
  let id = safeGet(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    safeSet(DEVICE_KEY, id);
  }
  return id;
}

export function GiftApp() {
  const [stage, setStage] = useState<Stage>("home");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [restored, setRestored] = useState(false);
  const deviceId = useRef<string>("");

  // Poll faster before the gift is unwrapped; slower afterwards (only the countdown matters then).
  const { data, refresh, serverNow } = useSession(saved ? 8000 : 2500);
  const remainingMs = useCountdown(data, serverNow, 500);
  const remaining = formatClock(remainingMs);

  // Sound preference
  useEffect(() => {
    const s = safeGet(SOUND_KEY);
    const on = s !== "off";
    setSoundOn(on);
    setSoundEnabled(on);
  }, []);
  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    setSoundEnabled(on);
    safeSet(SOUND_KEY, on ? "on" : "off");
    if (on) unlockAudio();
  };

  const persist = useCallback((s: Saved | null) => {
    setSaved(s);
    safeSet(STATE_KEY, s ? JSON.stringify(s) : null);
  }, []);

  // Restore after refresh, once we know the current run.
  const runId = data?.runId;
  useEffect(() => {
    if (!runId || restored) return;
    deviceId.current = getDeviceId();
    let local: Saved | null = null;
    try {
      local = JSON.parse(safeGet(STATE_KEY) ?? "null");
    } catch {
      local = null;
    }
    if (local && local.runId !== runId) local = null; // rehearsal reset happened
    if (local) {
      setSaved(local);
      setStage(local.code ? "done" : "reveal");
    }
    const q = new URLSearchParams({ deviceId: deviceId.current });
    if (local?.allocId) q.set("allocId", local.allocId);
    fetch(`/api/device?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res) return;
        if (res.allocation) {
          const s: Saved = { runId, allocId: res.allocation.allocId, prize: res.allocation.prize, code: res.claim?.code };
          persist(s);
          setStage(s.code ? "done" : "reveal");
        } else if (local) {
          persist(null);
          setStage("home");
        }
      })
      .catch(() => {})
      .finally(() => setRestored(true));
  }, [runId, restored, persist]);

  // A rehearsal reset while the page is open: start over.
  useEffect(() => {
    if (saved && runId && saved.runId !== runId) {
      persist(null);
      setStage("home");
    }
  }, [runId, saved, persist]);

  const unwrap = async () => {
    if (busy) return;
    unlockAudio(); // must happen inside the tap
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unwrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId.current || getDeviceId() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 410) {
        setStage("all_claimed");
        return;
      }
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please tap again.");
        refresh();
        return;
      }
      const s: Saved = { runId: data?.runId ?? "", allocId: body.allocId, prize: body.prize };
      persist(s);
      if (body.existing) {
        setStage("reveal");
        return;
      }
      setStage("opening");
      playUnwrap();
      const jackpot = !!body.prize?.isJackpot;
      setTimeout(() => {
        burstConfetti(jackpot);
        if (jackpot) setTimeout(playJackpotPhone, 150);
      }, 1050);
      setTimeout(() => setStage("reveal"), 1800);
    } catch {
      setError("Connection hiccup. Please tap again.");
    } finally {
      setBusy(false);
    }
  };

  const submitClaim = async (v: ClaimValues) => {
    if (!saved) return;
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId.current || getDeviceId(), allocId: saved.allocId, ...v }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { fields: body.fields, error: body.error ?? "Something went wrong. Please try again." };
      persist({ ...saved, code: body.code });
      setStage("done");
      window.scrollTo({ top: 0 });
    } catch {
      return { error: "Connection hiccup. Please try again, your details are still here." };
    }
  };

  const another = () => {
    persist(null);
    setStage("home");
  };

  if (!data) {
    return (
      <PhoneShell>
        <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-evergreen-line border-t-gold" />
        </div>
      </PhoneShell>
    );
  }

  const config = data.publicConfig;

  if (stage === "form" && saved) {
    return <ClaimFormScreen config={config} prize={saved.prize} onSubmit={submitClaim} />;
  }
  if (stage === "done" && saved?.code) {
    return <ConfirmScreen config={config} code={saved.code} prize={saved.prize} onAnother={config.onePerDevice ? undefined : another} />;
  }
  if ((stage === "opening" || stage === "reveal") && saved) {
    return (
      <PhoneShell soundOn={soundOn} onToggleSound={toggleSound}>
        <RevealScreen
          config={config}
          prize={saved.prize}
          phase={stage === "opening" ? "opening" : "revealed"}
          remaining={remaining}
          closed={data.status === "closed" || remainingMs <= 0}
          onClaim={() => {
            setStage("form");
            window.scrollTo({ top: 0 });
          }}
        />
      </PhoneShell>
    );
  }
  if (stage === "all_claimed") {
    return (
      <PhoneShell>
        <ClosedScreen config={config} variant="all_claimed" />
      </PhoneShell>
    );
  }
  const status: SessionResponse["status"] = data.status === "live" && remainingMs <= 0 ? "closed" : data.status;
  if (status === "closed") {
    return (
      <PhoneShell>
        <ClosedScreen config={config} variant="closed" />
      </PhoneShell>
    );
  }
  return (
    <PhoneShell soundOn={soundOn} onToggleSound={toggleSound}>
      <UnwrapScreen config={config} status={status} remaining={remaining} onUnwrap={unwrap} busy={busy || !restored} error={error} />
    </PhoneShell>
  );
}
