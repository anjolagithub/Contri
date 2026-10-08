"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { contriAbi } from "./abi";
import { addresses, deployed } from "./config";
import { publicClient } from "./client";
import type { Circle, CircleStatus } from "./types";

export async function loadCircle(id: bigint): Promise<Circle | null> {
  const [[c, members], marks] = await Promise.all([
    publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "getCircle", args: [id] }),
    publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "history", args: [id] }),
  ]);
  if (c.size === 0) return null;
  return {
    id,
    token: c.token,
    creator: c.creator,
    contribution: c.contribution,
    deposit: c.deposit,
    period: Number(c.period),
    deadline: Number(c.deadline),
    size: c.size,
    round: c.round,
    activeCount: c.activeCount,
    paidCount: c.paidCount,
    status: c.status as CircleStatus,
    pot: c.pot,
    name: c.name,
    members: members.map((m) => ({ ...m })),
    marks: marks.map((r) => r.map(Number)),
  };
}

function usePoll<T>(load: (() => Promise<T>) | null, ms: number) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const refresh = useCallback(async () => {
    if (!loadRef.current) return;
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  const active = Boolean(load);
  useEffect(() => {
    if (!active) return;
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, ms);
    return () => clearInterval(t);
  }, [active, ms, refresh]);
  return { data, error, refresh };
}

export function useCircle(id: bigint | null) {
  return usePoll(deployed && id ? () => loadCircle(id) : null, 2500);
}

export function useMyCircles(address: Address | undefined) {
  return usePoll(
    deployed && address
      ? async () => {
          const ids = await publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "circlesOf", args: [address] });
          const all = await Promise.all([...ids].reverse().map((id) => loadCircle(id)));
          return all.filter((c): c is Circle => Boolean(c));
        }
      : null,
    5000,
  );
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
