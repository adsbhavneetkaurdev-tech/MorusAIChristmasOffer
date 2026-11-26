"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, ExternalIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { LogoLabel } from "@/components/LogoLabel";
import { formatClock, prizeLabel } from "@/lib/labels";
import type { Claim, Config, OfferType, Prize, SessionState } from "@/lib/types";
import { balanceChances, validateConfig } from "@/lib/validate";

interface Stats {
  serverNow: number;
  session: SessionState & { remainingMs: number };
  unwrapped: number;
  expectedGuests: number;
  claimed: number;
  giftsLeft: number;
  fallbackName: string | null;
  given: Record<string, number>;
  jackpot: { configured: boolean; turns: number[]; won: { turn: number; name: string | null; company: string | null } | null };
  storage: string;
  emailMode: "resend" | "console";
}

interface SimResult {
  guests: number;
  runs: number;
  average: { id: string; name: string; average: number; quantity: number }[];
  averageNothing: number;
  jackpotWonInPercentOfRuns: number;
  averageJackpotTurn: number | null;
}

type Row = Prize & { turnsText: string };

const toRows = (c: Config): Row[] => c.prizes.map((p) => ({ ...p, turnsText: p.guaranteedTurns.join(", ") }));
const parseTurns = (t: string) =>
  t
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((x) => Number(x));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Signed out");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

