import { NextResponse } from "next/server";
import { CURRENCIES } from "@/lib/format";

export const revalidate = 3600;

/** USD to local currency, from a free public feed, refreshed hourly. Missing rates are omitted, never guessed. */
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
    const json = (await res.json()) as { rates?: Record<string, number>; time_last_update_unix?: number };
    const rates: Record<string, number> = {};
    for (const k of Object.keys(CURRENCIES)) if (json.rates?.[k]) rates[k] = json.rates[k];
    return NextResponse.json({ rates, updated: json.time_last_update_unix ?? null });
  } catch {
    return NextResponse.json({ rates: {}, updated: null });
  }
}
