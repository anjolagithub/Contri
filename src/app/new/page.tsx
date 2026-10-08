"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { isCancel, useApp } from "@/components/AppProvider";
import { Button, Field, inputCls } from "@/components/ui";
import { Ring } from "@/components/Ring";
import { Money } from "@/components/Money";
import { actions, publicClient } from "@/lib/client";
import { contriAbi } from "@/lib/abi";
import { addresses, deployed } from "@/lib/config";
import { local, PERIODS, toUnits, usd } from "@/lib/format";

const AMOUNTS = [20, 50, 100, 200];
const DEPOSITS = [
  { rounds: 0, label: "None" },
  { rounds: 1, label: "1 round" },
  { rounds: 2, label: "2 rounds" },
];

export default function NewCircle() {
  const router = useRouter();
  const { ready, toast, currency, rates } = useApp();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("50");
  const [period, setPeriod] = useState<number>(PERIODS[0].seconds);
  const [size, setSize] = useState(5);
  const [depositRounds, setDepositRounds] = useState(1);
  const [busy, setBusy] = useState(false);

  const amt = Number(amount);
  const valid = name.trim().length > 0 && amt > 0 && amt <= 100000 && Number.isFinite(amt);
  const contribution = valid ? toUnits(amount) : 0n;
  const deposit = contribution * BigInt(depositRounds);
  const pot = contribution * BigInt(size);
  const p = PERIODS.find((x) => x.seconds === period)!;
  const loc = (u: bigint) => local(u, rates[currency], currency);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const a = await ready(deposit);
      await actions.create(a, { name: name.trim(), contribution, deposit, period: BigInt(period), size });
      const ids = await publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "circlesOf", args: [a.address] });
      router.push(`/c/${ids[ids.length - 1]}?new=1`);
    } catch (e) {
      if (!isCancel(e)) toast(e instanceof Error ? e.message : "Couldn't create the circle.", "late");
      setBusy(false);
    }
  }

  return (
    <Shell
      back={
        <button onClick={() => router.back()} className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 font-semibold text-indigo hover:bg-indigo-tint">
          <ArrowLeft className="h-5 w-5" weight="bold" aria-hidden /> Back
        </button>
      }
    >
      <form
        className="space-y-6 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h1 className="display text-[1.85rem] font-bold leading-tight tracking-[-0.03em]">Start a circle</h1>

        <Field label="Name" htmlFor="name">
          <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value.slice(0, 48))} placeholder="Friday ajo" autoComplete="off" />
        </Field>

        <Field label="Each person puts in" htmlFor="amount" hint={valid && loc(contribution) ? `About ${loc(contribution)} at today's rate` : undefined}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[1.05rem] font-semibold text-ink-2">$</span>
            <input
              id="amount"
              inputMode="decimal"
              className={`${inputCls} num pl-8 text-[1.25rem] font-semibold`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="flex gap-2">
            {AMOUNTS.map((a) => (
              <Chip key={a} on={amt === a} onClick={() => setAmount(String(a))}>
                ${a}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="How often">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How often">
            {PERIODS.map((x) => (
              <Chip key={x.seconds} on={period === x.seconds} onClick={() => setPeriod(x.seconds)} wide>
                {x.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="People in the circle" hint="Each person collects once, in the order they join. You're first.">
          <div className="flex items-center justify-between rounded-2xl bg-card p-1.5 shadow-[inset_0_0_0_1px_var(--color-rule)]">
            <StepBtn label="One fewer person" onClick={() => setSize((s) => Math.max(2, s - 1))} disabled={size <= 2}>
              <Minus className="h-5 w-5" weight="bold" />
            </StepBtn>
            <span className="num text-[1.35rem] font-bold" aria-live="polite">
              {size}
            </span>
            <StepBtn label="One more person" onClick={() => setSize((s) => Math.min(12, s + 1))} disabled={size >= 12}>
              <Plus className="h-5 w-5" weight="bold" />
            </StepBtn>
          </div>
        </Field>

        <Field label="Deposit" hint="Locked when someone joins and returned at the end. If a member is late, it pays their share so the pot still goes out.">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Deposit">
            {DEPOSITS.map((d) => (
              <Chip key={d.rounds} on={depositRounds === d.rounds} onClick={() => setDepositRounds(d.rounds)} wide>
                {d.label}
                {d.rounds === 1 && <span className="block text-[0.7rem] font-medium opacity-75">recommended</span>}
              </Chip>
            ))}
          </div>
        </Field>

        <section aria-label="Summary" className="adire rounded-[1.5rem] p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.8rem] font-medium uppercase tracking-[0.08em] text-white/55">Each person collects</p>
              <Money units={valid ? pot : 0n} className="mt-1 block text-[2.6rem] leading-none" />
              {valid && loc(pot) && <p className="num mt-1.5 text-sm text-white/55">about {loc(pot)}</p>}
            </div>
            <Ring total={size} filled={Array.from({ length: size }, (_, i) => i === 0)} size={76} onDark label={`${size} people`}>
              <span className="num text-[0.95rem] font-semibold">{size}</span>
            </Ring>
          </div>
          <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-[0.93rem] leading-snug text-white/75">
            <li>
              Everyone puts in <b className="num font-semibold text-white">{valid ? usd(contribution) : "$0"}</b> every {p.noun}, {size} times.
            </li>
            <li>It starts when all {size} have joined and ends after {size} rounds.</li>
            <li>
              {deposit > 0n ? (
                <>
                  You lock <b className="num font-semibold text-white">{usd(deposit)}</b> now and get it back at the end.
                </>
              ) : (
                <>No deposit: a late payment can hold up the pot.</>
              )}
            </li>
          </ul>
        </section>

        <Button type="submit" variant="primary" className="w-full" busy={busy} disabled={!valid || !deployed}>
          {busy ? "Creating…" : "Create and get invite link"}
        </Button>
      </form>
    </Shell>
  );
}

function Chip({ on, onClick, children, wide }: { on: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`min-h-12 rounded-2xl px-3 py-2 text-[0.95rem] font-semibold leading-tight transition-[background-color,box-shadow,color] duration-150 ${wide ? "w-full" : "flex-1"} ${
        on ? "bg-indigo text-white shadow-[0_8px_18px_-10px_rgb(13_18_54/0.8)]" : "bg-card text-ink shadow-[inset_0_0_0_1px_var(--color-rule)] hover:shadow-[inset_0_0_0_1px_var(--color-ink-3)]"
      }`}
    >
      {children}
    </button>
  );
}

function StepBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-lg text-indigo hover:bg-indigo-tint disabled:text-ink-3 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}
