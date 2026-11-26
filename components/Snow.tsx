/** Gentle falling snow: small cream dots, low opacity. Pure CSS, deterministic (no hydration mismatch). */
export function Snow({ count = 40 }: { count?: number }) {
  const flakes = Array.from({ length: count }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1;
    const size = 2 + r(1) * 4;
    return {
      left: `${(r(2) * 100).toFixed(2)}%`,
      width: `${size.toFixed(1)}px`,
      height: `${size.toFixed(1)}px`,
      opacity: (0.12 + r(3) * 0.35).toFixed(2),
      animationDuration: `${(9 + r(4) * 14).toFixed(1)}s`,
      animationDelay: `-${(r(5) * 20).toFixed(1)}s`,
      ["--drift" as string]: `${Math.round((r(6) - 0.5) * 80)}px`,
    } as React.CSSProperties;
  });
  return (
    <div className="snow" aria-hidden="true">
      {flakes.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}
