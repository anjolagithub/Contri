import { formatUnits, parseUnits } from "viem";
import { TOKEN_DECIMALS } from "./config";

export const toUnits = (dollars: string | number) => parseUnits(String(dollars), TOKEN_DECIMALS);
export const fromUnits = (units: bigint) => Number(formatUnits(units, TOKEN_DECIMALS));

/** $1,250 or $12.50: cents only when there are any. */
export function usd(units: bigint | number) {
  const n = typeof units === "bigint" ? fromUnits(units) : units;
  const cents = Math.round(n * 100) % 100 !== 0;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

export const CURRENCIES = {
  NGN: { symbol: "₦", label: "Naira" },
  GHS: { symbol: "GH₵", label: "Cedi" },
  KES: { symbol: "KSh", label: "Shilling" },
  ZAR: { symbol: "R", label: "Rand" },
  GBP: { symbol: "£", label: "Pound" },
  EUR: { symbol: "€", label: "Euro" },
  CAD: { symbol: "CA$", label: "Canadian dollar" },
} as const;
export type Currency = keyof typeof CURRENCIES;

export function local(units: bigint, rate: number | undefined, cur: Currency) {
  if (!rate) return null;
  const v = fromUnits(units) * rate;
  const digits = v >= 1000 ? 0 : 2;
  return CURRENCIES[cur].symbol + v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const PERIODS = [
  { seconds: 7 * 86400, label: "Every week", noun: "week" },
  { seconds: 14 * 86400, label: "Every 2 weeks", noun: "2 weeks" },
  { seconds: 30 * 86400, label: "Every month", noun: "month" },
  { seconds: 180, label: "Every 3 min (demo)", noun: "3 minutes" },
] as const;

export function periodNoun(seconds: number) {
  return PERIODS.find((p) => p.seconds === seconds)?.noun ?? `${Math.round(seconds / 60)} minutes`;
}

export function until(deadline: number, now: number) {
  const s = Math.max(0, deadline - now);
  if (s === 0) return "now";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

/** "12 Oct", or a time of day for circles that run faster than daily (demo circles). */
export function dateLabel(ts: number, period = 86400) {
  const d = new Date(ts * 1000);
  if (period < 86400) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
