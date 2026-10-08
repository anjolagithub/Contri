import { NextResponse } from "next/server";
import { encodeFunctionData, type Address } from "viem";
import { contriAbi, tokenAbi } from "@/lib/abi";
import { addresses, IS_TESTNET } from "@/lib/config";
import { signPermit, signRequest } from "@/lib/meta";
import { DEMO_NAMES, demoAccount, faucet, HttpError, limit, publicClient, relay } from "@/lib/server/relayer";
import { fail } from "@/lib/server/http";

export const maxDuration = 60;

/**
 * Testnet only: fill a circle with demo members, or have the demo members pay this round,
 * so one person can see a whole circle work. Demo members sign their own requests exactly
 * like a real member would; the relayer submits them.
 */
export async function POST(req: Request) {
  try {
    if (!IS_TESTNET || process.env.DEMO_MEMBERS === "off") throw new HttpError(400, "Demo members are off here.");
    const { id, action } = (await req.json()) as { id?: number; action?: "fill" | "pay" };
    if (!id || (action !== "fill" && action !== "pay")) throw new HttpError(400, "Bad request.");
    limit(`demo:${id}:${action}`, 20, 60 * 60 * 1000);

    const [circle, members] = await publicClient.readContract({
      address: addresses.contri!,
      abi: contriAbi,
      functionName: "getCircle",
      args: [BigInt(id)],
    });
    const done: string[] = [];

    if (action === "fill") {
      if (circle.status !== 0) throw new HttpError(400, "This circle is already full.");
      const inCircle = new Set(members.map((m) => m.account.toLowerCase()));
      let i = 0;
      while (members.length + done.length < circle.size && i < DEMO_NAMES.length) {
        const acct = demoAccount(i);
        const name = DEMO_NAMES[i];
        i++;
        if (inCircle.has(acct.address.toLowerCase())) continue;
        await topUp(acct.address, circle.deposit + circle.contribution * BigInt(circle.size));
        const current = await publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "nameOf", args: [acct.address] });
        if (!current) {
          await relay(await signRequest(publicClient, acct, encodeFunctionData({ abi: contriAbi, functionName: "setName", args: [name] })));
        }
        const data =
          circle.deposit > 0n
            ? await (async () => {
                const p = await signPermit(publicClient, acct, circle.deposit);
                return encodeFunctionData({ abi: contriAbi, functionName: "joinWithPermit", args: [BigInt(id), p.value, p.deadline, p.v, p.r, p.s] });
              })()
            : encodeFunctionData({ abi: contriAbi, functionName: "join", args: [BigInt(id)] });
        await relay(await signRequest(publicClient, acct, data));
        done.push(name);
      }
    } else {
      if (circle.status !== 1) throw new HttpError(400, "This circle isn't running.");
      for (let i = 0; i < DEMO_NAMES.length; i++) {
        const acct = demoAccount(i);
        const m = members.find((x) => x.account.toLowerCase() === acct.address.toLowerCase());
        if (!m || m.removed || m.paidThisRound) continue;
        // Re-read: an earlier payment may have completed the round and moved it on.
        const [now] = await publicClient.readContract({ address: addresses.contri!, abi: contriAbi, functionName: "getCircle", args: [BigInt(id)] });
        if (now.round !== circle.round || now.status !== 1) break;
        await topUp(acct.address, circle.contribution);
        const p = await signPermit(publicClient, acct, circle.contribution);
        const data = encodeFunctionData({ abi: contriAbi, functionName: "contributeWithPermit", args: [BigInt(id), p.value, p.deadline, p.v, p.r, p.s] });
        await relay(await signRequest(publicClient, acct, data));
        done.push(DEMO_NAMES[i]);
      }
    }
    return NextResponse.json({ done });
  } catch (e) {
    return fail(e);
  }
}

async function topUp(who: Address, need: bigint) {
  for (let tries = 0; tries < 6; tries++) {
    const bal = await publicClient.readContract({ address: addresses.token!, abi: tokenAbi, functionName: "balanceOf", args: [who] });
    if (bal >= need) return;
    await faucet(who);
  }
}
