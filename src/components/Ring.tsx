"use client";

/**
 * The circle itself: one arc per member around the pot. An arc turns gold when that member
 * has paid this round; the member collecting sits in the middle. As the last arc fills, the
 * pot goes out. Used large on the circle screen and small on the home list.
 */
export function Ring({
  total,
  filled,
  size = 112,
  stroke,
  onDark = false,
  children,
  label,
}: {
  total: number;
  filled: boolean[];
  size?: number;
  stroke?: number;
  onDark?: boolean;
  children?: React.ReactNode;
  label: string;
}) {
  const sw = stroke ?? Math.max(3, Math.round(size * 0.075));
  const f = (n: number) => Math.round(n * 100) / 100; // identical output on server and client
  const r = (size - sw) / 2 - 1;
  const c = size / 2;
  const gap = total > 1 ? Math.min(0.22, 2.6 / total) : 0; // radians between arcs
  const seg = (Math.PI * 2) / Math.max(total, 1);
  const empty = onDark ? "rgb(255 255 255 / 0.16)" : "var(--color-rule)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {Array.from({ length: total }).map((_, i) => {
          const a0 = -Math.PI / 2 + i * seg + gap / 2;
          const a1 = a0 + seg - gap;
          const x0 = f(c + r * Math.cos(a0));
          const y0 = f(c + r * Math.sin(a0));
          const x1 = f(c + r * Math.cos(a1));
          const y1 = f(c + r * Math.sin(a1));
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = total === 1 ? `M ${f(c)} ${f(c - r)} A ${f(r)} ${f(r)} 0 1 1 ${f(c - 0.01)} ${f(c - r)}` : `M ${x0} ${y0} A ${f(r)} ${f(r)} 0 ${large} 1 ${x1} ${y1}`;
          return <path key={i} d={d} fill="none" strokeLinecap="round" strokeWidth={sw} stroke={filled[i] ? "var(--color-marigold)" : empty} className="ring-seg" />;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
