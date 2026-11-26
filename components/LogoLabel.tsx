/** Morus AI logo, always on a cream label (its navy "by Le Techie" needs a light background). */
export function LogoLabel({ height = 28, className = "" }: { height?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[10px] bg-cream ${className}`}
      style={{ padding: `${Math.round(height * 0.25)}px ${Math.round(height * 0.42)}px` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/morus-logo.png" alt="Morus AI by Le Techie" height={height} style={{ height, width: "auto" }} decoding="async" />
    </span>
  );
}
