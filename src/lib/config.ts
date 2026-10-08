import { defineChain, getAddress, isAddress, type Address } from "viem";
import { foundry, monadTestnet } from "viem/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || monadTestnet.id);
const rpc = process.env.NEXT_PUBLIC_RPC_URL || (chainId === foundry.id ? "http://127.0.0.1:8545" : monadTestnet.rpcUrls.default.http[0]);

export const chain =
  chainId === foundry.id
    ? defineChain({ ...foundry, rpcUrls: { default: { http: [rpc] } } })
    : defineChain({ ...monadTestnet, rpcUrls: { default: { http: [rpc] } } });

const addr = (v: string | undefined): Address | undefined => (v && isAddress(v) ? getAddress(v) : undefined);

export const addresses = {
  contri: addr(process.env.NEXT_PUBLIC_CONTRI),
  token: addr(process.env.NEXT_PUBLIC_TOKEN),
  forwarder: addr(process.env.NEXT_PUBLIC_FORWARDER),
};

/** True when the app points at a deployment. Without it the app shows how to connect one. */
export const deployed = Boolean(addresses.contri && addresses.token && addresses.forwarder);

export const TOKEN_DECIMALS = 6;
export const TOKEN_LABEL = process.env.NEXT_PUBLIC_TOKEN_LABEL || "test AUSD";
export const IS_TESTNET = chain.testnet ?? chainId !== 143;
export const EXPLORER = chain.blockExplorers?.default.url;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";
