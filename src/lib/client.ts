"use client";
import { createPublicClient, encodeFunctionData, http, type Hex, type LocalAccount } from "viem";
import { contriAbi, tokenAbi } from "./abi";
import { addresses, chain } from "./config";
import { signPermit, signRequest } from "./meta";

export const publicClient = createPublicClient({ chain, transport: http(), batch: { multicall: true } });

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
  return json as T;
}

async function send(account: LocalAccount, data: Hex) {
  const request = await signRequest(publicClient, account, data);
  return post<{ hash: Hex }>("/api/relay", { request });
}

export const balanceOf = (who: `0x${string}`) =>
  publicClient.readContract({ address: addresses.token!, abi: tokenAbi, functionName: "balanceOf", args: [who] });

export const nameOf = (who: `0x${string}`) =>
  publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "nameOf", args: [who] });

export const faucet = (address: string) => post<{ hash: Hex }>("/api/faucet", { address });

/** Top up from the testnet faucet until the wallet holds `need`. */
export async function ensureFunds(account: LocalAccount, need: bigint) {
  for (let i = 0; i < 6; i++) {
    if ((await balanceOf(account.address)) >= need) return;
    await faucet(account.address);
  }
  throw new Error("Couldn't add test dollars to your wallet. Try again in a minute.");
}

export const actions = {
  setName: (a: LocalAccount, name: string) => send(a, encodeFunctionData({ abi: contriAbi, functionName: "setName", args: [name] })),

  async create(a: LocalAccount, p: { name: string; contribution: bigint; deposit: bigint; period: bigint; size: number }) {
    if (p.deposit > 0n) {
      const s = await signPermit(publicClient, a, p.deposit);
      return send(
        a,
        encodeFunctionData({
          abi: contriAbi,
          functionName: "createWithPermit",
          args: [addresses.token!, p.name, p.contribution, p.deposit, p.period, p.size, s.value, s.deadline, s.v, s.r, s.s],
        }),
      );
    }
    return send(a, encodeFunctionData({ abi: contriAbi, functionName: "create", args: [addresses.token!, p.name, p.contribution, p.deposit, p.period, p.size] }));
  },

  async join(a: LocalAccount, id: bigint, deposit: bigint) {
    if (deposit === 0n) return send(a, encodeFunctionData({ abi: contriAbi, functionName: "join", args: [id] }));
    const s = await signPermit(publicClient, a, deposit);
    return send(a, encodeFunctionData({ abi: contriAbi, functionName: "joinWithPermit", args: [id, s.value, s.deadline, s.v, s.r, s.s] }));
  },

  async contribute(a: LocalAccount, id: bigint, amount: bigint) {
    const s = await signPermit(publicClient, a, amount);
    return send(a, encodeFunctionData({ abi: contriAbi, functionName: "contributeWithPermit", args: [id, s.value, s.deadline, s.v, s.r, s.s] }));
  },

  settle: (a: LocalAccount, id: bigint) => send(a, encodeFunctionData({ abi: contriAbi, functionName: "settleRound", args: [id] })),
  withdraw: (a: LocalAccount, id: bigint) => send(a, encodeFunctionData({ abi: contriAbi, functionName: "withdrawDeposit", args: [id] })),
  leave: (a: LocalAccount, id: bigint) => send(a, encodeFunctionData({ abi: contriAbi, functionName: "leave", args: [id] })),
  cancel: (a: LocalAccount, id: bigint) => send(a, encodeFunctionData({ abi: contriAbi, functionName: "cancel", args: [id] })),

  demo: (id: bigint, action: "fill" | "pay") => post<{ done: string[] }>("/api/demo", { id: Number(id), action }),
};
