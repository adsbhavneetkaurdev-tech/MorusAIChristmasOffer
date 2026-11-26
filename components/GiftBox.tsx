"use client";
import { motion, useReducedMotion } from "framer-motion";

export type GiftState = "idle" | "opening" | "open" | "static";

/**
 * Inline SVG gift: cranberry box, gold ribbon and bow.
 * "opening" runs the ~1.8s unwrap: shake, ribbon pop, lid flies up and tilts, light rays.
 */
export function GiftBox({ state = "idle", size = 230, jackpot = false }: { state?: GiftState; size?: number; jackpot?: boolean }) {
  const reduce = useReducedMotion();
  const opening = state === "opening";
  const open = state === "open";
  const moving = state === "idle" && !reduce;

  const shake = opening && !reduce
    ? { x: [0, -6, 6, -8, 8, -10, 10, -6, 6, 0], rotate: [0, -2, 2, -3, 3, -4, 4, -2, 2, 0], y: 0 }
    : moving
      ? { y: [0, -8, 0, 0, 0, 0], rotate: [0, 0, -3, 3, -2, 0], x: 0 }
      : { x: 0, y: 0, rotate: 0 };
  const shakeTransition = opening
    ? { duration: reduce ? 0.2 : 0.9, ease: "easeInOut" as const }
    : moving
      ? { duration: 3.6, repeat: Infinity, repeatDelay: 1.4, times: [0, 0.2, 0.5, 0.6, 0.7, 0.8], ease: "easeInOut" as const }
      : { duration: 0 };

  const lidOff = opening || open;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Soft gold glow */}
      <div
        aria-hidden
        className="absolute inset-[-22%] rounded-full"
        style={{ background: `radial-gradient(circle, rgba(243,213,140,${jackpot ? 0.55 : 0.35}) 0%, rgba(212,168,75,0.12) 45%, rgba(15,61,46,0) 70%)` }}
      />
      {/* Light rays */}
      <motion.div
        aria-hidden
        className="absolute inset-[-40%]"
        initial={false}
        animate={lidOff ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
        transition={{ delay: opening && !reduce ? 1.0 : 0, duration: 0.6, ease: "easeOut" }}
      >
        <div
          className="h-full w-full rays-spin rounded-full"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(243,213,140,0.55) 0deg 7deg, rgba(243,213,140,0) 7deg 24deg)",
            maskImage: "radial-gradient(circle, black 15%, transparent 65%)",
            WebkitMaskImage: "radial-gradient(circle, black 15%, transparent 65%)",
          }}
        />
      </motion.div>

      <motion.svg
        viewBox="0 0 240 240"
        width={size}
        height={size}
        className="relative overflow-visible"
        role="img"
        aria-label="A wrapped Christmas gift"
        initial={false}
        animate={shake}
        transition={shakeTransition}
      >
        <defs>
          <linearGradient id="gbBox" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C8303E" />
            <stop offset="1" stopColor="#951A26" />
          </linearGradient>
          <linearGradient id="gbGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F3D58C" />
            <stop offset="0.5" stopColor="#D4A84B" />
            <stop offset="1" stopColor="#B8892F" />
          </linearGradient>
        </defs>
        {/* shadow */}
        <ellipse cx="120" cy="226" rx="84" ry="9" fill="#000" opacity="0.22" />
        {/* box body */}
        <rect x="42" y="112" width="156" height="110" rx="10" fill="url(#gbBox)" />
        <rect x="42" y="112" width="156" height="14" fill="#000" opacity="0.12" />
        <rect x="108" y="112" width="24" height="110" fill="url(#gbGold)" />
        {/* inner glow when open */}
        <motion.ellipse
          cx="120" cy="114" rx="70" ry="10" fill="#FFF1C9"
          initial={false}
          animate={{ opacity: lidOff ? 0.9 : 0 }}
          transition={{ delay: opening && !reduce ? 1.0 : 0, duration: 0.3 }}
        />

        {/* lid + bow */}
        <motion.g
          style={{ transformBox: "fill-box", originX: 0.5, originY: 1 }}
          initial={false}
          animate={lidOff ? { y: reduce ? -40 : -150, x: reduce ? 0 : 30, rotate: reduce ? 0 : -28, opacity: reduce ? 0 : 1 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
          transition={{ delay: opening && !reduce ? 1.0 : 0, duration: reduce ? 0.3 : 0.55, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <rect x="32" y="84" width="176" height="34" rx="8" fill="#C8303E" />
          <rect x="32" y="108" width="176" height="10" rx="4" fill="#000" opacity="0.1" />
          <rect x="108" y="84" width="24" height="34" fill="url(#gbGold)" />
          <motion.g
            style={{ transformBox: "fill-box", originX: 0.5, originY: 1 }}
            initial={false}
            animate={opening && !reduce ? { scale: [1, 1, 1.35, 1.05] } : { scale: 1 }}
            transition={{ duration: 1.1, times: [0, 0.75, 0.88, 1] }}
          >
            <path d="M120 84 C 96 52, 62 56, 70 76 C 74 86, 100 86, 120 84 Z" fill="url(#gbGold)" />
            <path d="M120 84 C 144 52, 178 56, 170 76 C 166 86, 140 86, 120 84 Z" fill="url(#gbGold)" />
            <path d="M120 84 C 104 66, 84 66, 84 74" stroke="#B8892F" strokeWidth="3" fill="none" opacity="0.6" />
            <path d="M120 84 C 136 66, 156 66, 156 74" stroke="#B8892F" strokeWidth="3" fill="none" opacity="0.6" />
            <path d="M114 86 L 100 112 L 110 110 L 116 118 Z" fill="#B8892F" />
            <path d="M126 86 L 140 112 L 130 110 L 124 118 Z" fill="#B8892F" />
            <rect x="110" y="74" width="20" height="16" rx="6" fill="#E2BC63" />
          </motion.g>
        </motion.g>
      </motion.svg>
    </div>
  );
}

/** Small static gift for headers (no animation). */
export function MiniGift({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect x="10" y="28" width="44" height="30" rx="4" fill="#B3202E" />
      <rect x="7" y="20" width="50" height="11" rx="3" fill="#C8303E" />
      <rect x="28" y="20" width="8" height="38" fill="#D4A84B" />
      <path d="M32 20 C 24 8, 12 10, 15 17 C 17 21, 26 21, 32 20 Z" fill="#D4A84B" />
      <path d="M32 20 C 40 8, 52 10, 49 17 C 47 21, 38 21, 32 20 Z" fill="#D4A84B" />
    </svg>
  );
}