const inputCls =
  "h-11 w-full rounded-lg border border-[#D9D1BE] bg-white px-2.5 text-[15px] text-ink focus:border-evergreen focus:outline-none focus:ring-2 focus:ring-evergreen/20";

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-evergreen">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-evergreen" : "bg-[#CFC8B6]"}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
    </button>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Config | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [search, setSearch] = useState("");
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const offset = useRef(0);
  const [, setTick] = useState(0);

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadConfig = useCallback(async () => {
    const res = await api<{ config: Config }>("/api/admin/config");
    setConfig(res.config);
    setDraft(res.config);
    setRows(toRows(res.config));
    setDirty(false);
  }, []);

  const loadStats = useCallback(async () => {
    const t0 = Date.now();
    const s = await api<Stats>("/api/admin/stats");
    offset.current = s.serverNow - (t0 + Date.now()) / 2;
    setStats(s);
  }, []);
  const loadClaims = useCallback(async () => {
    const r = await api<{ claims: Claim[] }>("/api/admin/claims");
    setClaims(r.claims);
  }, []);

  useEffect(() => {
    loadConfig().catch(() => {});
    let alive = true;
    let n = 0;
    const loop = async () => {
      await loadStats().catch(() => {});
      if (n++ % 2 === 0) await loadClaims().catch(() => {});
      if (alive) setTimeout(loop, 2500);
    };
    loop();
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [loadConfig, loadStats, loadClaims]);

  const current: Config | null = useMemo(
    () => (draft ? { ...draft, prizes: rows.map(({ turnsText, ...p }) => ({ ...p, guaranteedTurns: parseTurns(turnsText) })) } : null),
    [draft, rows],
  );
  const validation = useMemo(() => (current ? validateConfig(current, stats?.given ?? {}) : null), [current, stats?.given]);

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    setDirty(true);
  };
  const updateDraft = (patch: Partial<Config>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  };
  const addRow = () => {
    const id = `p-${Math.random().toString(36).slice(2, 8)}`;
    setRows((r) => [
      ...r,
      { id, name: "New prize", active: true, offerType: "months_free", value: 1, quantity: 10, chancePercent: 0, guaranteedTurns: [], isJackpot: false, turnsText: "" },
    ]);
    setDirty(true);
  };
  const removeRow = (i: number) => {
    const row = rows[i];
    if ((stats?.given[row.id] ?? 0) > 0 && !confirm(`"${row.name}" has already been given out. Remove it anyway? (Already-claimed gifts keep their codes.)`)) return;
    setRows((r) => r.filter((_, j) => j !== i));
    if (draft?.fallbackPrizeId === row.id) updateDraft({ fallbackPrizeId: "none" });
    setDirty(true);
  };
  const balance = () => {
    const prizes = balanceChances(rows.map(({ turnsText, ...p }) => ({ ...p, guaranteedTurns: parseTurns(turnsText) })));
    setRows((r) => r.map((row, i) => ({ ...row, chancePercent: prizes[i].chancePercent })));
    setDirty(true);
  };

  const save = async () => {
    if (!current || !validation || validation.errors.length) return;
    setSaving(true);
    try {
      const res = await api<{ config: Config }>("/api/admin/config", { method: "PUT", body: JSON.stringify(current) });
      setConfig(res.config);
      setDraft(res.config);
      setRows(toRows(res.config));
      setDirty(false);
      flash("ok", "Saved. Phones and the projector pick this up within a few seconds.");
      loadStats();
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    if (!config) return;
    setDraft(config);
    setRows(toRows(config));
    setDirty(false);
  };

  const action = async (a: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setActionBusy(true);
    try {
      await api("/api/admin/session", { method: "POST", body: JSON.stringify({ action: a }) });
      if (a === "reset_defaults") await loadConfig();
      if (a === "reset") {
        setClaims([]);
        flash("ok", "Reset done. Turns and claims cleared, quantities restored.");
      }
      await loadStats();
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  const runSim = async () => {
    if (!current) return;
    setSimBusy(true);
    try {
      setSim(await api<SimResult>("/api/admin/simulate", { method: "POST", body: JSON.stringify({ config: current, runs: 1000 }) }));
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setSimBusy(false);
    }
  };

  const resend = async (allocId: string) => {
    try {
      const r = await api<{ ok: boolean; claim: Claim }>("/api/admin/resend", { method: "POST", body: JSON.stringify({ allocId }) });
      setClaims((cs) => cs.map((c) => (c.allocId === allocId ? r.claim : c)));
      flash(r.ok ? "ok" : "err", r.ok ? `Email re-sent to ${r.claim.email}` : `Still failing: ${r.claim.emailError ?? "unknown error"}`);
    } catch (e) {
      flash("err", (e as Error).message);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  };

  // Live remaining
  const s = stats?.session;
  let remaining = s?.remainingMs ?? 0;
  if (s?.status === "live" && s.endsAt) remaining = Math.max(0, s.endsAt - (Date.now() + offset.current));
  const status = s?.status === "live" && remaining <= 0 ? "closed" : s?.status;

  const filteredClaims = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return claims;
    return claims.filter((c) => [c.name, c.company, c.email, c.phone, c.code, c.prizeLabel].some((v) => v.toLowerCase().includes(q)));
  }, [claims, search]);

  const prizeName = (id: string) => current?.prizes.find((p) => p.id === id)?.name ?? config?.prizes.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="light-page min-h-[100dvh] pb-28">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-evergreen text-cream shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <LogoLabel height={24} />
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-tight">Gift Drop Admin</p>
            <p className="text-[13px] text-mist-dark">{config?.hostName}</p>
          </div>
          <StatusPill status={status} remaining={remaining} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {status === "live" ? (
              <>
                <button className="btn-gold !min-h-[44px] px-4 text-[15px]" disabled={actionBusy} onClick={() => action("pause")}>
                  Pause
                </button>
                <button className="btn-outline-light !min-h-[44px] px-3 text-[14px]" disabled={actionBusy} onClick={() => action("add_minute")}>
                  +1 min
                </button>
                <button
                  className="btn-outline-light !min-h-[44px] px-3 text-[14px]"
                  disabled={actionBusy}
                  onClick={() => action("close", "End the gift drop now? Phones will stop accepting new unwraps.")}
                >
                  End now
                </button>
              </>
            ) : status === "paused" ? (
              <>
                <button className="btn-gold !min-h-[44px] px-4 text-[15px]" disabled={actionBusy} onClick={() => action("resume")}>
                  Resume
                </button>
                <button className="btn-outline-light !min-h-[44px] px-3 text-[14px]" disabled={actionBusy} onClick={() => action("add_minute")}>
                  +1 min
                </button>
              </>
            ) : (
              <button
                className="btn-gold !min-h-[44px] px-4 text-[15px]"
                disabled={actionBusy}
                onClick={() =>
                  action(
                    "start",
                    status === "closed"
                      ? `Start a new ${config?.countdownMinutes ?? 10}-minute countdown? Existing turns and claims are kept.`
                      : undefined,
                  )
                }
              >
                Start gift drop
              </button>
            )}
            <button
              className="btn-outline-light !min-h-[44px] px-3 text-[14px]"
              disabled={actionBusy}
              onClick={() =>
                action("reset", "Reset for rehearsal?\n\nThis clears ALL turns and claims (leads!) and restores quantities. Export the CSV first if you need it.")
              }
            >
              Reset for rehearsal
            </button>
            <a href="/screen" target="_blank" rel="noopener" className="btn-outline-light !min-h-[44px] px-3 text-[14px]">
              Open projector screen <ExternalIcon size={16} />
            </a>
            <button onClick={logout} className="px-2 text-[13px] text-mist-dark underline">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5">
        {stats && (stats.storage === "memory" || stats.emailMode === "console") && (
          <div className="rounded-xl border border-gold bg-[#FFF6DD] px-4 py-3 text-[14px] text-ink">
            {stats.storage === "memory" && (
              <p>
                <strong>Storage: in-memory (development only).</strong> Add Upstash Redis in Vercel before the event, or prizes can be lost or double-counted.
              </p>
            )}
            {stats.emailMode === "console" && (
              <p>
                <strong>Email: not connected.</strong> RESEND_API_KEY is not set, so gift emails are written to the server log instead of being sent.
              </p>
            )}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Gifts unwrapped" value={stats?.unwrapped ?? 0} sub={`of ${stats?.expectedGuests ?? "–"} expected guests`} />
          <Stat
            label="Claimed"
            value={stats?.claimed ?? 0}
            sub={stats && stats.unwrapped ? `${Math.round((stats.claimed / stats.unwrapped) * 100)}% of unwraps became leads` : "no unwraps yet"}
          />
          <Stat label="Gifts left" value={stats?.giftsLeft ?? 0} sub={stats?.fallbackName ? `then unlimited ${stats.fallbackName}` : "then \"All gifts claimed\""} />
          <div className="rounded-2xl bg-evergreen p-4 text-cream shadow-sm">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-gold-pale">Jackpot</p>
            {stats?.jackpot.won ? (
              <>
                <p className="mt-1 font-display text-2xl font-bold text-gold">Won at turn #{stats.jackpot.won.turn}</p>
                <p className="text-[14px] text-mist">
                  {stats.jackpot.won.name ? `${stats.jackpot.won.name} · ${stats.jackpot.won.company}` : "Not claimed yet"}
                </p>
              </>
            ) : stats?.jackpot.configured ? (
              <>
                <p className="mt-1 font-display text-2xl font-bold">Not won yet</p>
                <p className="text-[14px] text-mist">{stats.jackpot.turns.length ? `at turn #${stats.jackpot.turns.join(", #")}` : "by chance only"}</p>
              </>
            ) : (
              <p className="mt-1 text-[15px] text-mist">No active jackpot prize</p>
            )}
          </div>
        </div>

        {/* Prizes */}
        <Panel
          title="Prizes"
          right={
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              {validation && current?.pickMode === "fixed_chance" && (
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    Math.abs(validation.chanceTotal - 100) < 0.01 ? "bg-evergreen/10 text-evergreen" : "bg-cranberry/10 text-cranberry"
                  }`}
                >
                  Chances: {validation.chanceTotal}% {Math.abs(validation.chanceTotal - 100) < 0.01 ? "✓" : "(must be 100%)"}
                </span>
              )}
              <button className="rounded-lg border border-evergreen px-3 py-2 font-semibold text-evergreen hover:bg-evergreen/5" onClick={balance}>
                Balance automatically
              </button>
              <button
                className="rounded-lg px-3 py-2 font-semibold text-[#5B5A4E] underline"
                onClick={() => action("reset_defaults", "Replace ALL prizes, rules and event details with the defaults?")}
              >
                Reset to defaults
              </button>
            </div>
          }
        >
          <p className="mb-3 text-[13px] text-[#5B5A4E]">
            &ldquo;Always won at turn #&rdquo; overrides chance. A prize with 0% chance is only given on its turns (or as the fallback).
          </p>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-1.5 text-[14px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wider text-[#5B5A4E]">
                  <th className="w-[52px] px-1 font-semibold">On</th>
                  <th className="px-1 font-semibold">Prize name</th>
                  <th className="w-[150px] px-1 font-semibold">Offer type</th>
                  <th className="w-[90px] px-1 font-semibold">Value</th>
                  <th className="w-[90px] px-1 font-semibold">Quantity</th>
                  <th className="w-[60px] px-1 font-semibold">Left</th>
                  <th className="w-[90px] px-1 font-semibold">Chance %</th>
                  <th className="w-[130px] px-1 font-semibold">Always won at turn #</th>
                  <th className="w-[70px] px-1 font-semibold">Jackpot</th>
                  <th className="w-[110px] px-1" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const given = stats?.given[r.id] ?? 0;
                  return (
                    <tr key={r.id} className={`${r.isJackpot ? "bg-[#FFF6DD]" : "bg-parchment/60"} align-middle`}>
                      <td className="rounded-l-lg px-1 py-1.5">
                        <Toggle checked={r.active} onChange={(v) => updateRow(i, { active: v })} label={`${r.name} active`} />
                      </td>
                      <td className="px-1">
                        <div className="flex items-center gap-2">
                          <input className={inputCls} value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} aria-label="Prize name" />
                          {r.isJackpot && <span className="shrink-0 rounded bg-gold px-1.5 py-0.5 text-[11px] font-bold text-ink">JACKPOT</span>}
                        </div>
                        <p className="mt-0.5 pl-1 text-[12px] text-[#5B5A4E]">Shows as “{prizeLabel(r)}”</p>
                      </td>
                      <td className="px-1">
                        <select className={inputCls} value={r.offerType} onChange={(e) => updateRow(i, { offerType: e.target.value as OfferType })} aria-label="Offer type">
                          <option value="months_free">Months free</option>
                          <option value="percent_off">% discount</option>
                          <option value="dollar_off">$ off</option>
                        </select>
                      </td>
                      <td className="px-1">
                        <input className={inputCls} type="number" min={1} inputMode="numeric" value={Number.isFinite(r.value) ? r.value : ""} onChange={(e) => updateRow(i, { value: e.target.valueAsNumber })} aria-label="Value" />
                      </td>
                      <td className="px-1">
                        <input className={inputCls} type="number" min={given} inputMode="numeric" value={Number.isFinite(r.quantity) ? r.quantity : ""} onChange={(e) => updateRow(i, { quantity: e.target.valueAsNumber })} aria-label="Quantity" />
                      </td>
                      <td className="px-2 font-semibold tabular-nums text-evergreen">{Math.max(0, r.quantity - given)}</td>
                      <td className="px-1">
                        <input className={inputCls} type="number" min={0} max={100} step="any" inputMode="decimal" value={Number.isFinite(r.chancePercent) ? r.chancePercent : ""} onChange={(e) => updateRow(i, { chancePercent: e.target.valueAsNumber })} aria-label="Chance percent" />
                      </td>
                      <td className="px-1">
                        <input className={inputCls} value={r.turnsText} placeholder="e.g. 7, 50" inputMode="numeric" onChange={(e) => updateRow(i, { turnsText: e.target.value })} aria-label="Always won at turn numbers" />
                      </td>
                      <td className="px-1 text-center">
                        <input type="checkbox" className="h-5 w-5 accent-evergreen" checked={r.isJackpot} onChange={(e) => updateRow(i, { isJackpot: e.target.checked })} aria-label="Jackpot" />
                      </td>
                      <td className="rounded-r-lg px-1">
                        <div className="flex justify-end gap-0.5">
                          <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUpIcon size={18} /></IconBtn>
                          <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDownIcon size={18} /></IconBtn>
                          <IconBtn label="Remove prize" onClick={() => removeRow(i)}><TrashIcon size={18} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={addRow} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-evergreen px-3 py-2.5 text-[14px] font-semibold text-evergreen hover:bg-evergreen/5">
            <PlusIcon size={18} /> Add prize
          </button>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Rules */}
          <Panel title="Rules">
            {draft && (
              <div className="flex flex-col gap-4 text-[15px]">
                <LabeledRow label="How prizes are picked">
                  <select className={inputCls} value={draft.pickMode} onChange={(e) => updateDraft({ pickMode: e.target.value as Config["pickMode"] })}>
                    <option value="fixed_chance">Fixed chance (use each prize&apos;s %)</option>
                    <option value="weighted_by_remaining">Weighted by what&apos;s left</option>
                  </select>
                </LabeledRow>
                <LabeledRow label="When all prizes run out, give">
                  <select className={inputCls} value={draft.fallbackPrizeId} onChange={(e) => updateDraft({ fallbackPrizeId: e.target.value })}>
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (unlimited)
                      </option>
                    ))}
                    <option value="none">Nothing (“All gifts have been claimed”)</option>
                  </select>
                </LabeledRow>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledRow label="Countdown minutes">
                    <input className={inputCls} type="number" min={1} max={180} value={Number.isFinite(draft.countdownMinutes) ? draft.countdownMinutes : ""} onChange={(e) => updateDraft({ countdownMinutes: e.target.valueAsNumber })} />
                  </LabeledRow>
                  <LabeledRow label="Expected guests">
                    <input className={inputCls} type="number" min={1} value={Number.isFinite(draft.expectedGuests) ? draft.expectedGuests : ""} onChange={(e) => updateDraft({ expectedGuests: e.target.valueAsNumber })} />
                  </LabeledRow>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>
                    One gift per phone
                    <span className="block text-[13px] text-[#5B5A4E]">Turn off only for testing.</span>
                  </span>
                  <Toggle checked={draft.onePerDevice} onChange={(v) => updateDraft({ onePerDevice: v })} label="One gift per phone" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Projector sounds</span>
                  <Toggle checked={draft.projectorSounds} onChange={(v) => updateDraft({ projectorSounds: v })} label="Projector sounds" />
                </div>
              </div>
            )}
          </Panel>

          {/* Event details */}
          <Panel title="Event details">
            {draft && (
              <div className="flex flex-col gap-4 text-[15px]">
                <LabeledRow label="Hosted by">
                  <input className={inputCls} value={draft.hostName} onChange={(e) => updateDraft({ hostName: e.target.value })} />
                </LabeledRow>
                <LabeledRow label="Booking link">
                  <input className={inputCls} type="url" value={draft.bookingUrl} onChange={(e) => updateDraft({ bookingUrl: e.target.value })} />
                </LabeledRow>
                <LabeledRow label="Contact email">
                  <input className={inputCls} type="email" value={draft.contactEmail} onChange={(e) => updateDraft({ contactEmail: e.target.value })} />
                </LabeledRow>
                <LabeledRow label="What the offer is for (short)">
                  <input className={inputCls} value={draft.offerSubject} onChange={(e) => updateDraft({ offerSubject: e.target.value })} placeholder="Website + AI Agent" />
                </LabeledRow>
                <LabeledRow label="What the offer is for (in a sentence)">
                  <input className={inputCls} value={draft.offerDescription} onChange={(e) => updateDraft({ offerDescription: e.target.value })} placeholder="a custom website plus a Morus AI Agent" />
                </LabeledRow>
              </div>
            )}
          </Panel>
        </div>

        {/* Simulator */}
        <Panel
          title="Odds simulator"
          right={
            <button className="btn-cranberry !min-h-[44px] px-4 text-[15px]" onClick={runSim} disabled={simBusy || !!validation?.errors.length}>
              {simBusy ? "Simulating…" : `Simulate ${current?.expectedGuests ?? 120} guests`}
            </button>
          }
        >
          <p className="text-[14px] text-[#5B5A4E]">
            Runs your current settings (including unsaved edits) 1,000 times on the server, without touching real data, and shows the average prize split.
          </p>
          {sim && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-[14px]">
                <thead>
                  <tr className="border-b border-[#E6DDC8] text-left text-[12px] uppercase tracking-wider text-[#5B5A4E]">
                    <th className="py-2">Prize</th>
                    <th className="py-2 text-right">Avg. given</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="w-1/3 py-2 pl-4" />
                  </tr>
                </thead>
                <tbody>
                  {sim.average.map((a) => (
                    <tr key={a.id} className="border-b border-[#F0EADB]">
                      <td className="py-2">{a.name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{a.average.toFixed(1)}</td>
                      <td className="py-2 text-right tabular-nums text-[#5B5A4E]">{a.quantity}</td>
                      <td className="py-2 pl-4">
                        <div className="h-2.5 rounded-full bg-parchment">
                          <div className="h-2.5 rounded-full bg-gold" style={{ width: `${Math.min(100, (a.average / sim.guests) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sim.averageNothing > 0 && (
                    <tr>
                      <td className="py-2 text-cranberry">“All gifts claimed” (no prize)</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-cranberry">{sim.averageNothing.toFixed(1)}</td>
                      <td />
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-3 text-[14px] text-evergreen">
                Jackpot won in {sim.jackpotWonInPercentOfRuns.toFixed(0)}% of simulated events
                {sim.averageJackpotTurn ? `, on average at turn #${sim.averageJackpotTurn.toFixed(1)}` : ""}.
              </p>
            </div>
          )}
        </Panel>

        {/* Claims */}
        <Panel
          title={`Claims (${claims.length})`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputCls} !w-56`} placeholder="Search name, email, code…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search claims" type="search" />
              <a href="/api/admin/claims.csv" className="btn-cranberry !min-h-[44px] px-4 text-[15px]">
                Export CSV
              </a>
            </div>
          }
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[900px] text-[14px]">
              <thead>
                <tr className="border-b border-[#E6DDC8] text-left text-[12px] uppercase tracking-wider text-[#5B5A4E]">
                  <th className="py-2 pr-2">Turn</th>
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Brokerage</th>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Phone</th>
                  <th className="py-2 pr-2">Prize</th>
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2">Email sent</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((c) => (
                  <tr key={c.allocId} className={`border-b border-[#F0EADB] ${c.isJackpot ? "bg-[#FFF6DD] font-semibold" : ""}`}>
                    <td className="py-2 pr-2 tabular-nums">#{c.turn}</td>
                    <td className="py-2 pr-2">
                      {c.name}
                      {c.isJackpot && <span className="ml-1.5 rounded bg-gold px-1.5 py-0.5 text-[11px] font-bold">JACKPOT</span>}
                      {c.unsubscribed && <span className="ml-1.5 rounded bg-black/10 px-1.5 py-0.5 text-[11px]">unsubscribed</span>}
                    </td>
                    <td className="py-2 pr-2">{c.company}</td>
                    <td className="py-2 pr-2 break-all">{c.email}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{c.phone}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{prizeName(c.prizeId)}</td>
                    <td className="py-2 pr-2 font-mono whitespace-nowrap">{c.code}</td>
                    <td className="py-2 whitespace-nowrap">
                      {c.emailStatus === "sent" ? (
                        <span className="text-evergreen">Sent</span>
                      ) : c.emailStatus === "logged" ? (
                        <span className="text-[#5B5A4E]" title="RESEND_API_KEY not set">Logged only</span>
                      ) : c.emailStatus === "failed" ? (
                        <span className="text-cranberry" title={c.emailError}>Failed</span>
                      ) : (
                        <span className="text-[#5B5A4E]">Sending…</span>
                      )}
                      {c.emailStatus !== "sent" && (
                        <button onClick={() => resend(c.allocId)} className="ml-2 rounded border border-evergreen px-2 py-1 text-[12px] font-semibold text-evergreen hover:bg-evergreen/5">
                          Resend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredClaims.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-[#5B5A4E]">
                      {claims.length ? "No matches." : "No claims yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <p className="text-center text-[13px] text-[#5B5A4E]">
          <a href="/preview" className="underline">Preview every screen</a> · Storage: {stats?.storage ?? "…"} · Email: {stats?.emailMode ?? "…"}
        </p>
      </main>

      {/* Save bar */}
      {(dirty || notice) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6DDC8] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-[14px]">
              {notice ? (
                <p className={notice.kind === "ok" ? "text-evergreen" : "text-cranberry"}>{notice.text}</p>
              ) : validation?.errors.length ? (
                <ul className="text-cranberry">
                  {validation.errors.slice(0, 3).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#5B5A4E]">You have unsaved changes.</p>
              )}
            </div>
            {dirty && (
              <>
                <button onClick={discard} className="px-3 py-2 text-[14px] font-semibold text-[#5B5A4E] underline">
                  Discard
                </button>
                <button onClick={save} disabled={saving || !!validation?.errors.length} className="btn-cranberry !min-h-[48px] px-6 text-[15px]">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, remaining }: { status?: string; remaining: number }) {
  if (status === "live")
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-cranberry px-3 py-1.5 text-[14px] font-bold text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE · {formatClock(remaining)} left
      </span>
    );
  const map: Record<string, string> = { waiting: "Waiting", paused: `Paused · ${formatClock(remaining)} left`, closed: "Closed" };
  return <span className="rounded-full border border-evergreen-line px-3 py-1.5 text-[14px] font-semibold text-mist">{map[status ?? ""] ?? "…"}</span>;
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-[#5B5A4E]">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold tabular-nums text-evergreen">{value}</p>
      <p className="text-[13px] text-[#5B5A4E]">{sub}</p>
    </div>
  );
}

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex h-10 w-10 items-center justify-center rounded-lg text-evergreen hover:bg-evergreen/10 disabled:opacity-30">
      {children}
    </button>
  );
}
