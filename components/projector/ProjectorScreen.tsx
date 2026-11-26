"use client";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { ClockIcon, SpeakerIcon } from "@/components/icons";
import { LogoLabel } from "@/components/LogoLabel";
import { Snow } from "@/components/Snow";
import { burstConfetti, goldRain } from "@/lib/confetti";
import { formatClock, offerPhrase, pillLabel } from "@/lib/labels";
import { audioReady, playClosingChime, playDing, playFanfare, playJingle, playTick, setSoundEnabled, unlockAudio } from "@/lib/sound";
import type { PublicConfig } from "@/lib/types";
import { useCountdown, useSession } from "@/lib/useSession";

const W = 1920;
const H = 1080;

/** Scales a fixed 1920x1080 stage to fit any window (letterboxed). */
function useStageScale() {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

export function subline(config: PublicConfig): string {
  const jp = config.prizes.find((p) => p.isJackpot);
  if (!jp) return `Every realtor in this room wins a gift: ${config.offerDescription}.`;
  return `Every realtor in this room wins a gift. One lucky person unwraps the jackpot: ${offerPhrase(jp)} ${config.offerDescription}.`;
}

export function ProjectorScreen({ siteUrl, isAdmin }: { siteUrl: string; isAdmin: boolean }) {
  const scale = useStageScale();
  const { data, serverNow } = useSession(2000);
  const remainingMs = useCountdown(data, serverNow, 100);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [jackpotBanner, setJackpotBanner] = useState(false);

  const status = data ? (data.status === "live" && remainingMs <= 0 ? "closed" : data.status) : "waiting";
  const secLeft = Math.ceil(remainingMs / 1000);
  const config = data?.publicConfig;
  const soundsAllowed = config?.projectorSounds ?? true;

  useEffect(() => setSoundEnabled(soundsAllowed), [soundsAllowed]);

  // Fullscreen with F
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ticks + jingles, once per displayed second
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    if (status !== "live") {
      lastSec.current = null;
      return;
    }
    if (lastSec.current === secLeft) return;
    const first = lastSec.current === null;
    lastSec.current = secLeft;
    if (first || secLeft <= 0) return;
    if (secLeft <= 10) playJingle(10 - secLeft);
    else playTick(secLeft <= 60);
  }, [secLeft, status]);

  // Close: chime + confetti once
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (prev === "live" && status === "closed") {
      playClosingChime();
      goldRain(3500);
    }
  }, [status]);

  // New unwraps: ding
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevCount.current;
    prevCount.current = data.unwrappedCount;
    if (prev !== null && data.unwrappedCount > prev) playDing();
  }, [data]);

  // Jackpot: banner for 5 seconds
  const prevJackpot = useRef<boolean | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevJackpot.current;
    prevJackpot.current = data.jackpotTaken;
    if (prev === false && data.jackpotTaken) {
      setJackpotBanner(true);
      playFanfare(true);
      burstConfetti(true);
      // Not tied to effect cleanup: polling re-runs this effect every 2s.
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setJackpotBanner(false), 5000);
    }
  }, [data]);
  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  const enableSound = () => {
    unlockAudio();
    setTimeout(() => setSoundUnlocked(audioReady()), 100);
    setTimeout(playDing, 150);
  };

  const prizes = config?.prizes ?? [];
  const lastMinute = status === "live" && secLeft <= 60;
  const finalTen = status === "live" && secLeft <= 10 && secLeft > 0;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0A2E22]">
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden bg-evergreen"
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
      >
        <Snow count={70} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(1200px 700px at 80% 45%, rgba(212,168,75,0.12), transparent 60%)" }}
        />

        <div className="relative grid h-full grid-cols-[1fr_560px] gap-[80px] px-[100px] py-[90px]">
          {/* Left */}
          <div className="flex flex-col">
            <p className="text-[26px] font-semibold uppercase tracking-[0.32em] text-gold-light">A surprise from Santa&apos;s workshop</p>
            <h1 className="mt-5 whitespace-nowrap font-display text-[140px] font-bold leading-[1] tracking-[-0.01em] text-cream">
              Scan. Unwrap.
              <br />
              <span className="text-gold">Win.</span>
            </h1>
            <p className="mt-8 max-w-[1000px] text-[34px] leading-[1.4] text-mist">{config ? subline(config) : " "}</p>
            <div className="mt-9 flex flex-wrap gap-4">
              {prizes.map((p) => (
                <span
                  key={p.id}
                  className={`rounded-full px-7 py-3 text-[28px] font-semibold ${
                    p.isJackpot ? "bg-gold text-ink" : "border-2 border-evergreen-line text-cream"
                  }`}
                >
                  {pillLabel(p)}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-5 text-[28px] text-mist">
              <span>
                Courtesy of <strong className="font-semibold text-cream">{config?.hostName ?? ""}</strong> and
              </span>
              <LogoLabel height={46} />
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex h-[560px] w-[560px] flex-col items-center justify-center rounded-[40px] border-[12px] border-gold bg-cream p-10 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
              <AnimatePresence mode="wait">
                {status === "closed" ? (
                  <motion.div key="thanks" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <p className="font-display text-[64px] font-bold leading-tight text-evergreen">Thanks for playing.</p>
                    <p className="mt-4 font-display text-[64px] font-bold leading-tight text-cranberry">Merry Christmas!</p>
                  </motion.div>
                ) : (
                  <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                    <QRCodeSVG value={siteUrl} size={400} level="M" bgColor="#FBF6EC" fgColor="#1B1A12" marginSize={0} title="QR code to the gift drop" />
                    <p className="mt-6 text-[32px] font-semibold text-evergreen">Point your camera here</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-8 flex flex-col items-center gap-5">
              {status === "waiting" ? (
                <div className="flex items-center gap-4 rounded-full border-2 border-evergreen-line px-10 py-5 text-[40px] font-semibold text-cream">
                  Get ready…
                </div>
              ) : status === "closed" ? (
                <div className="rounded-full border-2 border-evergreen-line px-10 py-5 text-[40px] font-semibold text-cream">Gifts are closed</div>
              ) : (
                <div
                  className={`flex items-center gap-4 rounded-full bg-cranberry px-10 py-5 text-[44px] font-bold text-white ${
                    lastMinute && status === "live" ? "pulse-pill" : ""
                  }`}
                >
                  <ClockIcon size={44} />
                  {status === "paused" ? "Paused · " : "Gifts close in "}
                  <span className="tabular-nums">{formatClock(remainingMs)}</span>
                </div>
              )}
              <p className="text-[34px] text-mist">
                <strong className="font-display text-[48px] font-bold text-gold-light tabular-nums">
                  <AnimatedCount value={data?.unwrappedCount ?? 0} />
                </strong>{" "}
                gifts unwrapped
              </p>
            </div>
          </div>
        </div>

        {/* Final 10 seconds */}
        <AnimatePresence>
          {finalTen && (
            <motion.div
              key="ten"
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-evergreen/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                key={secLeft}
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="font-display text-[520px] font-bold leading-none text-gold drop-shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
              >
                {secLeft}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Closed overlay */}
        <AnimatePresence>
          {status === "closed" && (
            <motion.div
              key="closed"
              className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-[38px]"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="rounded-full bg-gold px-14 py-5 font-display text-[56px] font-bold text-ink shadow-2xl">Gifts are wrapped up!</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Jackpot banner */}
        <AnimatePresence>
          {jackpotBanner && (
            <motion.div
              key="jp"
              className="absolute inset-0 flex flex-col items-center justify-center bg-cranberry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-[40px] font-semibold uppercase tracking-[0.4em] text-gold-pale">Turn #{data?.jackpotTurn}</p>
              <motion.p
                initial={{ scale: 0.6 }}
                animate={{ scale: [0.6, 1.08, 1] }}
                transition={{ duration: 0.8 }}
                className="shimmer mt-6 whitespace-nowrap px-10 text-center font-display text-[160px] font-bold leading-none"
              >
                JACKPOT CLAIMED!
              </motion.p>
              <p className="mt-10 text-[44px] text-cream">Someone in this room just unwrapped the big one.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isAdmin && !soundUnlocked && (
        <button
          type="button"
          onClick={enableSound}
          className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-[13px] text-cream/80 hover:bg-black/60"
        >
          <SpeakerIcon size={16} /> Enable sound
        </button>
      )}
      {data && !soundUnlocked && isAdmin && !soundsAllowed && (
        <span className="fixed bottom-3 left-3 z-50 text-[12px] text-cream/50">Projector sounds are off in admin</span>
      )}
    </div>
  );
}
