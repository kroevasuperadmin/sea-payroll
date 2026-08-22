# SEA Payroll

Built for **Superteam Malaysia's Solana Lab — DevLeague 2026** (track: *Payments for Southeast Asia*).

## What it is

A business owner adds a list of Southeast Asian gig workers (name, Solana wallet address,
amount owed) and clicks one button. That triggers **one Solana transaction** that pays
every worker in USDC **atomically** — either everyone gets paid, or nobody does. The
transaction is public and instantly verifiable on Solana Explorer.

## Who it's for

SMEs and platforms in Southeast Asia paying remote/gig workers (delivery riders,
freelancers, virtual assistants) across countries. Today this typically means slow,
fee-heavy bank wires or per-transfer PayPal/Wise fees, with no shared, verifiable
settlement record. This replaces that with instant, near-zero-fee, all-or-nothing
settlement plus a public receipt.

## How Solana is integral (not a database with extra steps)

- **Atomicity across multiple parties.** A single transaction carries one SPL/USDC
  transfer instruction per worker. If any one transfer would fail (bad address,
  insufficient funds), the *entire batch* reverts — nobody gets a partial payroll run.
  A traditional database/API can't give you this guarantee across independent bank
  accounts; Solana's transaction model does, natively.
- **Public, permissionless verification.** Every payment is a real on-chain USDC
  transfer, viewable by anyone (worker, auditor, tax authority) on Solana Explorer —
  no need to trust the employer's internal records.
- **Real USDC**, not a mock token — uses Circle's official Solana Devnet USDC mint
  (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), the same rails used in production,
  so this is a direct preview of a mainnet-ready flow.
- **On-chain memo per batch** records a human-readable audit note (worker count, total
  paid) permanently alongside the transfers, via the standard Solana Memo program.

## Tech

- Next.js (App Router) + TypeScript + Tailwind
- `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter-react` (Phantom)
- Solana Devnet, Circle Devnet USDC

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000, connect a Phantom wallet set to **Devnet**, fund it with:

- Devnet SOL (gas): https://faucet.solana.com
- Devnet USDC: https://faucet.circle.com

Add workers (three example rows are pre-filled with real devnet addresses), click
**Pay all workers now**, approve in Phantom. The app shows the confirmed transaction
and a link to view it on Solana Explorer.

## Live demo

https://sea-payroll.vercel.app _(devnet)_

## Notes

- Batches are capped at 8 workers per transaction to stay comfortably within Solana's
  transaction size limit.
- This is a devnet demo built in a single hackathon sprint — no custodial backend, no
  server ever touches funds. The employer's own wallet signs and pays directly.
