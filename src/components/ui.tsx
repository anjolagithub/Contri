"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CircleNotch, X } from "@phosphor-icons/react";

/** A ring of members; one, the collector of the round, is marigold. */
export function Mark({ size = 26, light = false }: { size?: number; light?: boolean }) {
  const dots = 7;
  const c = size / 2;
  const r = size * 0.36;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {Array.from({ length: dots }).map((_, i) => {
        const a = (i / dots) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={c + r * Math.cos(a)}
            cy={c + r * Math.sin(a)}
            r={i === 0 ? size * 0.12 : size * 0.075}
            fill={i === 0 ? "#e2ae4a" : light ? "#ffffff" : "#19205a"}
          />
        );
      })}
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 display text-[1.4rem] font-bold tracking-[-0.04em] ${light ? "text-white" : "text-indigo"}`}>
      <Mark light={light} />
      contri
    </Link>
  );
}

const PALETTE = ["#19205a", "#2d5e52", "#7b3a57", "#5a4a9e", "#8a5a1c", "#2a5680", "#4f5e2a", "#93402f"];

export function Avatar({ name, address, size = 36, ring, stacked }: { name: string; address: string; size?: number; ring?: string; stacked?: boolean }) {
  const seed = parseInt(address.slice(2, 8), 16);
  const bg = PALETTE[seed % PALETTE.length];
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38, boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : stacked ? "0 0 0 2px #fff" : undefined }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "marigold" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  type?: "button" | "submit";
  href?: string;
};

const VARIANT = {
  primary:
    "bg-indigo text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_8px_20px_-10px_rgb(13_18_54/0.7)] hover:bg-indigo-hi active:bg-indigo-deep disabled:bg-ink-3/50 disabled:shadow-none",
  marigold:
    "bg-marigold text-indigo-deep shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_8px_20px_-10px_rgb(122_82_0/0.55)] hover:brightness-[1.04] active:brightness-95 disabled:opacity-60",
  secondary: "bg-card text-ink shadow-[inset_0_0_0_1px_var(--color-rule)] hover:shadow-[inset_0_0_0_1px_var(--color-ink-3)] active:bg-mist disabled:text-ink-3",
  quiet: "text-indigo hover:bg-indigo-tint active:bg-indigo-tint disabled:text-ink-3",
  danger: "bg-card text-late border border-late/30 hover:bg-late-tint",
};

export function Button({ children, onClick, variant = "primary", disabled, busy, className = "", type = "button", href }: BtnProps) {
  const cls = `inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl px-5 text-[1rem] font-semibold tracking-[-0.01em] transition-[background-color,border-color,filter,transform] duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT[variant]} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={cls} aria-busy={busy || undefined}>
      {busy && <CircleNotch className="h-5 w-5 animate-spin" weight="bold" aria-hidden />}
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="fade-in absolute inset-0 bg-indigo-deep/50" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className="sheet-up relative w-full max-w-[440px] rounded-t-[1.75rem] bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[1.75rem]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="display text-[1.35rem] font-bold leading-tight tracking-[-0.02em]">{title}</h2>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-2 hover:bg-mist" aria-label="Close">
            <X className="h-5 w-5" weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, tone = "ink", onDone }: { message: string; tone?: "ink" | "late"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, tone === "late" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [message, tone, onDone]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className={`sheet-up pointer-events-auto max-w-[408px] rounded-2xl px-4 py-3 text-[0.95rem] font-medium text-white shadow-xl ${tone === "late" ? "bg-late" : "bg-ink"}`}>
        {message}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-[0.95rem] font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-ink-2">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-2xl border-0 bg-card px-4 py-3.5 text-[1.05rem] text-ink shadow-[inset_0_0_0_1px_var(--color-rule)] placeholder:text-ink-3 focus:shadow-[inset_0_0_0_1.5px_var(--color-indigo)] focus:outline-none focus:ring-4 focus:ring-indigo/10";
