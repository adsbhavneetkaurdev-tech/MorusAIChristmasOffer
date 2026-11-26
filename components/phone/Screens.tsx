"use client";
/**
 * Presentational phone screens. GiftApp wires them to the API; /preview renders them with sample data.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { GiftBox } from "@/components/GiftBox";
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/icons";
import { LogoLabel } from "@/components/LogoLabel";
import { Snow } from "@/components/Snow";
import { revealLines, shortLabel, withSubject } from "@/lib/labels";
import type { PublicConfig, RevealPrize } from "@/lib/types";

/* ---------- shell ---------- */

export function PhoneShell({
  children,
  soundOn,
  onToggleSound,
  light = false,
  snow = true,
}: {
  children: React.ReactNode;
  soundOn?: boolean;
  onToggleSound?: () => void;
  light?: boolean;
  snow?: boolean;
}) {
  return (
    <div className={`relative min-h-[100dvh] w-full overflow-hidden ${light ? "bg-cream text-ink" : "bg-evergreen text-cream"}`}>
      {!light && snow && <Snow count={32} />}
      {onToggleSound && (
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Sound on. Tap to mute." : "Sound off. Tap to turn on."}
          className={`absolute right-3 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full ${
            light ? "text-cream" : "text-mist"
          } hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-pale`}
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          {soundOn ? <SpeakerIcon size={22} /> : <SpeakerOffIcon size={22} />}
        </button>
      )}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}

function Brand({ hostName }: { hostName: string }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <LogoLabel height={28} />
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-gold-pale">With {hostName}</p>
    </div>
  );
}

function Countdown({ label, tone = "dark" }: { label: string; tone?: "dark" | "light" }) {
  return (
    <p
      className={`inline-flex items-center gap-1.5 text-[15px] font-medium ${tone === "dark" ? "text-mist" : "text-evergreen"}`}
      aria-live="off"
    >
      <ClockIcon size={17} className={tone === "dark" ? "text-gold-light" : "text-cranberry"} />
      {label}
    </p>
  );
}

