"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  Coins,
  HourglassMedium,
  Robot,
  ShareNetwork,
  WhatsappLogo,
} from "@phosphor-icons/react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { isCancel, useApp } from "@/components/AppProvider";
import { ContributionCard } from "@/components/ContributionCard";
import { Avatar, Button } from "@/components/ui";
import { actions } from "@/lib/client";
import { addresses, EXPLORER, IS_TESTNET } from "@/lib/config";
import { useCircle, useNow } from "@/lib/hooks";
import { me, potSize, recipient } from "@/lib/circle";
import { dateLabel, local, periodNoun, short, until, usd } from "@/lib/format";
import { STATUS, type Circle } from "@/lib/types";

export default function CirclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const id = /^\d+$/.test(raw) ? BigInt(raw) : null;
  const { data: c, error, refresh } = useCircle(id);
  const isNew = useSearchParams().get("new") === "1";

  return (
    <Shell
      back={
        <Link href="/" className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 font-semibold text-indigo hover:bg-indigo-tint">
          <ArrowLeft className="h-5 w-5" weight="bold" aria-hidden /> Circles
        </Link>
      }
    >
      {c === undefined && !error && <div className="h-72 animate-pulse rounded-3xl bg-card" aria-label="Loading circle" />}
      {(c === null || id === null) && <Empty text="This circle doesn't exist. Check the link you were sent." />}
      {error && c === undefined && <Empty text="Couldn't reach the network. Pull to refresh or try again shortly." />}
      {c && <CircleView c={c} refresh={refresh} isNew={isNew} />}
    </Shell>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-card p-6 text-center text-ink-2">{text}</p>;
}

function CircleView({ c, refresh, isNew }: { c: Circle; refresh: () => Promise<void>; isNew: boolean }) {
  const { account, toast, currency, rates } = useApp();
  const now = useNow();
  const { index, member } = me(c, account?.address);
  const r = recipient(c);
  const loc = (u: bigint) => local(u, rates[currency], currency);

  // Tell people when a pot goes out.
  const lastRound = useRef({ round: c.round, status: c.status });
  useEffect(() => {
    const prev = lastRound.current;
    if (prev.status === STATUS.Active && (c.round !== prev.round || c.status === STATUS.Done)) {
      const who = c.members[prev.round];
      toast(who?.account.toLowerCase() === account?.address.toLowerCase() ? "The pot just landed in your wallet." : `Pot sent to ${who?.name || "this round's member"}.`);
    }
    lastRound.current = { round: c.round, status: c.status };
  }, [c.round, c.status, c.members, account, toast]);

  return (
    <div className="space-y-4">
      <PotBand c={c} now={now} meIndex={index} loc={loc} />
      <ActionPanel c={c} now={now} refresh={refresh} />
      {c.status === STATUS.Open && <Invite c={c} highlight={isNew} />}
      {c.status !== STATUS.Open && c.status !== STATUS.Cancelled && <ContributionCard c={c} meIndex={index} />}
      <Order c={c} meIndex={index} now={now} />
      {IS_TESTNET && <DemoTools c={c} refresh={refresh} />}
      <Details c={c} />
    </div>
  );
}

