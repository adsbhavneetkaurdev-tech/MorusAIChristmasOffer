"use client";
import type confettiType from "canvas-confetti";

const COLORS = ["#D4A84B", "#F3D58C", "#B3202E", "#C8303E", "#FBF6EC"];
const GOLD = ["#D4A84B", "#E2BC63", "#F3D58C", "#FBF6EC"];

let lib: typeof confettiType | null = null;
async function load() {
  if (!lib) lib = (await import("canvas-confetti")).default;
  return lib;
}

function reduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function burstConfetti(big = false) {
  const c = await load();
  if (reduced()) {
    c({ particleCount: 30, spread: 60, origin: { y: 0.5 }, colors: COLORS, disableForReducedMotion: false, ticks: 80 });
    return;
  }
  c({ particleCount: big ? 220 : 110, spread: big ? 110 : 80, startVelocity: big ? 55 : 42, origin: { y: 0.45 }, colors: COLORS, scalar: 1 });
  if (big) {
    const end = Date.now() + 1800;
    const frame = () => {
      c({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS });
      c({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }
}

export async function goldRain(durationMs = 3000) {
  const c = await load();
  if (reduced()) {
    c({ particleCount: 60, spread: 100, origin: { y: 0.4 }, colors: GOLD });
    return;
  }
  const end = Date.now() + durationMs;
  const frame = () => {
    c({ particleCount: 5, startVelocity: 0, ticks: 300, gravity: 0.6, origin: { x: Math.random(), y: -0.05 }, colors: GOLD, scalar: 1.2, drift: Math.random() - 0.5 });
    c({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: GOLD });
    c({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: GOLD });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
