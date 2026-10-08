import "server-only";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  http,
  keccak256,
  concat,
  toHex,
  nonceManager,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { contriAbi, forwarderAbi, tokenAbi } from "../abi";
import { addresses, chain, IS_TESTNET } from "../config";
import { RELAYABLE, RELAY_GAS, type SignedRequest } from "../meta";

export const publicClient = createPublicClient({ chain, transport: http() });

function relayerKey(): Hex {
  const k = process.env.RELAYER_PRIVATE_KEY;
  if (!k || !/^0x[0-9a-fA-F]{64}$/.test(k)) throw new HttpError(503, "The relayer is not set up on this server (RELAYER_PRIVATE_KEY).");
  return k as Hex;
}

let _wallet: ReturnType<typeof makeWallet> | undefined;
function makeWallet() {
  const account = privateKeyToAccount(relayerKey(), { nonceManager });
  return createWalletClient({ account, chain, transport: http() });
}
export function wallet() {
  return (_wallet ??= makeWallet());
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------- simple per-key rate limit (per instance)

const hits = new Map<string, number[]>();
export function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, "Too many requests. Try again in a little while.");
  list.push(now);
  hits.set(key, list);
}

// ---------------------------------------------------------------- relay a signed request

export async function relay(req: SignedRequest) {
  if (!addresses.contri || !addresses.forwarder) throw new HttpError(503, "No deployment configured.");
  if (req.to.toLowerCase() !== addresses.contri.toLowerCase()) throw new HttpError(400, "Requests can only call Contri.");
  if (BigInt(req.value) !== 0n || BigInt(req.gas) > RELAY_GAS) throw new HttpError(400, "Bad request value or gas.");

  let fn: string;
  try {
    fn = decodeFunctionData({ abi: contriAbi, data: req.data }).functionName;
  } catch {
    throw new HttpError(400, "Unknown call.");
  }
  if (!(RELAYABLE as readonly string[]).includes(fn)) throw new HttpError(400, `The relayer doesn't pay for ${fn}.`);

  limit(`relay:${req.from.toLowerCase()}`, 60, 60 * 60 * 1000);

  const request = {
    from: req.from,
    to: req.to,
    value: 0n,
    gas: BigInt(req.gas),
    deadline: req.deadline,
    data: req.data,
    signature: req.signature,
  } as const;

  const ok = await publicClient.readContract({ address: addresses.forwarder, abi: forwarderAbi, functionName: "verify", args: [request] });
  if (!ok) throw new HttpError(400, "Signature check failed. Refresh and try again.");

  const w = wallet();
  // Simulate first so a call that would fail costs nothing and returns a readable reason.
  try {
    await publicClient.simulateContract({
      account: w.account,
      address: addresses.forwarder,
      abi: forwarderAbi,
      functionName: "execute",
      args: [request],
    });
  } catch (e) {
    throw new HttpError(422, explain(e));
  }
  const hash = await w.writeContract({ address: addresses.forwarder, abi: forwarderAbi, functionName: "execute", args: [request] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new HttpError(500, "The transaction failed on chain.");
  return { hash, fn, block: Number(receipt.blockNumber) };
}

const REASONS: Record<string, string> = {
  InvalidParams: "Those circle settings aren't allowed.",
  WrongStatus: "The circle isn't in a state that allows this.",
  NotMember: "You're not in this circle.",
  AlreadyMember: "You're already in this circle.",
  AlreadyPaid: "You've already paid this round.",
  NotCreator: "Only the person who started the circle can do this.",
  TooEarly: "The round hasn't closed yet.",
  NothingToWithdraw: "There's nothing left to withdraw.",
  ERC20InsufficientBalance: "Not enough money in the wallet.",
  ERC20InsufficientAllowance: "The payment approval didn't go through. Try again.",
};

export function explain(e: unknown): string {
  const s = String((e as { shortMessage?: string; message?: string })?.message ?? e);
  for (const [k, v] of Object.entries(REASONS)) if (s.includes(k)) return v;
  if (s.includes("FailedCall")) {
    // The forwarder wraps the inner revert; try to surface the inner reason.
    const inner = (e as { cause?: { data?: { errorName?: string } } })?.cause?.data?.errorName;
    if (inner && REASONS[inner]) return REASONS[inner];
    return "The circle refused this action. It may have changed; refresh and try again.";
  }
  return "Something went wrong sending this. Try again.";
}

// ---------------------------------------------------------------- faucet and demo members

export const FAUCET_AMOUNT = 500_000_000n; // $500 of test AUSD

export async function faucet(to: Address) {
  if (!IS_TESTNET) throw new HttpError(400, "The faucet is testnet only.");
  if (!addresses.token) throw new HttpError(503, "No deployment configured.");
  const w = wallet();
  const hash = await w.writeContract({ address: addresses.token, abi: tokenAbi, functionName: "faucet", args: [to, FAUCET_AMOUNT] });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Demo members are deterministic keys derived from the relayer key, so they persist across deploys. */
export function demoAccount(i: number) {
  const key = keccak256(concat([relayerKey(), toHex("contri-demo-member"), toHex(i, { size: 1 })]));
  return privateKeyToAccount(key);
}

export const DEMO_NAMES = ["Ada", "Chidi", "Kemi", "Musa", "Funke", "Emeka", "Zainab", "Tunde", "Ngozi", "Bayo", "Amaka"];

export { encodeFunctionData };
