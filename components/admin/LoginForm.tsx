"use client";
import { useState } from "react";
import { LogoLabel } from "@/components/LogoLabel";

export function LoginForm({ next }: { next?: string }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      if (next) window.location.href = next;
      else window.location.reload();
    } else {
      const body = await res?.json().catch(() => ({}));
      setErr(body?.error ?? "Could not sign in");
    }
  };
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-parchment px-4 text-ink">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
        <div className="flex justify-center rounded-xl bg-evergreen py-5">
          <LogoLabel height={28} />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold text-evergreen">Gift Drop Admin</h1>
        <label htmlFor="pw" className="mt-5 block text-sm font-semibold">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mt-1.5 h-12 w-full rounded-xl border-2 border-[#D9D1BE] px-3 text-base focus:border-evergreen focus:outline-none"
          autoFocus
        />
        {err && <p role="alert" className="mt-2 text-sm font-medium text-cranberry">{err}</p>}
        <button type="submit" disabled={busy || !pw} className="btn-cranberry mt-5 w-full text-base">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
