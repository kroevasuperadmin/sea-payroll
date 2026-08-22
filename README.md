# Tiba

*Tiba* — Malay/Indonesian for "arrived." Payments that arrive the moment work is done.

Built for **Superteam Malaysia's Solana Lab — DevLeague 2026** (tracks: *Payments for
Southeast Asia* + *AI and Agentic Commerce*).

## What it is

Two modes, one payment engine:

1. **Payroll mode** — a business owner adds a list of Southeast Asian gig workers (name,
   Solana wallet address, amount owed) and clicks one button. That triggers **one Solana
   transaction** that pays every worker in USDC **atomically** — either everyone gets
   paid, or nobody does.
2. **Agent mode** (`/agent`) — an autonomous AI agent pays a worker the instant it
   verifies a unit of work is complete, with **no human approving each payment**. The
   agent signs and sends the transaction itself, from its own Solana wallet — real
   machine-to-machine, pay-per-task settlement.

Every transaction is public and instantly verifiable on Solana Explorer.

## Who it's for

SMEs and platforms in Southeast Asia paying remote/gig workers (delivery riders,
freelancers, virtual assistants) across countries — and, in agent mode, any automated
system (a webhook, a verification model, a completion check) that needs to pay for
completed work without a human in the loop. Today the human-driven case typically means
slow, fee-heavy bank wires or per-transfer PayPal/Wise fees with no shared, verifiable
settlement record; the agentic case usually doesn't exist at all because there's no
trustless way for software to move real value on its own. Tiba replaces both with
instant, near-zero-fee, all-or-nothing settlement plus a public receipt.

## How Solana is integral (not a database with extra steps)

- **Atomicity across multiple parties.** A single transaction carries one SPL/USDC
  transfer instruction per worker. If any one transfer would fail (bad address,
  insufficient funds), the *entire batch* reverts — nobody gets a partial payroll run.
  A traditional database/API can't give you this guarantee across independent bank
  accounts; Solana's transaction model does, natively.
- **Autonomous machine-signed settlement.** In agent mode, code — not a human — holds
  the signing key and executes real value transfer the moment it decides to. That's only
  possible because Solana lets any keypair, human or machine-held, sign and settle
  directly; there's no bank API that lets software move real money unattended.
- **Public, permissionless verification.** Every payment is a real on-chain USDC
  transfer, viewable by anyone (worker, auditor, tax authority) on Solana Explorer —
  no need to trust the employer's or the agent's internal records.
- **Real USDC**, not a mock token — uses Circle's official Solana Devnet USDC mint
  (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), the same rails used in production,
  so this is a direct preview of a mainnet-ready flow.
- **On-chain memo per transaction** records a human-readable audit note (worker count,
  total paid, or the agent's stated reason for paying) permanently alongside the
  transfers, via the standard Solana Memo program.

## Tech

- Next.js (App Router) + TypeScript + Tailwind
- `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter-react` (Phantom)
- Solana Devnet, Circle Devnet USDC

## Running it

```bash
npm install
npm run dev
```

**Payroll mode:** open http://localhost:3000, connect a Phantom wallet set to
**Devnet**, fund it with:

- Devnet SOL (gas): https://faucet.solana.com
- Devnet USDC: https://faucet.circle.com

Add workers (three example rows are pre-filled with real devnet addresses), click
**Pay all workers now**, approve in Phantom. The app shows the confirmed transaction
and a link to view it on Solana Explorer.

**Agent mode:** open http://localhost:3000/agent and click **Run agent cycle**. No
wallet connection needed — the agent uses its own server-held keypair
(`AGENT_WALLET_SECRET_KEY` env var) to sign and pay for each verified task automatically.

## Live demo

https://sea-payroll.vercel.app _(devnet)_

## Notes

- Batches are capped at 8 workers per transaction to stay comfortably within Solana's
  transaction size limit.
- This is a devnet demo built in a single hackathon sprint. In payroll mode there's no
  custodial backend — the employer's own wallet signs and pays directly. In agent mode
  the agent's keypair is a normal Solana keypair; on mainnet it would hold only the
  operating float needed for its task queue, same as any automated payment system.