/** Shrinks the gift on short screens so the button and countdown stay above the fold. */
function useBoxSize(full = 230) {
  const [size, setSize] = useState(full);
  useEffect(() => {
    const fit = () => {
      const h = window.innerHeight;
      setSize(h >= 800 ? full : h >= 700 ? Math.round(full * 0.85) : Math.round(full * 0.7));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [full]);
  return size;
}

/* ---------- A. Unwrap (also waiting / paused) ---------- */

export function UnwrapScreen({
  config,
  status,
  remaining,
  onUnwrap,
  busy = false,
  error,
}: {
  config: PublicConfig;
  status: "live" | "waiting" | "paused";
  remaining: string;
  onUnwrap?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const live = status === "live";
  const tap = live && !busy ? onUnwrap : undefined;
  const boxSize = useBoxSize(230);
  return (
    <>
      <Brand hostName={config.hostName} />
      <div className="mt-5 text-center">
        <h1 className="font-display text-[31px] font-bold leading-[1.08] text-cream">
          Merry Christmas! <span className="block text-gold-light">A gift has your name on it.</span>
        </h1>
        <p className="mx-auto mt-2.5 max-w-[320px] text-[16px] leading-snug text-mist">
          Every gift is a winner. One lucky realtor tonight unwraps the jackpot.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center py-4">
        <button
          type="button"
          onClick={tap}
          disabled={!tap}
          aria-label={live ? "Tap the gift to unwrap it" : "Gift box"}
          className="rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold-pale disabled:cursor-default"
          tabIndex={live ? 0 : -1}
        >
          <GiftBox state="idle" size={boxSize} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2.5 text-center">
        {status === "waiting" && (
          <div role="status" className="w-full rounded-btn border border-evergreen-line bg-evergreen-deep/60 px-4 py-4">
            <p className="font-display text-[20px] font-medium text-cream">The gift drop starts soon</p>
            <p className="mt-1 text-[15px] text-mist">Keep this page open. It will open by itself.</p>
          </div>
        )}
        {status === "paused" && (
          <div role="status" className="w-full rounded-btn border border-evergreen-line bg-evergreen-deep/60 px-4 py-4">
            <p className="font-display text-[20px] font-medium text-cream">Paused for a moment…</p>
            <p className="mt-1 text-[15px] text-mist">Hang tight, we&apos;ll be right back.</p>
          </div>
        )}
        {live && (
          <button type="button" className="btn-gold h-[60px] w-full text-[18px]" onClick={onUnwrap} disabled={busy}>
            {busy ? "Unwrapping…" : "Tap to unwrap"}
          </button>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-[15px] text-gold-pale">
            <AlertIcon size={17} /> {error}
          </p>
        )}
        <p className="text-[13px] text-mist-dark">One gift per person · claim before the party ends</p>
        {status !== "waiting" && <Countdown label={`Gifts close in ${remaining}`} />}
      </div>
    </>
  );
}

/* ---------- Closed / all claimed ---------- */

export function ClosedScreen({ config, variant }: { config: PublicConfig; variant: "closed" | "all_claimed" }) {
  return (
    <>
      <Brand hostName={config.hostName} />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="opacity-80">
          <GiftBox state="static" size={170} />
        </div>
        <h1 className="mt-6 font-display text-[30px] font-bold leading-tight">
          {variant === "closed" ? "The gifts have all been wrapped up" : "All gifts have been claimed"}
        </h1>
        <p className="mx-auto mt-3 max-w-[320px] text-[16px] leading-relaxed text-mist">
          Thanks for celebrating with {config.hostName}. You can still book a call to see what {config.offerDescription} can do for
          you.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <a href={config.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-gold h-[60px] w-full text-[18px]">
          <CalendarIcon size={20} /> Book a call with Morus AI
        </a>
        <p className="text-[14px] text-mist">
          or email{" "}
          <a className="font-semibold text-gold-pale underline" href={`mailto:${config.contactEmail}`}>
            {config.contactEmail}
          </a>
        </p>
      </div>
    </>
  );
}

/* ---------- C. Reveal ---------- */

export function RevealScreen({
  config,
  prize,
  phase,
  remaining,
  closed = false,
  onClaim,
}: {
  config: PublicConfig;
  prize: RevealPrize;
  phase: "opening" | "revealed";
  remaining: string;
  closed?: boolean;
  onClaim?: () => void;
}) {
  const lines = revealLines(prize);
  const revealed = phase === "revealed";
  return (
    <>
      <Brand hostName={config.hostName} />
      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          {!revealed ? (
            <motion.div key="box" exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }} className="py-10">
              <GiftBox state="opening" size={230} jackpot={prize.isJackpot} />
              <p className="sr-only" role="status">
                Unwrapping your gift…
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="prize"
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="w-full"
              role="status"
              aria-live="polite"
            >
              {prize.isJackpot && (
                <motion.span
                  initial={{ scale: 0, rotate: -8 }}
                  animate={{ scale: 1, rotate: -3 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 12 }}
                  className="mb-4 inline-block rounded-full bg-cranberry px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.2em] text-white shadow-lg"
                >
                  Jackpot winner
                </motion.span>
              )}
              <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-gold-pale">You unwrapped</p>
              <p
                className={`mt-2 font-display font-bold leading-[0.95] ${prize.isJackpot ? "shimmer" : "text-gold"} ${
                  lines.big.length > 9 ? "text-[56px]" : "text-[72px]"
                }`}
              >
                {lines.big}
              </p>
              {lines.small && (
                <p className={`font-display text-[40px] font-bold leading-none ${prize.isJackpot ? "shimmer" : "text-gold-light"}`}>
                  {lines.small}
                </p>
              )}
              <p className="mx-auto mt-4 max-w-[320px] text-[17px] leading-relaxed text-cream">
                {prize.offerType === "months_free" ? "of" : "on"} {config.offerDescription}, working your leads 24/7.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={false}
        animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 16 }}
        transition={{ delay: revealed ? 0.35 : 0 }}
      >
        <Countdown label={closed ? "Claim yours now before you leave" : `Gifts close in ${remaining}. Claim yours now`} />
        <button type="button" className="btn-gold h-[60px] w-full text-[18px]" onClick={onClaim} disabled={!revealed} tabIndex={revealed ? 0 : -1}>
          Claim my gift
        </button>
      </motion.div>
    </>
  );
}

/* ---------- D. Claim form ---------- */

export interface ClaimValues {
  name: string;
  email: string;
  company: string;
  phone: string;
  consent: boolean;
}

export const emptyClaim: ClaimValues = { name: "", email: "", company: "", phone: "", consent: false };

function Field({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold text-evergreen">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={`h-14 w-full rounded-[14px] border-2 bg-white px-4 text-[17px] text-ink placeholder:text-[#8B8A7E] focus:outline-none focus:ring-4 ${
          error ? "border-cranberry focus:ring-cranberry/20" : "border-[#D9D1BE] focus:border-evergreen focus:ring-evergreen/15"
        }`}
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="flex items-center gap-1 text-[14px] font-medium text-cranberry">
          <AlertIcon size={15} /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-[#5B5A4E]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ClaimFormScreen({
  config,
  prize,
  onSubmit,
  initialValues = emptyClaim,
  initialErrors = {},
  initialFormError = null,
}: {
  config: PublicConfig;
  prize: RevealPrize;
  onSubmit?: (v: ClaimValues) => Promise<{ fields?: Record<string, string>; error?: string } | void>;
  initialValues?: ClaimValues;
  initialErrors?: Record<string, string>;
  initialFormError?: string | null;
}) {
  const [v, setV] = useState<ClaimValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [formError, setFormError] = useState<string | null>(initialFormError);
  const [submitting, setSubmitting] = useState(false);
  const set = (k: keyof ClaimValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = k === "consent" ? e.target.checked : e.target.value;
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((s) => ({ ...s, [k]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (v.name.trim().length < 2) local.name = "Please enter your full name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.trim())) local.email = "Please enter a valid email address.";
    if (v.company.trim().length < 2) local.company = "Please enter your brokerage or company.";
    const digits = v.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) local.phone = "Please enter a mobile number, e.g. (780) 555-0123.";
    if (!v.consent) local.consent = "Please tick the box so we can send your gift.";
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) {
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
      return;
    }
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(v);
      if (res?.fields) setErrors(res.fields);
      if (res?.error) setFormError(res.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <header className="bg-evergreen px-5 pb-7 pt-[max(20px,env(safe-area-inset-top))] text-center text-cream">
        <div className="mx-auto max-w-[460px]">
          <LogoLabel height={26} />
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.24em] text-gold-pale">Almost yours</p>
          <h1 className="mt-1.5 font-display text-[30px] font-bold leading-tight">Where should we send your gift?</h1>
          <p className="mt-3 inline-block rounded-full bg-gold px-4 py-1.5 text-[14px] font-semibold text-ink">
            {withSubject(shortLabel(prize), config.offerSubject)}
          </p>
        </div>
      </header>
      <form noValidate onSubmit={submit} className="mx-auto flex max-w-[460px] flex-col gap-4 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-6">
        <Field label="Full name" name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" value={v.name} onChange={set("name")} error={errors.name} />
        <Field label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" value={v.email} onChange={set("email")} error={errors.email} />
        <Field label="Brokerage / company" name="company" autoComplete="organization" autoCapitalize="words" enterKeyHint="next" value={v.company} onChange={set("company")} error={errors.company} />
        <Field label="Mobile number" name="phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" hint="(780) 555-0123" placeholder="(780) 555-0123" value={v.phone} onChange={set("phone")} error={errors.phone} />

        <div>
          <label className={`flex cursor-pointer items-start gap-3 rounded-[14px] border-2 bg-white p-4 ${errors.consent ? "border-cranberry" : "border-[#D9D1BE]"}`}>
            <input
              type="checkbox"
              name="consent"
              checked={v.consent}
              onChange={set("consent")}
              aria-invalid={!!errors.consent}
              className="mt-0.5 h-6 w-6 shrink-0 accent-evergreen"
            />
            <span className="text-[15px] leading-snug text-ink">
              Yes, Morus AI and {config.hostName} can contact me about my gift and related offers. I can unsubscribe anytime.
            </span>
          </label>
          {errors.consent && (
            <p className="mt-1.5 flex items-center gap-1 text-[14px] font-medium text-cranberry">
              <AlertIcon size={15} /> {errors.consent}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="rounded-[12px] bg-cranberry/10 px-4 py-3 text-[15px] font-medium text-cranberry">
            {formError}
          </p>
        )}

        <button type="submit" className="btn-cranberry mt-1 h-[60px] w-full text-[18px]" disabled={submitting}>
          {submitting ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden /> Sending your gift…
            </>
          ) : (
            "Claim my gift"
          )}
        </button>
        <p className="text-center text-[13px] text-[#5B5A4E]">We&apos;ll email your unique gift code right away.</p>
      </form>
    </div>
  );
}

/* ---------- E. Confirmation ---------- */

export function ConfirmScreen({
  config,
  code,
  prize,
  onAnother,
}: {
  config: PublicConfig;
  code: string;
  prize: RevealPrize;
  onAnother?: () => void;
}) {
  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className="mx-auto flex min-h-[100dvh] max-w-[460px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(32px,env(safe-area-inset-top))] text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 15 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold text-ink shadow-[0_8px_30px_rgba(212,168,75,0.45)]"
        >
          <CheckIcon size={40} />
        </motion.div>
        <h1 className="mt-5 font-display text-[30px] font-bold leading-tight text-evergreen">Your gift is on its way to your inbox.</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-[#3B3A30]">
          We&apos;ve emailed you a unique gift code with everything you need to redeem it.
        </p>

        <div className="mt-6 rounded-[18px] border-[3px] border-dashed border-gold bg-[#FFFDF7] px-4 py-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#7A5E1E]">Your gift code</p>
          <p className="mt-1 select-all font-mono text-[28px] font-bold tracking-wider text-ink">{code}</p>
          <p className="mt-1 text-[15px] font-medium text-evergreen">{withSubject(shortLabel(prize), config.offerSubject)}</p>
        </div>

        <p className="mt-6 text-[16px] text-[#3B3A30]">To redeem, book a quick setup call with us:</p>
        <a href={config.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-gold mt-3 h-[60px] w-full text-[18px]">
          <CalendarIcon size={20} /> Book my setup call
        </a>
        <p className="mt-3 text-[15px] text-[#3B3A30]">
          or email{" "}
          <a href={`mailto:${config.contactEmail}?subject=${encodeURIComponent(`My gift code ${code}`)}`} className="font-semibold text-cranberry underline">
            {config.contactEmail}
          </a>
        </p>
        {onAnother && (
          <button type="button" onClick={onAnother} className="mt-4 text-[14px] font-semibold text-evergreen underline">
            Unwrap another gift (testing mode)
          </button>
        )}

        <div className="mt-auto flex flex-col items-center gap-2 pt-8 text-[14px] text-[#3B3A30]">
          <p>
            Merry Christmas from <strong>{config.hostName}</strong> and
          </p>
          <span className="rounded-[10px] ring-1 ring-[#E6DDC8]">
            <LogoLabel height={24} />
          </span>
        </div>
      </div>
    </div>
  );
}
