"use client";

import Link from "next/link";
import { Wallet } from "@phosphor-icons/react";
import { deployed } from "@/lib/config";
import { usd } from "@/lib/format";
import { useApp } from "./AppProvider";
import { Wordmark } from "./ui";

export function Shell({ children, back }: { children: React.ReactNode; back?: React.ReactNode }) {
  const { account, balance } = useApp();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex h-14 items-center justify-between gap-3">
        {back ?? <Wordmark />}
        {account && (
          <Link
            href="/wallet"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rule bg-card px-3.5 text-sm font-semibold text-ink hover:border-ink-3"
            aria-label="Your wallet"
          >
            <Wallet className="h-4 w-4 text-indigo" weight="bold" aria-hidden />
            <span className="num">{balance === null ? "…" : usd(balance)}</span>
          </Link>
        )}
      </header>
      {!deployed && (
        <div className="mb-3 rounded-xl border border-covered/30 bg-covered-tint px-4 py-3 text-sm text-covered">
          This copy of Contri isn&apos;t connected to a deployment yet, so actions are switched off. See the README to connect one.
        </div>
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}
