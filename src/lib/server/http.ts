import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./relayer";

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "The relayer hit an error. Try again." }, { status: 500 });
}