function PotBand({ c, now, meIndex, loc }: { c: Circle; now: number; meIndex: number; loc: (u: bigint) => string | null }) {
  const r = recipient(c);
  const full = potSize(c);
  const pct = full > 0n ? Number((c.pot * 100n) / full) : 0;
  return (
    <section className="adire overflow-hidden rounded-3xl px-5 pb-5 pt-5 text-white" aria-label="Pot">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[1.35rem] font-bold tracking-tight">{c.name}</h1>
        <span className="num shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[0.8rem] font-semibold">
          {c.status === STATUS.Open && `${c.members.length} of ${c.size} joined`}
          {c.status === STATUS.Active && `Round ${c.round + 1} of ${c.size}`}
          {c.status === STATUS.Done && "Finished"}
          {c.status === STATUS.Cancelled && "Called off"}
        </span>
      </div>

      {c.status === STATUS.Active && r && (
        <>
          <p className="mt-5 text-sm text-white/70">In the pot</p>
          <p className="num text-[2.9rem] font-bold leading-none tracking-[-0.03em]">
            {usd(c.pot)}
            <span className="text-[1.15rem] font-semibold text-white/60"> of {usd(full)}</span>
          </p>
          {loc(c.pot) && <p className="num mt-1 text-sm text-white/65">about {loc(c.pot)}</p>}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Pot filled">
            <div className="h-full rounded-full bg-marigold transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={r.name} address={r.account} size={34} ring="#f2b233" />
              <p className="min-w-0 truncate text-[0.95rem]">
                <b>{meIndex === c.round ? "You collect" : `${r.name || short(r.account)} collects`}</b>
                <span className="text-white/70"> this round</span>
              </p>
            </div>
            <p className={`num flex shrink-0 items-center gap-1 text-sm font-semibold ${now > c.deadline ? "text-marigold" : "text-white/80"}`}>
              <HourglassMedium className="h-4 w-4" weight="bold" aria-hidden />
              {now > c.deadline ? "Closed" : until(c.deadline, now)}
            </p>
          </div>
        </>
      )}

      {c.status === STATUS.Open && (
        <>
          <p className="mt-5 text-sm text-white/70">Each person collects</p>
          <p className="num text-[2.9rem] font-bold leading-none tracking-[-0.03em]">{usd(c.contribution * BigInt(c.size))}</p>
          <p className="mt-2 text-[0.95rem] text-white/75">
            <span className="num">{usd(c.contribution)}</span> each, every {periodNoun(c.period)}. Starts when {c.size - c.members.length} more{" "}
            {c.size - c.members.length === 1 ? "person joins" : "people join"}.
          </p>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {Array.from({ length: c.size }).map((_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < c.members.length ? "bg-marigold" : "bg-white/15"}`} />
            ))}
          </div>
        </>
      )}

      {c.status === STATUS.Done && (
        <p className="mt-5 text-[1.05rem] text-white/85">
          Every round has paid out. {c.members.filter((m) => m.received).length} of {c.members.length} members collected.
        </p>
      )}
      {c.status === STATUS.Cancelled && <p className="mt-5 text-[1.05rem] text-white/85">This circle never filled and was called off. Deposits can be withdrawn.</p>}
    </section>
  );
}

function ActionPanel({ c, now, refresh }: { c: Circle; now: number; refresh: () => Promise<void> }) {
  const { account, ready, toast, refreshBalance, currency, rates } = useApp();
  const { index, member } = me(c, account?.address);
  const [busy, setBusy] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const loc = (u: bigint) => local(u, rates[currency], currency);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await fn();
      await refresh();
      refreshBalance();
      toast(done);
      return true;
    } catch (e) {
      if (!isCancel(e)) toast(e instanceof Error ? e.message : "That didn't go through.", "late");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const overdue = c.status === STATUS.Active && now > c.deadline;

  if (c.status === STATUS.Open && !member) {
    return (
      <Panel>
        <p className="text-[0.95rem] text-ink-2">
          Join and you&apos;ll be number <b className="num text-ink">{c.members.length + 1}</b> to collect.{" "}
          {c.deposit > 0n ? (
            <>
              You lock a <b className="num text-ink">{usd(c.deposit)}</b> deposit now and get it back at the end.
            </>
          ) : (
            "No deposit needed."
          )}
        </p>
        <Button
          variant="marigold"
          className="mt-3 w-full"
          busy={busy === "join"}
          onClick={() => run("join", async () => actions.join(await ready(c.deposit), c.id, c.deposit), "You're in. Share the link so the rest can join.")}
        >
          Join this circle
        </Button>
      </Panel>
    );
  }

  if (c.status === STATUS.Open && member) {
    const creator = c.creator.toLowerCase() === account?.address.toLowerCase();
    return (
      <Panel>
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle className="h-5 w-5 text-good" weight="fill" aria-hidden /> You&apos;re in, number {index + 1} to collect
        </p>
        <p className="mt-1 text-[0.95rem] text-ink-2">The first round starts the moment the circle is full.</p>
        <div className="mt-3 flex gap-2">
          {creator ? (
            <Button variant="secondary" className="flex-1" busy={busy === "cancel"} onClick={() => run("cancel", async () => actions.cancel(await ready(), c.id), "Circle called off.")}>
              Call it off
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1" busy={busy === "leave"} onClick={() => run("leave", async () => actions.leave(await ready(), c.id), "You left. Your deposit is back in your wallet.")}>
              Leave
            </Button>
          )}
        </div>
      </Panel>
    );
  }

  if (overdue) {
    const unpaid = c.members.filter((m) => !m.removed && !m.paidThisRound);
    return (
      <Panel tone="late">
        <p className="font-semibold">This round has closed</p>
        <p className="mt-1 text-[0.95rem] text-ink-2">
          {unpaid.length} {unpaid.length === 1 ? "member hasn't" : "members haven't"} paid. Anyone can settle it: deposits cover the missing payments, then the pot goes out.
        </p>
        <div className="mt-3 flex gap-2">
          {member && !member.paidThisRound && !member.removed && (
            <Button variant="marigold" className="flex-1" busy={busy === "pay"} onClick={() => run("pay", async () => actions.contribute(await ready(c.contribution), c.id, c.contribution), "Paid.")}>
              Pay {usd(c.contribution)} now
            </Button>
          )}
          <Button variant="primary" className="flex-1" busy={busy === "settle"} onClick={() => run("settle", async () => actions.settle(await ready(), c.id), "Round settled.")}>
            Settle the round
          </Button>
        </div>
      </Panel>
    );
  }

  if (c.status === STATUS.Active && member && !member.removed && !member.paidThisRound) {
    return (
      <Panel tone="turn">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.95rem] text-ink-2">Your payment for round {c.round + 1}</p>
            <p className="num text-[1.9rem] font-bold leading-tight tracking-tight">{usd(c.contribution)}</p>
            {loc(c.contribution) && <p className="num text-sm text-ink-2">about {loc(c.contribution)}</p>}
          </div>
          <p className="num pb-1 text-sm text-ink-2">due {dateLabel(c.deadline, c.period)}</p>
        </div>
        <Button
          variant="primary"
          className="mt-3 w-full"
          busy={busy === "pay"}
          onClick={async () => {
            const ok = await run("pay", async () => actions.contribute(await ready(c.contribution), c.id, c.contribution), index === c.round ? "Paid. It's your pot this round." : "Paid. Your box is stamped.");
            if (ok) setJustPaid(true);
          }}
        >
          <Coins className="h-5 w-5" weight="bold" aria-hidden /> Pay {usd(c.contribution)}
        </Button>
      </Panel>
    );
  }

  if (c.status === STATUS.Active && member?.paidThisRound) {
    const left = c.activeCount - c.paidCount;
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-indigo text-[0.6rem] font-black uppercase tracking-wider text-indigo ${justPaid ? "stamp-in" : "rotate-[-8deg]"}`}>
            Paid
          </span>
          <div>
            <p className="font-semibold">You&apos;ve paid round {c.round + 1}</p>
            <p className="text-[0.95rem] text-ink-2">
              Waiting for {left} more. {left > 0 && "Nudge them on WhatsApp."}
            </p>
          </div>
        </div>
        {left > 0 && <NudgeButton c={c} />}
      </Panel>
    );
  }

  if ((c.status === STATUS.Done || c.status === STATUS.Cancelled) && member && member.deposit > 0n) {
    return (
      <Panel tone="turn">
        <p className="font-semibold">Your deposit is ready</p>
        <p className="num text-[1.9rem] font-bold leading-tight tracking-tight">{usd(member.deposit)}</p>
        <Button variant="primary" className="mt-3 w-full" busy={busy === "withdraw"} onClick={() => run("withdraw", async () => actions.withdraw(await ready(), c.id), "Deposit is back in your wallet.")}>
          Withdraw deposit
        </Button>
      </Panel>
    );
  }

  if (member?.removed) {
    return (
      <Panel tone="late">
        <p className="font-semibold">You were removed from this circle</p>
        <p className="mt-1 text-[0.95rem] text-ink-2">A payment was missed after your deposit had run out, so your turn to collect passed to the rest of the circle.</p>
      </Panel>
    );
  }

  return null;
}

function Panel({ children, tone }: { children: React.ReactNode; tone?: "turn" | "late" }) {
  const cls = tone === "turn" ? "border-marigold/60 bg-marigold-tint/70" : tone === "late" ? "border-late/25 bg-late-tint/60" : "border-rule bg-card";
  return <section className={`rounded-2xl border p-4 ${cls}`}>{children}</section>;
}

function inviteUrl(c: Circle) {
  return typeof window === "undefined" ? "" : `${window.location.origin}/c/${c.id}`;
}

function Invite({ c, highlight }: { c: Circle; highlight: boolean }) {
  const { toast } = useApp();
  const url = inviteUrl(c);
  const text = `Join "${c.name}" on Contri: ${usd(c.contribution)} every ${periodNoun(c.period)}, ${c.size} of us, each person collects ${usd(c.contribution * BigInt(c.size))} once. No one holds the money. ${url}`;
  return (
    <section className={`rounded-2xl border bg-card p-4 ${highlight ? "border-indigo ring-4 ring-indigo/10" : "border-rule"}`} aria-labelledby="invite">
      <h2 id="invite" className="font-bold">
        {highlight ? "Your circle is live. Invite your people" : "Invite people"}
      </h2>
      <p className="mt-1 text-[0.95rem] text-ink-2">They open the link, pick a name and join. No app, no seed phrase.</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-mist px-3 py-2.5">
        <span className="num min-w-0 flex-1 truncate text-sm text-ink-2">{url.replace(/^https?:\/\//, "")}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(url).then(() => toast("Link copied."))}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-indigo hover:bg-indigo-tint"
        >
          <Copy className="h-4 w-4" weight="bold" aria-hidden /> Copy
        </button>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Button href={`https://wa.me/?text=${encodeURIComponent(text)}`} variant="primary" className="flex-1">
          <WhatsappLogo className="h-5 w-5" weight="fill" aria-hidden /> WhatsApp
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            if (navigator.share) navigator.share({ title: c.name, text, url }).catch(() => {});
            else navigator.clipboard?.writeText(text).then(() => toast("Invite copied."));
          }}
        >
          <ShareNetwork className="h-5 w-5" weight="bold" aria-hidden /> Share
        </Button>
      </div>
    </section>
  );
}

function NudgeButton({ c }: { c: Circle }) {
  const waiting = c.members.filter((m) => !m.removed && !m.paidThisRound).map((m) => m.name || "someone");
  const r = recipient(c);
  const text = `Ajo reminder for "${c.name}": round ${c.round + 1} goes to ${r?.name || "this round's member"} once everyone pays ${usd(c.contribution)}. Still waiting on ${waiting.join(", ")}. ${inviteUrl(c)}`;
  return (
    <Button href={`https://wa.me/?text=${encodeURIComponent(text)}`} variant="secondary" className="mt-3 w-full">
      <WhatsappLogo className="h-5 w-5 text-good" weight="fill" aria-hidden /> Send a reminder
    </Button>
  );
}

function Order({ c, meIndex, now }: { c: Circle; meIndex: number; now: number }) {
  return (
    <section aria-labelledby="order" className="rounded-2xl border border-rule bg-card">
      <h2 id="order" className="px-4 pb-1 pt-3.5 font-bold">
        Who collects when
      </h2>
      <ol className="divide-y divide-rule-soft">
        {Array.from({ length: c.size }).map((_, i) => {
          const m = c.members[i];
          if (!m)
            return (
              <li key={i} className="flex items-center gap-3 px-4 py-3 text-ink-3">
                <span className="num w-5 text-center text-sm font-semibold">{i + 1}</span>
                <span className="h-9 w-9 rounded-full border-2 border-dashed border-rule" aria-hidden />
                <span className="text-[0.95rem]">Open spot</span>
              </li>
            );
          const isMe = i === meIndex;
          const current = c.status === STATUS.Active && i === c.round;
          let when: React.ReactNode = null;
          if (m.removed) when = <span className="text-late">Removed</span>;
          else if (m.received) when = <span className="text-good">Collected</span>;
          else if (current) when = <span className="font-semibold text-marigold-deep">{now > c.deadline ? "Collecting now" : `Collecting · ${until(c.deadline, now)}`}</span>;
          else if (c.status === STATUS.Active && i > c.round) when = <span className="num">~{dateLabel(c.deadline + (i - c.round) * c.period, c.period)}</span>;
          else if (c.status === STATUS.Open) when = <span className="num">Round {i + 1}</span>;
          return (
            <li key={m.account} className={`flex items-center gap-3 px-4 py-3 ${current ? "bg-marigold-tint/50" : ""}`}>
              <span className="num w-5 text-center text-sm font-semibold text-ink-3">{i + 1}</span>
              <Avatar name={m.name} address={m.account} size={36} ring={current ? "#f2b233" : undefined} />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${m.removed ? "text-ink-3 line-through" : ""}`}>
                  {m.name || short(m.account)}
                  {isMe && <span className="ml-1.5 rounded-md bg-indigo-tint px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-indigo">You</span>}
                </p>
                {m.strikes > 0 && !m.removed && (
                  <p className="text-[0.8rem] text-covered">
                    Deposit covered {m.strikes} {m.strikes === 1 ? "payment" : "payments"}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm text-ink-2">{when}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DemoTools({ c, refresh }: { c: Circle; refresh: () => Promise<void> }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const canFill = c.status === STATUS.Open;
  const demoUnpaid = c.status === STATUS.Active && c.members.some((m) => !m.removed && !m.paidThisRound && m.name && /^(Ada|Chidi|Kemi|Musa|Funke|Emeka|Zainab|Tunde|Ngozi|Bayo|Amaka)$/.test(m.name));
  if (!canFill && !demoUnpaid) return null;
  return (
    <section className="rounded-2xl border border-dashed border-ink-3/40 p-4" aria-label="Testnet demo">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
        <Robot className="h-4 w-4" weight="bold" aria-hidden /> Testnet demo
      </p>
      <p className="mt-1 text-sm text-ink-2">
        {canFill ? "No friends to hand? Fill the open spots with demo members. Each one signs its own join, just like a real person." : "Have the demo members pay this round."}
      </p>
      <Button
        variant="secondary"
        className="mt-3 w-full"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await actions.demo(c.id, canFill ? "fill" : "pay");
            await refresh();
            toast(r.done.length ? `${r.done.join(", ")} ${canFill ? "joined" : "paid"}.` : "Nothing to do.");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Demo failed.", "late");
          } finally {
            setBusy(false);
          }
        }}
      >
        {canFill ? "Fill with demo members" : "Demo members pay"}
      </Button>
    </section>
  );
}

function Details({ c }: { c: Circle }) {
  const rows: [string, React.ReactNode][] = [
    ["Each round", <span key="a" className="num">{usd(c.contribution)} every {periodNoun(c.period)}</span>],
    ["Deposit", <span key="b" className="num">{c.deposit > 0n ? usd(c.deposit) : "None"}</span>],
    ["Members", <span key="c" className="num">{c.size}</span>],
    [
      "Held by",
      EXPLORER && addresses.contri ? (
        <a key="d" href={`${EXPLORER}/address/${addresses.contri}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo hover:underline">
          Contri contract <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : (
        "Contri contract"
      ),
    ],
  ];
  return (
    <section aria-label="Circle rules" className="rounded-2xl border border-rule bg-card px-4 py-1.5">
      <dl className="divide-y divide-rule-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-[0.95rem]">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-rule-soft py-3 text-sm leading-snug text-ink-2">
        The contract holds each payment only until the round completes, then sends the whole pot to that round&apos;s member. Nobody, including the person who started the circle, can take it out early.
      </p>
    </section>
  );
}
