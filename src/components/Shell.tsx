"use client";

import Link from "next/link";
import { Lightning, ShieldCheck, Users, Wallet } from "@phosphor-icons/react";
import { chain, deployed } from "@/lib/config";
import { usd } from "@/lib/format";
import { useApp } from "./AppProvider";
import { Wordmark } from "./ui";

export function Shell({ children, back }: { children: React.ReactNode; back?: React.ReactNode }) {
  const { account, balance } = useApp();
  return (
    <div className="lg:flex lg:min-h-dvh lg:items-start lg:justify-center lg:gap-16 lg:px-10 lg:py-10">
      <BrandPanel />
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] lg:mx-0 lg:min-h-0 lg:pt-0">
        <header className="flex h-14 items-center justify-between gap-3">
          {back ?? (
            <span className="lg:invisible">
              <Wordmark />
            </span>
          )}
          {account && (
            <Link
              href="/wallet"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-3.5 text-sm font-semibold text-ink shadow-[var(--shadow-soft),inset_0_0_0_1px_rgb(14_17_36/0.06)] hover:shadow-[var(--shadow-lift)]"
              aria-label="Your wallet"
            >
              <Wallet className="h-4 w-4 text-indigo" weight="bold" aria-hidden />
              <span className="num">{balance === null ? "…" : usd(balance)}</span>
            </Link>
          )}
        </header>
        {!deployed && (
          <div className="mb-3 rounded-2xl bg-covered-tint px-4 py-3 text-sm text-covered">
            This copy of Contri isn&apos;t connected to a deployment yet, so actions are switched off. See the README to connect one.
          </div>
        )}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Desktop only: the brand beside the phone-width app, so wide screens don't feel empty. */
function BrandPanel() {
  return (
    <aside className="adire sticky top-10 hidden w-[400px] shrink-0 flex-col rounded-[2rem] p-9 text-white lg:flex" aria-label="About Contri">
      <Wordmark light />
      <h2 className="display mt-14 text-[3rem] font-bold leading-[0.96] tracking-[-0.045em]">Your ajo, without the alajo.</h2>
      <p className="mt-4 max-w-[30ch] text-[1.05rem] leading-snug text-white/70">Everyone puts in. One person collects each round. Nobody holds the money.</p>
      <ul className="mt-10 space-y-4 text-[0.98rem]">
        <li className="flex items-center gap-3">
          <Lightning className="h-5 w-5 shrink-0 text-marigold" weight="fill" aria-hidden /> The pot goes out the moment the last person pays
        </li>
        <li className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-marigold" weight="fill" aria-hidden /> Deposits cover late members
        </li>
        <li className="flex items-center gap-3">
          <Users className="h-5 w-5 shrink-0 text-marigold" weight="fill" aria-hidden /> Join from a WhatsApp link. No gas, no seed phrase
        </li>
      </ul>
      <p className="mt-14 border-t border-white/10 pt-5 text-sm text-white/55">Made for phones. Runs on {chain.name}.</p>
    </aside>
  );
}
