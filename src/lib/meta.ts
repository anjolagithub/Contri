/**
 * Gasless calls. The user signs two things and never holds gas:
 *  1. an EIP-2612 permit, so Contri can take the exact amount from their wallet;
 *  2. an ERC-2771 ForwardRequest, which says "call Contri with this data, as me".
 * The relayer submits the request through the forwarder and pays the gas.
 * Works the same in the browser (device key) and on the server (demo members).
 */
import type { Hex, LocalAccount, PublicClient, Address } from "viem";
import { contriAbi, forwarderAbi, tokenAbi } from "./abi";
import { addresses, chain } from "./config";

export type SignedRequest = {
  from: Address;
  to: Address;
  value: string;
  gas: string;
  deadline: number;
  data: Hex;
  signature: Hex;
};

export const RELAY_GAS = 900_000n;

export async function signRequest(client: PublicClient, account: LocalAccount, data: Hex): Promise<SignedRequest> {
  const forwarder = addresses.forwarder!;
  const nonce = await client.readContract({ address: forwarder, abi: forwarderAbi, functionName: "nonces", args: [account.address] });
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const message = {
    from: account.address,
    to: addresses.contri!,
    value: 0n,
    gas: RELAY_GAS,
    nonce,
    deadline,
    data,
  };
  const signature = await account.signTypedData({
    domain: { name: "Contri", version: "1", chainId: chain.id, verifyingContract: forwarder },
    types: {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    },
    primaryType: "ForwardRequest",
    message,
  });
  return { from: account.address, to: addresses.contri!, value: "0", gas: RELAY_GAS.toString(), deadline, data, signature };
}

export type Permit = { value: bigint; deadline: bigint; v: number; r: Hex; s: Hex };

export async function signPermit(client: PublicClient, account: LocalAccount, value: bigint): Promise<Permit> {
  const token = addresses.token!;
  const [nonce, domain] = await Promise.all([
    client.readContract({ address: token, abi: tokenAbi, functionName: "nonces", args: [account.address] }),
    client.readContract({ address: token, abi: tokenAbi, functionName: "eip712Domain" }),
  ]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const sig = await account.signTypedData({
    domain: { name: domain[1], version: domain[2], chainId: chain.id, verifyingContract: token },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: account.address, spender: addresses.contri!, value, nonce, deadline },
  });
  const r = sig.slice(0, 66) as Hex;
  const s = ("0x" + sig.slice(66, 130)) as Hex;
  const v = parseInt(sig.slice(130, 132), 16);
  return { value, deadline, v, r, s };
}

/** Function names the relayer will pay for. Anything else is refused. */
export const RELAYABLE = [
  "create",
  "createWithPermit",
  "join",
  "joinWithPermit",
  "leave",
  "cancel",
  "contribute",
  "contributeWithPermit",
  "settleRound",
  "withdrawDeposit",
  "setName",
] as const;

export { contriAbi };
