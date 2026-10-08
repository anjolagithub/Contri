"use client";

import { STATUS, type Circle } from "@/lib/types";

/**
 * The digital version of the alajo's contribution card: a row per member, a column per round.
 * A box gets an ink stamp when that member pays; the box where a member collects is ringed in
 * marigold, and filled once the pot has landed.
 */
export function ContributionCard({ c, meIndex }: { c: Circle; meIndex: number }) {
  const rounds = Array.from({ length: c.size }, (_, r) => r);
  const current = c.status === STATUS.Active ? c.round : -1;
  return (
    <section aria-labelledby="card" className="surface p-4">
      <div className="mb-3 space-y-1.5">
        <h2 id="card" className="font-bold">
          Contribution card
        </h2>
        <Legend />
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <caption className="sr-only">Who has paid each round</caption>
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Member
              </th>
              {rounds.map((r) => (
                <th key={r} scope="col" className={`num min-w-8 text-center text-[0.75rem] font-semibold ${r === current ? "text-indigo" : "text-ink-3"}`}>
                  R{r + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.members.map((m, i) => {
              const settled = c.status === STATUS.Done ? c.marks.length : c.round;
              const removedAt = m.removed ? c.marks.findIndex((row, r) => r < Math.max(settled, 1) && row[i] === 0) : -1;
              return (
              <tr key={m.account}>
                <th scope="row" className={`sticky left-0 max-w-[5.5rem] truncate bg-card pr-1 text-left font-medium ${i === meIndex ? "text-indigo" : "text-ink-2"} ${m.removed ? "line-through" : ""}`}>
                  {i === meIndex ? "You" : m.name || `#${i + 1}`}
                </th>
                {rounds.map((r) => {
                  const mark = c.marks[r]?.[i] ?? 0;
                  const isCurrent = r === current;
                  const collects = r === i;
                  const past = r < (c.status === STATUS.Done ? c.size : c.round);
                  const label = cellLabel(m.name || `Member ${i + 1}`, r, mark, collects, m.received, past, m.removed);
                  return (
                    <td key={r} className="p-0">
                      <span
                        title={label}
                        aria-label={label}
                        className={`relative flex h-8 min-w-8 items-center justify-center rounded-lg border ${
                          isCurrent ? "border-indigo/30 bg-indigo-tint/70" : "border-rule-soft"
                        } ${collects ? "!border-marigold border-2" : ""}`}
                      >
                        {collects && m.received && <span className="absolute inset-[3px] rounded-[5px] bg-marigold/35" aria-hidden />}
                        {mark === 1 && <Stamp fresh={isCurrent && i === meIndex} />}
                        {mark === 2 && <Stamp covered />}
                        {r === removedAt && <span className="text-[0.75rem] font-bold text-late">✕</span>}
                      </span>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function cellLabel(name: string, r: number, mark: number, collects: boolean, received: boolean, past: boolean, removed: boolean) {
  const parts = [`${name}, round ${r + 1}:`];
  if (mark === 1) parts.push("paid");
  else if (mark === 2) parts.push("covered by deposit");
  else if (removed && past) parts.push("missed, removed");
  else parts.push(past ? "not paid" : "not yet due or unpaid");
  if (collects) parts.push(received ? "collected the pot" : "collects this round");
  return parts.join(" ");
}

function Stamp({ covered, fresh }: { covered?: boolean; fresh?: boolean }) {
  return (
    <span
      className={`relative flex h-[22px] w-[22px] items-center justify-center rounded-full border-[2.5px] ${covered ? "border-covered text-covered" : "border-indigo text-indigo"} ${fresh ? "stamp-in" : "rotate-[-8deg]"}`}
      aria-hidden
    >
      {covered ? (
        <span className="text-[0.55rem] font-black">D</span>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1.5 5.2l2.2 2.2L8.5 2.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function Legend() {
  return (
    <ul className="flex items-center gap-2.5 text-[0.75rem] text-ink-2" aria-label="Key">
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-indigo" aria-hidden /> Paid
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-covered" aria-hidden /> Deposit
      </li>
      <li className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-[3px] border-2 border-marigold" aria-hidden /> Collects
      </li>
    </ul>
  );
}
