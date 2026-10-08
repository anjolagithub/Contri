# Metropolis submission draft

**Project:** Contri
**Track:** 2, Consumer Products & Payments
**One line:** Your ajo, without the alajo: a rotating savings circle where the pot pays out the moment the last friend pays, and nobody holds the money.

## Problem
Rotating savings circles (ajo and esusu in Nigeria, susu in Ghana, chama in Kenya, tontines in francophone Africa, and the same thing across the diaspora) are how millions of people save together. They run on trust in a collector who holds everyone's money between payouts. When the collector is late, disorganised or dishonest, members lose out, and the only record is a paper card and a WhatsApp group.

## What we built
- A Monad contract that *is* the collector: fixed order, deadlines, deposits that cover late members, automatic removal of members who stop paying, and an instant payout when the last person pays.
- A phone-first web app where people join from a WhatsApp link with just a name. No wallet app, seed phrase, gas or approvals: members sign, and a relayer pays gas through an ERC-2771 forwarder with EIP-2612 permits.
- The contribution card, rebuilt: every payment stamped where the whole circle can see it, plus a ring of members around the pot that fills as people pay.
- Local currency next to every dollar amount (naira, cedi, shilling, rand, pound, euro, Canadian dollar) for members at home and abroad.

## Why it fits Track 2
The track asks for onchain rails that make financial products "instant, programmable, and invisible to the end user", and names "shared wallets and group spending that settle up without an intermediary". Contri is that for the most common group-money habit in Africa: the payout is instant and in the same transaction as the last payment, the rules are code, and the chain is invisible.

## Technical depth
- `Contri.sol`: one contract for all circles; `ReentrancyGuard`, `SafeERC20`, ERC-2771 context, permit variants for every paying action.
- 21 Foundry tests, including a fuzz test proving money is conserved and the contract ends empty for any circle size, deposit and payment pattern.
- Relayer that only pays for allowlisted Contri calls, checks signatures with the forwarder and simulates before sending.

## Links
- Code: https://github.com/anjolagithub/Contri
- Live app: (Vercel URL)
- Demo video: (link)
- Contracts on Monad testnet: (forwarder, Contri, test AUSD addresses)

## Demo video plan (under 3 minutes)
1. **0:00** The problem in one line, over a photo of a paper ajo card.
2. **0:15** Start a circle on a phone: $50 a week, 5 people, one-round deposit. Share to WhatsApp.
3. **0:45** Friends (and a member abroad, showing pounds) join from the link: name, Join. No wallet popups.
4. **1:15** Everyone pays. The ring fills, the stamps land, and the pot hits the first member's wallet the instant the last person pays. Show the transaction on the explorer.
5. **1:50** Someone is late: the deadline passes, anyone taps Settle, their deposit covers it, and the pot still goes out. The card shows the deposit stamp.
6. **2:20** The contract tests running green, including the money-conservation fuzz test.
7. **2:40** Close: "Your ajo, without the alajo."

## Bounties worth entering (check each sponsor's rules)
- Agora, best cross-border payments app: circles in a dollar stablecoin with members in different countries. Needs the real AUSD on Monad testnet if Agora provides an address.
- Best community team project: run the demo with a real circle.
