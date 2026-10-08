import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { faucet, limit, HttpError } from "@/lib/server/relayer";
import { fail } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address || !isAddress(address)) throw new HttpError(400, "Bad address.");
    limit(`faucet:${address.toLowerCase()}`, 4, 24 * 60 * 60 * 1000);
    const hash = await faucet(address);
    return NextResponse.json({ hash });
  } catch (e) {
    return fail(e);
  }
}
