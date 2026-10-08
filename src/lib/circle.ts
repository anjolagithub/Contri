import type { Address } from "viem";
import { STATUS, type Circle } from "./types";

export function me(c: Circle, who?: Address) {
  if (!who) return { index: -1, member: undefined };
  const index = c.members.findIndex((m) => m.account.toLowerCase() === who.toLowerCase());
  return { index, member: index >= 0 ? c.members[index] : undefined };
}

export const recipient = (c: Circle) => c.members[c.round];
export const potSize = (c: Circle) => c.contribution * BigInt(c.activeCount);

/** One short line about where this circle stands for this person. */
export function headline(c: Circle, who?: Address, now = Math.floor(Date.now() / 1000)): { text: string; tone: "turn" | "wait" | "done" | "late" } {
  const { index, member } = me(c, who);
  if (c.status === STATUS.Cancelled) return { text: "Called off before it started", tone: "done" };
  if (c.status === STATUS.Done) {
    return member && member.deposit > 0n ? { text: "Finished. Your deposit is ready to withdraw", tone: "turn" } : { text: "Finished", tone: "done" };
  }
  if (c.status === STATUS.Open) {
    const left = c.size - c.members.length;
    return { text: `Waiting for ${left} more ${left === 1 ? "person" : "people"} to join`, tone: "wait" };
  }
  if (member?.removed) return { text: "You were removed after missed payments", tone: "late" };
  if (now > c.deadline) return { text: "Round closed. Anyone can settle it now", tone: "late" };
  if (member && !member.paidThisRound) return { text: "Your turn to pay this round", tone: "turn" };
  const r = recipient(c);
  if (index === c.round) return { text: "You collect this round", tone: "turn" };
  const left = c.activeCount - c.paidCount;
  return { text: `${r?.name || "Someone"} collects when ${left} more ${left === 1 ? "pays" : "pay"}`, tone: "wait" };
}
