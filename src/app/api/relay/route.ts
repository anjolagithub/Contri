import { NextResponse } from "next/server";
import { isAddress, isHex } from "viem";
import { relay, HttpError } from "@/lib/server/relayer";
import type { SignedRequest } from "@/lib/meta";
import { fail } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { request?: SignedRequest };
    const r = body.request;
    if (!r || !isAddress(r.from) || !isAddress(r.to) || !isHex(r.data) || !isHex(r.signature) || typeof r.deadline !== "number") {
      throw new HttpError(400, "Malformed request.");
    }
    return NextResponse.json(await relay(r));
  } catch (e) {
    return fail(e);
  }
}
