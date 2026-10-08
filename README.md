# Contri

**Your ajo, without the alajo.**

Contri is a rotating savings circle (ajo, esusu, susu, chama, tontine) that runs itself. Everyone puts in the same amount every round, and one person collects the whole pot each round, in the order they joined. The money is held by a contract on Monad for seconds, not by a collector for weeks.

Built for [Monad Metropolis](https://monad.xyz), Track 2: Consumer Products & Payments.

---

## The problem

In a traditional ajo, a collector (the *alajo*) holds everyone's money between payouts. That works when the collector is honest and organised. When they aren't, people lose savings, payouts arrive late, and there's no record anyone trusts beyond a paper card and a WhatsApp group.

People don't want a new financial product. They want the ajo they already use, without the person in the middle.

## What Contri does

| In a normal ajo | In Contri |
| --- | --- |
| The collector holds the money | The contract holds each payment only until the round completes |
| Payout depends on the collector | The pot goes out the moment the last person pays |
| One late member holds everyone up | Each member's deposit covers a late payment, so the pot still goes out |
| A member who stops paying is a fight | They're removed automatically once their deposit runs out, and lose their turn |
| Records are a paper card | Every payment is stamped on a shared contribution card anyone in the circle can check |

What people actually do: open a link from WhatsApp, type their name, tap **Join**, then tap **Pay** once a round. No wallet app, no seed phrase, no gas, no token approvals. A key is made on their phone, they sign, and Contri's relayer pays the gas.

## Why Monad

The Track 2 brief asks for financial products that feel "instant, programmable, and invisible to the end user". Contri needs all three:

- **Instant.** The payout is triggered by the last payment in the same transaction. With Monad's fast blocks, the recipient sees the pot land seconds after the last friend taps Pay.
- **Programmable.** The rules a collector used to enforce (order, deadlines, deposits, removing defaulters) are contract logic, tested and fuzzed.
- **Invisible.** Users sign two messages per action (a payment permit and a request); a relayer submits them. Low fees make sponsoring every member's gas affordable.

## How it works

```
Phone (device key)                   Next.js app                       Monad
───────────────────                  ───────────                       ─────
sign EIP-2612 permit  ─┐
sign ERC-2771 request ─┴─► POST /api/relay ─► checks: target, function
                                              allowlist, signature,
                                              simulation, rate limit
                                           ─► Forwarder.execute(request) ─► Contri.contributeWithPermit
                                                                             ├─ permit pulls $X
                                                                             └─ if everyone has paid:
                                                                                  pot → this round's member
```

### Contract (`contracts/src/Contri.sol`)

- `create` / `createWithPermit`: name, token, contribution, deposit, period, size (2 to 30). The creator joins as #1.
- `join` / `joinWithPermit`: locks the deposit. Payout order is join order. The circle starts when full.
- `contribute` / `contributeWithPermit`: pays this round. When paid count equals active members, the pot pays out and the next round opens, keeping the original schedule.
- `settleRound`: after the deadline, **anyone** can close the round. Each unpaid member's deposit covers their share (a strike). A member whose deposit can't cover it is removed, forfeits what's left of the deposit to the pot, and their collecting round is skipped. If the removed member was this round's recipient, the payers are refunded.
- `withdrawDeposit`: after the circle ends (or is called off), members take back what's left of their deposit. Leftover forfeits are shared to remaining members, so nothing is ever stuck.
- `leave` / `cancel`: before the circle starts.
- `setName`, `getCircle`, `history`, `circlesOf`: names and the read model the app renders, including the contribution card.
- Gasless via OpenZeppelin `ERC2771Forwarder` and `ERC20Permit`; `ReentrancyGuard`; `SafeERC20`.

**Tests:** 21 Foundry tests, including the gasless path (relayed join and pay with no gas and no approve), a front-run permit that must not block a payment, a forged sender, every default path, and a fuzz test that, for any circle size, deposit and pattern of who pays, the circle always finishes, no money is created or lost, and the contract ends empty.

```bash
cd contracts && forge test
```

### App (`src/`)

- Next.js 15 + React 19 + Tailwind v4 + viem. Mobile-first, works on any phone browser.
- `src/lib/meta.ts`: signs the permit and forward request (same code for people and demo members).
- `src/app/api/relay`: refuses anything that isn't a call to Contri on the allowlist, verifies the signature with the forwarder, simulates, then sends.
- `src/app/api/faucet`, `src/app/api/demo`: testnet only. Test dollars, and demo members who sign their own joins and payments, so one person can see a whole circle run.
- `src/app/api/rates`: live USD to NGN, GHS, KES, ZAR, GBP, EUR, CAD, shown next to every dollar amount. Missing rates are hidden, never guessed.

## Design

The contribution card is the real object the product replaces: the paper card an alajo stamps each time you pay. Contri keeps it as the centre of the circle screen, a row per member and a column per round, with an ink stamp when you pay and a gold box where each person collects. Around the pot sits a ring of members that fills in gold as people pay. The palette is adire indigo with gold; type is Geist for the interface and Bricolage Grotesque for headlines.

## Honest limits

- **A member who collects early and then stops paying** is the oldest ajo risk. The deposit covers missed payments up to its size; it can't cover a member who walks away after collecting with nothing locked. Circles choose their deposit (none, one round or two). Full protection would need collateral close to the pot, which defeats the point for most groups. In the real world this risk is managed by who you let in; Contri makes it visible (strikes on the card) and bounded.
- **The device key lives in the phone's browser storage.** People can back it up or restore it from the Wallet screen. A passkey-backed wallet is the next step.
- **The relayer can refuse to relay** (it can't move anyone's money: every action needs the member's signature). Anyone can still call the contract directly with their own gas.
- **Test AUSD** is a stand-in with permit for the testnet. On mainnet the same contract takes AUSD or USDC.

## Run it

```bash
npm install
# terminal 1: local chain + deploy
anvil
cd contracts && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# copy the three printed addresses into .env.local (see .env.example), with
# NEXT_PUBLIC_CHAIN_ID=31337 and an anvil key as RELAYER_PRIVATE_KEY
npm run dev
```

### Monad testnet

1. Make a **new throwaway wallet** for deploying and relaying. Fund it with testnet MON from the faucet. Never use a wallet that holds real money.
2. `cd contracts && MONAD_TESTNET_RPC=https://testnet-rpc.monad.xyz forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $KEY`
3. On Vercel: import the repo, set the variables from `.env.example` (chain 10143, the three addresses, `RELAYER_PRIVATE_KEY`), deploy.

## Licence

MIT
