"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { LocalAccount } from "viem";
import { deployed, IS_TESTNET } from "@/lib/config";
import { actions, balanceOf, ensureFunds, nameOf } from "@/lib/client";
import { ensureAccount, existingAccount } from "@/lib/wallet";
import type { Currency } from "@/lib/format";
import { Button, Sheet, Toast, inputCls } from "./ui";

type Ctx = {
  account: LocalAccount | null;
  name: string;
  balance: bigint | null;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Record<string, number>;
  refreshBalance: () => Promise<void>;
  /** Make sure this phone has a wallet, a name the circle can see, and (on testnet) enough money. */
  ready: (need?: bigint) => Promise<LocalAccount>;
  toast: (message: string, tone?: "ink" | "late") => void;
  status: string | null;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

const CUR_KEY = "contri.currency";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [currency, setCur] = useState<Currency>("NGN");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [toastMsg, setToast] = useState<{ m: string; t: "ink" | "late"; k: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [askName, setAskName] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const nameWaiter = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  useEffect(() => {
    const a = existingAccount();
    setAccount(a);
    try {
      const c = localStorage.getItem(CUR_KEY) as Currency | null;
      if (c) setCur(c);
    } catch {}
    fetch("/api/rates")
      .then((r) => r.json())
      .then((j) => setRates(j.rates ?? {}))
      .catch(() => {});
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!account || !deployed) return;
    try {
      setBalance(await balanceOf(account.address));
    } catch {}
  }, [account]);

  useEffect(() => {
    if (!account || !deployed) return;
    nameOf(account.address)
      .then(setName)
      .catch(() => {});
    refreshBalance();
    const t = setInterval(refreshBalance, 8000);
    return () => clearInterval(t);
  }, [account, refreshBalance]);

  const toast = useCallback((m: string, t: "ink" | "late" = "ink") => setToast({ m, t, k: Date.now() }), []);

  const setCurrency = useCallback((c: Currency) => {
    setCur(c);
    try {
      localStorage.setItem(CUR_KEY, c);
    } catch {}
  }, []);

  const ready = useCallback(
    async (need = 0n) => {
      const a = account ?? ensureAccount();
      if (!account) setAccount(a);
      let current = name;
      if (!current) {
        try {
          current = await nameOf(a.address);
        } catch {}
      }
      if (!current) {
        await new Promise<void>((resolve, reject) => {
          nameWaiter.current = { resolve, reject };
          setAskName(true);
        });
      }
      if (need > 0n && IS_TESTNET) {
        const bal = await balanceOf(a.address);
        if (bal < need) {
          setStatus("Adding test dollars to your wallet…");
          try {
            await ensureFunds(a, need);
          } finally {
            setStatus(null);
          }
        }
      }
      refreshBalance();
      return a;
    },
    [account, name, refreshBalance],
  );

  async function saveName() {
    const n = draft.trim();
    if (!n) return;
    setSavingName(true);
    try {
      const a = account ?? ensureAccount();
      if (!account) setAccount(a);
      await actions.setName(a, n);
      setName(n);
      setAskName(false);
      nameWaiter.current?.resolve();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save your name.", "late");
    } finally {
      setSavingName(false);
    }
  }

  function cancelName() {
    setAskName(false);
    nameWaiter.current?.reject(new Error("cancelled"));
  }

  return (
    <AppCtx.Provider value={{ account, name, balance, currency, setCurrency, rates, refreshBalance, ready, toast, status }}>
      {children}
      <Sheet open={askName} onClose={cancelName} title="What should your circle call you?">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
          className="space-y-4"
        >
          <p className="text-ink-2">Members see this name next to your payments. No email or phone number needed.</p>
          <input
            autoFocus
            className={inputCls}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 32))}
            placeholder="e.g. Tolu"
            aria-label="Your name"
            autoComplete="given-name"
          />
          <Button type="submit" className="w-full" busy={savingName} disabled={!draft.trim()}>
            Continue
          </Button>
        </form>
      </Sheet>
      {status && (
        <div className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[55] flex justify-center px-4" role="status" aria-live="polite">
          <div className="fade-in rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">{status}</div>
        </div>
      )}
      {toastMsg && <Toast key={toastMsg.k} message={toastMsg.m} tone={toastMsg.t} onDone={() => setToast(null)} />}
    </AppCtx.Provider>
  );
}

/** Swallow the "cancelled" rejection from closing the name sheet; surface everything else. */
export function isCancel(e: unknown) {
  return e instanceof Error && e.message === "cancelled";
}
