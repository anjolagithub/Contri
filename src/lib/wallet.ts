"use client";
/**
 * The device wallet: a key created on this phone and kept in its storage. No seed phrase,
 * no extension, no gas. It signs; the relayer pays. People can export it from the Wallet
 * screen to back it up or move it to another phone.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex, LocalAccount } from "viem";

const KEY = "contri.key.v1";

function read(): Hex | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? (v as Hex) : null;
  } catch {
    return null;
  }
}

export function existingAccount(): LocalAccount | null {
  const k = read();
  return k ? privateKeyToAccount(k) : null;
}

export function ensureAccount(): LocalAccount {
  const k = read() ?? generatePrivateKey();
  try {
    localStorage.setItem(KEY, k);
  } catch {}
  return privateKeyToAccount(k);
}

export function exportKey(): Hex | null {
  return read();
}

export function importKey(k: string): boolean {
  if (!/^0x[0-9a-fA-F]{64}$/.test(k.trim())) return false;
  try {
    localStorage.setItem(KEY, k.trim());
    return true;
  } catch {
    return false;
  }
}
