import { usd } from "@/lib/format";

/** A money figure with a quieter dollar sign, the way banking apps set balances. */
export function Money({ units, className = "" }: { units: bigint; className?: string }) {
  const s = usd(units).slice(1);
  return (
    <span className={`figure ${className}`}>
      <span className="mr-[0.04em] align-[0.42em] text-[0.5em] font-medium opacity-60">$</span>
      {s}
    </span>
  );
}

