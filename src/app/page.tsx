"use client";

import Link from "next/link";
import { ArrowRight, CaretRight, LinkSimple, Lightning, ShieldCheck, Users } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { useApp } from "@/components/AppProvider";
import { Avatar, Button, Mark } from "@/components/ui";
import { Ring } from "@/components/Ring";
import { useMyCircles, useNow } from "@/lib/hooks";
import { headline, potSize } from "@/lib/circle";
import { periodNoun, usd } from "@/lib/format";
import type { Circle } from "@/lib/types";

export default function Home() {
  const { account } = useApp();
  const { data: circles } = useMyCircles(account?.address);
  const has = circles && circles.length > 0;

  return (
    <Shell>
      {has ? (
        <section aria-labelledby="mine" className="space-y-4 pt-2">
          <div className="flex items-end justify-between">
            <h1 id="mine" className="display text-[1.85rem] font-bold leading-tight tracking-[-0.03em]">
              Your circles
            </h1>
            <Button href="/new" variant="quiet" className="!min-h-10 !px-3 text-[0.95rem]">
              Start another
            </Button>
          </div>
          <ul className="space-y-3">
            {circles!.map((c) => (
              <li key={c.id.toString()}>
                <CircleTile c={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Welcome loading={Boolean(account) && circles === undefined} />
      )}
    </Shell>
  );
}

function CircleTile({ c }: { c: Circle }) {
  const { account } = useApp();
  const now = useNow(5000);
  const h = headline(c, account?.address, now);
  const tone = {
    turn: "bg-marigold-tint text-marigold-deep",
    wait: "bg-indigo-tint text-indigo",
    done: "bg-mist text-ink-2",
    late: "bg-late-tint text-late",
  }[h.tone];
  return (
    <Link href={`/c/${c.id}`} className="surface group block p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-3.5">
        <Ring
          total={c.status === 0 ? c.size : c.members.length}
          filled={c.status === 0 ? Array.from({ length: c.size }, (_, i) => i < c.members.length) : c.members.map((m) => (c.status === 1 ? m.paidThisRound : m.received))}
          size={48}
          stroke={4.5}
          label={c.status === 0 ? "Members joined" : "Paid this round"}
        >
          <span className="num text-[0.78rem] font-semibold text-ink-2">{c.status === 1 ? `R${c.round + 1}` : `${c.members.length}/${c.size}`}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.1rem] font-semibold tracking-[-0.015em]">{c.name}</p>
          <p className="num text-[0.95rem] text-ink-2">
            {usd(c.contribution)} every {periodNoun(c.period)} · pot {usd(potSize(c) || c.contribution * BigInt(c.size))}
          </p>
        </div>
        <CaretRight className="h-5 w-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" weight="bold" aria-hidden />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {c.members.slice(0, 6).map((m) => (
            <Avatar key={m.account} name={m.name} address={m.account} size={28} stacked />
          ))}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.8rem] font-semibold ${tone}`}>{h.text}</span>
      </div>
    </Link>
  );
}

function Welcome({ loading }: { loading: boolean }) {
  if (loading) return <div className="mt-4 h-64 animate-pulse rounded-3xl bg-card" aria-label="Loading your circles" />;
  return (
    <div className="space-y-6 pt-2">
      <section className="adire relative overflow-hidden rounded-[1.75rem] px-5 pb-5 pt-8 text-white lg:pt-5">
        <h1 className="display max-w-[15ch] lg:sr-only text-[2.6rem] font-bold leading-[0.98] tracking-[-0.045em]">Your ajo, without the alajo.</h1>
        <p className="mt-3.5 max-w-[30ch] text-[1.05rem] leading-snug text-white/70 lg:hidden">
          Everyone puts in. One person collects each round. Nobody holds the money.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 lg:mt-0">
          <Button href="/new" variant="marigold" className="w-full">
            Start a circle <ArrowRight className="h-5 w-5" weight="bold" aria-hidden />
          </Button>
          <p className="flex items-center justify-center gap-1.5 pt-1 text-sm text-white/70">
            <LinkSimple className="h-4 w-4" aria-hidden /> Got an invite? Open the link your friend sent.
          </p>
        </div>
        <SampleCard />
      </section>

      <section aria-labelledby="how" className="space-y-3">
        <h2 id="how" className="display px-1 text-[1.2rem] font-bold tracking-[-0.02em]">
          How it works
        </h2>
        <ol className="surface divide-y divide-rule-soft">
          {[
            ["Set it up", "Pick the amount, how often, and who's in. Share one link on WhatsApp."],
            ["Everyone pays", "The moment the last person pays, the pot goes straight to that round's person."],
            ["Late? Covered", "Each member locks a small deposit. If someone is late, it pays their share so the pot still goes out."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3.5 px-4 py-3.5">
              <span className="num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-tint text-sm font-bold text-indigo">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-[0.95rem] leading-snug text-ink-2">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <ul className="grid grid-cols-3 gap-2 text-center text-[0.8rem] font-medium text-ink-2">
        <li className="surface !rounded-2xl px-2 py-3.5">
          <Lightning className="mx-auto mb-1 h-5 w-5 text-indigo" weight="duotone" aria-hidden />
          Paid out in under a second
        </li>
        <li className="surface !rounded-2xl px-2 py-3.5">
          <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-indigo" weight="duotone" aria-hidden />
          No one can run with the money
        </li>
        <li className="surface !rounded-2xl px-2 py-3.5">
          <Users className="mx-auto mb-1 h-5 w-5 text-indigo" weight="duotone" aria-hidden />
          No gas, no seed phrase
        </li>
      </ul>
    </div>
  );
}

/** A miniature contribution card, the same object as the real one inside a circle. */
function SampleCard() {
  const names = ["Tolu", "Ada", "Kemi", "Musa", "Ife"];
  // rounds 0-1 complete, round 2 in progress
  const marks = [
    [1, 1, 1, 1, 1],
    [1, 1, 2, 1, 1],
    [1, 0, 1, 1, 0],
  ];
  return (
    <div className="mt-6 rotate-[-1.2deg] rounded-[1.1rem] bg-card p-3.5 text-ink shadow-[0_24px_50px_-18px_rgba(0,0,0,0.6)]" aria-hidden>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Mark size={16} /> Friday ajo
        </span>
        <span className="num text-xs font-semibold text-ink-2">Round 3 of 5 · $250 pot</span>
      </div>
      <div className="grid grid-cols-[3.2rem_repeat(5,1fr)] gap-1 text-[0.7rem]">
        <span />
        {[1, 2, 3, 4, 5].map((r) => (
          <span key={r} className={`num text-center font-semibold ${r === 3 ? "text-indigo" : "text-ink-3"}`}>
            R{r}
          </span>
        ))}
        {names.map((n, i) => (
          <Row key={n} name={n} i={i} marks={marks} />
        ))}
      </div>
    </div>
  );
}

function Row({ name, i, marks }: { name: string; i: number; marks: number[][] }) {
  return (
    <>
      <span className="truncate py-1 font-medium text-ink-2">{name}</span>
      {[0, 1, 2, 3, 4].map((r) => {
        const m = marks[r]?.[i];
        const collects = r === i;
        return (
          <span
            key={r}
            className={`flex h-6 items-center justify-center rounded-md border ${r === 2 ? "border-indigo/25 bg-indigo-tint/60" : "border-rule-soft"} ${collects ? "ring-1 ring-marigold ring-inset" : ""}`}
          >
            {m === 1 && <MiniStamp />}
            {m === 2 && <MiniStamp covered />}
          </span>
        );
      })}
    </>
  );
}

function MiniStamp({ covered }: { covered?: boolean }) {
  return (
    <span className={`flex h-4 w-4 rotate-[-8deg] items-center justify-center rounded-full border-2 ${covered ? "border-covered text-covered" : "border-indigo text-indigo"}`}>
      {covered ? (
        <span className="text-[0.45rem] font-black leading-none">D</span>
      ) : (
        <svg width="7" height="7" viewBox="0 0 10 10">
          <path d="M1.5 5.2l2.2 2.2L8.5 2.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
