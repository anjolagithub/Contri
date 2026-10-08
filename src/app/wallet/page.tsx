"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, Copy, Eye, Key, Drop } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { useApp } from "@/components/AppProvider";
import { Avatar, Button, Sheet, inputCls } from "@/components/ui";
import { Money } from "@/components/Money";
import { faucet } from "@/lib/client";
import { chain, EXPLORER, IS_TESTNET, TOKEN_LABEL } from "@/lib/config";
import { CURRENCIES, local, short, usd, type Currency } from "@/lib/format";
import { exportKey, importKey } from "@/lib/wallet";

export default function WalletPage() {
  const { account, name, balance, currency, setCurrency, rates, refreshBalance, toast, ready } = useApp();
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [importing, setImporting] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  return (
    <Shell
      back={
        <Link href="/" className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 font-semibold text-indigo hover:bg-indigo-tint">
          <ArrowLeft className="h-5 w-5" weight="bold" aria-hidden /> Circles
        </Link>
      }
    >
      <div className="space-y-4 pt-1">
        <h1 className="display text-[1.85rem] font-bold leading-tight tracking-[-0.03em]">Wallet</h1>

        {!account ? (
          <section className="surface p-5">
            <p className="text-ink-2">You don&apos;t have a wallet on this phone yet. One is made for you the first time you start or join a circle.</p>
            <Button className="mt-4 w-full" onClick={() => ready().catch(() => {})}>
              Make one now
            </Button>
          </section>
        ) : (
          <>
            <section className="adire rounded-[1.75rem] p-5 text-white">
              <div className="flex items-center gap-3">
                <Avatar name={name || "?"} address={account.address} size={40} ring="#e2ae4a" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{name || "No name yet"}</p>
                  <button
                    onClick={() => navigator.clipboard?.writeText(account.address).then(() => toast("Address copied."))}
                    className="num inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
                  >
                    {short(account.address)} <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <p className="mt-6 text-[0.8rem] font-medium uppercase tracking-[0.08em] text-white/55">Balance</p>
              {balance === null ? <p className="text-[2.6rem] leading-none">…</p> : <Money units={balance} className="block text-[2.9rem] leading-none" />}
              {balance !== null && local(balance, rates[currency], currency) && <p className="num mt-1 text-sm text-white/65">about {local(balance, rates[currency], currency)}</p>}
              <p className="mt-3 text-[0.8rem] text-white/60">
                Held in {TOKEN_LABEL} on {chain.name}. You never need gas: Contri pays it.
              </p>
            </section>

            {IS_TESTNET && (
              <Button
                variant="marigold"
                className="w-full"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await faucet(account.address);
                    await refreshBalance();
                    toast("$500 of test money added.");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Faucet failed.", "late");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Drop className="h-5 w-5" weight="bold" aria-hidden /> Add $500 test money
              </Button>
            )}

            <section className="surface p-4">
              <label htmlFor="cur" className="font-semibold">
                Show amounts in
              </label>
              <p className="text-sm text-ink-2">Circles run in dollars. We show your local amount next to them at today&apos;s rate.</p>
              <select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={`${inputCls} mt-3`}>
                {Object.entries(CURRENCIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label} ({k}){rates[k] ? `: $1 = ${v.symbol}${rates[k].toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
                  </option>
                ))}
              </select>
            </section>

            <section className="surface p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Key className="h-5 w-5 text-indigo" weight="bold" aria-hidden /> Back up this wallet
              </p>
              <p className="mt-1 text-sm text-ink-2">Your wallet lives on this phone. Save the key somewhere private so you can open it on another phone. Anyone with the key can spend from it.</p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowKey(true)}>
                  <Eye className="h-5 w-5" weight="bold" aria-hidden /> Show key
                </Button>
                <Button variant="quiet" className="flex-1" onClick={() => setImporting(true)}>
                  Restore
                </Button>
              </div>
              {EXPLORER && (
                <a href={`${EXPLORER}/address/${account.address}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:underline">
                  See this wallet on the explorer <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </section>
          </>
        )}
      </div>

      <Sheet open={showKey} onClose={() => setShowKey(false)} title="Your wallet key">
        <p className="text-ink-2">Keep this private. Anyone who has it controls this wallet.</p>
        <p className="num mt-3 break-all rounded-xl bg-mist p-3 font-mono text-sm">{showKey ? exportKey() : ""}</p>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => {
            const k = exportKey();
            if (k) navigator.clipboard?.writeText(k).then(() => toast("Key copied. Store it somewhere safe."));
          }}
        >
          <Copy className="h-5 w-5" weight="bold" aria-hidden /> Copy key
        </Button>
      </Sheet>

      <Sheet open={importing} onClose={() => setImporting(false)} title="Use another key">
        <p className="text-ink-2">This replaces the wallet on this phone. Back up the current key first.</p>
        <input className={`${inputCls} mt-3 font-mono text-sm`} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="0x…" aria-label="Wallet key" autoComplete="off" spellCheck={false} />
        <Button
          className="mt-3 w-full"
          disabled={!keyDraft}
          onClick={() => {
            if (importKey(keyDraft)) window.location.href = "/";
            else toast("That doesn't look like a wallet key.", "late");
          }}
        >
          Switch wallet
        </Button>
      </Sheet>
    </Shell>
  );
}
