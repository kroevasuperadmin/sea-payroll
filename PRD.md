# Tiba — Product Requirements Document

## 1. Problem statement

Singapore→Indonesia payroll works today, but the bank/fintech stack is fragmented, expensive at scale, and requires pre-funding multiple local accounts. A Singapore-based BPO, staffing platform, or overseas employer must manage banking hours, cutoffs, FX, local liquidity, multiple payout providers, and opaque exceptions before workers can receive a normal local payout.

The sharper wedge is therefore **operator settlement and liquidity friction**, not “workers cannot access banking.” Crypto is not the worker product: Tiba uses USDC/Solana as invisible settlement infrastructure underneath, while recipients still receive compliant IDR bank or e-wallet payouts.

This model is already proven in the region. Siam Commercial Bank and Lightnet use stablecoin-based cross-border settlement to improve provider liquidity while end users transact in local currency. [SCB + Lightnet](https://www.scb.co.th/th/about-us/news/oct-2567/scb-partners-stablecoin.html) BCRemit similarly uses USDC internally for remittance settlement while recipients receive through bank, e-wallet, or cash-pickup options. [Circle: BCRemit case study](https://www.circle.com/case-studies/bcremit)

Today, a smaller BPO, staffing platform, or overseas employer must coordinate payout data, recipient eligibility, KYC exceptions, payout preferences, disputes, provider liquidity, and multiple payout providers themselves. A single approved payroll file becomes a manual operating process with opaque failures and capital tied up in pre-funded local accounts.

Tiba will make that process executable: one approved payout file in; country-aware eligibility, KYC/dispute checks, settlement and payout routing out; each worker receives money through their chosen compliant local rail by default, with an optional self-custody USDC payout only where explicitly selected and permitted.

Migrant-worker financial-exclusion research remains relevant as a secondary expansion consideration: some migrant communities face documentation, access, and support barriers that complicate payout completion. But it is not the primary claim for Tiba, and USDC is not assumed to be the only viable rail for those workers. [World Bank: migrant workers and remittances in Malaysia](https://blogs.worldbank.org/en/eastasiapacific/three-things-to-know-about-migrant-workers-and-remittances-in-malaysia) [IOM: Financial Inclusion for Migrant Workers in Thailand](https://publications.iom.int/books/fostering-financial-empowerment-needs-assessment-financial-inclusion-migrant-workers-thailand)

## 2. Target customer & buyer

**Buyer and operator:** Smaller workforce platforms, BPOs, employer-of-record-adjacent operators, and overseas employers that regularly pay cross-border workers. They pay Tiba for payout orchestration, operational visibility, lower settlement/pre-funding friction, and fewer failed/manual payout runs.

**Initial customer profile:** A Singapore- or Malaysia-based BPO, staffing firm, or remote-work platform paying roughly 25–100 workers in one recurring corridor. It has a structured payroll/export file, recurring monthly or biweekly payouts, and an existing pain around recipient setup, payout exceptions, and worker support.

**Recipient:** The worker. They do not buy Tiba. Each worker provides the data required for their permitted payout options and selects a preferred rail:

- Local bank account
- Supported e-wallet
- Optional USDC balance at a worker-controlled wallet address

**Explicitly not the initial customer:** Grab, DoorDash, Lalamove, or other large domestic gig platforms. They already optimize domestic fiat cash-out and require enterprise-grade integrations and regulatory maturity that do not fit the first wedge.

## 3. Product scope — what Tiba IS and what it IS NOT

Tiba is a **non-custodial compliance, settlement-orchestration, and payout-orchestration layer** for Southeast Asian cross-border workforces.

It accepts an employer-approved payout file, maintains the payout’s operational record, applies a corridor-specific rule set, obtains eligibility/KYC/screening outcomes from licensed partners, and coordinates the approved settlement and local payout workflow. USDC/Solana, where permitted, is invisible backend settlement infrastructure intended to reduce operator-side cross-border liquidity and pre-funding friction. The default worker-facing outcome is a normal compliant local bank or e-wallet payout.

An optional self-custody USDC payout may be available for a worker who explicitly opts in and provides their own wallet address. It is a minor, separately assessed rail—not the core product pitch—and must not be routed through a licensed Indonesian payment-system provider or represented as a local Indonesian payment payout.

Tiba is not:

- A consumer wallet or place where workers store funds
- An exchange or on/off-ramp
- A custodian or holder of employer or worker money
- A money transmitter, VASP, or licensed remittance provider
- A replacement for a licensed partner’s customer due diligence, safeguarding, FX execution, or regulated payment obligations
- A way to route USDC into an Indonesian licensed payment rail
- An autonomous system that sends payroll without an employer-approved payout file

Funds, conversion, custody, regulated payout execution, and local bank/e-wallet disbursement stay with licensed partners. Tiba sends instructions and records partner responses; it must not take possession or control of customer funds.

## 4. Core user flow

1. The employer uploads an approved CSV payout file or creates a payout run in Tiba. Required fields include worker identity reference, destination country, amount/currency, and payout period.

2. Tiba validates the file before it can proceed: duplicates, missing data, invalid amount formats, unsupported destination country, and missing recipient preferences are flagged.

3. Each worker has a recipient profile containing their permitted rail preference, such as Indonesia local bank, supported e-wallet, or, where separately permitted and explicitly opted into, their own USDC address. The profile stores only the minimum information required to route a payout.

4. Tiba applies the selected corridor rule set:
   - Is the employer-to-recipient corridor supported?
   - Does the recipient have the required identity/KYC status from the licensed partner?
   - Is the selected rail available for that country and recipient?
   - Is the backend settlement path permitted and operationally available?
   - Is there an unresolved dispute, hold, duplicate payout, or failed prior payout?
   - Are required partner screening or payout-status checks passed?

5. Tiba separates the run into **ready**, **needs action**, and **blocked** recipients. It does not silently partially execute a file.

6. After the employer confirms the ready subset, Tiba creates the appropriate settlement and payout instructions. The licensed partner receives funds from the employer through the agreed regulated flow and executes the compliant local bank or e-wallet payout. Any USDC/Solana settlement leg remains separate from the Indonesian regulated payout rail.

7. Tiba receives partner status updates—accepted, processing, paid, failed, or returned—and presents a per-worker operational receipt.

8. If an optional self-custody USDC payout is selected, separately permitted, and not routed through a licensed Indonesian payment-system provider, the worker receives it at their self-custodied wallet address. Tiba does not provision or hold that wallet.

9. A failed or disputed recipient is held outside the completed run, with a reason and a next action: correct data, complete KYC, change rail, wait for partner review, or cancel/retry.

## 5. What’s already built vs. what’s net-new

| Existing repository capability | Carry-forward role in the pivot | Net-new requirement |
|---|---|---|
| Next.js 16 / React / TypeScript / Tailwind frontend | Reuse as the employer operations console. | Authenticated employer workspace, recipient management, payout-run workflow, permissions, and durable records. |
| Direct wallet-connected batch payroll UI in [`src/app/page.tsx`](C:/Users/diony/dev/sea-payroll/src/app/page.tsx) | Preserve the idea of a clear batch review and one approved payout action. | Replace manual name/Solana-address/USDC rows with file ingestion, recipient profiles, local rail choices, country rules, settlement status, and partner-backed execution. |
| `buildBatchPaymentTx` in [`src/lib/solana.ts`](C:/Users/diony/dev/sea-payroll/src/lib/solana.ts) creates atomic SPL-USDC transfers, memo instructions, and recipient token accounts | Retain as a future adapter for a permitted, clearly separated operator-side settlement leg, controlled test settlement, or optional self-custody USDC payout. | It is not a production cross-border payout engine: it uses Circle Devnet USDC, a public Devnet RPC, direct wallet ownership, and has an eight-recipient legacy-transaction limit. |
| Phantom, Solflare, and WalletConnect support in [`src/app/providers.tsx`](C:/Users/diony/dev/sea-payroll/src/app/providers.tsx) | Optional future worker-owned USDC-wallet connection/verification. | It cannot be the default worker payout experience; workers need bank/e-wallet choices without crypto onboarding. |
| Server-signed agent payment endpoint in [`src/app/api/agent-pay/route.ts`](C:/Users/diony/dev/sea-payroll/src/app/api/agent-pay/route.ts) | Reframe its rule-based execution concept for internal exception triage and settlement-adapter jobs. | Do not carry its custody model forward: it holds `AGENT_WALLET_SECRET_KEY`, pays from an agent-controlled float, uses hard-coded tasks, and tracks idempotency only in an in-memory map. That conflicts with the non-custodial product boundary. |
| Preset agent tasks in [`src/lib/agentTasks.ts`](C:/Users/diony/dev/sea-payroll/src/lib/agentTasks.ts) | Demonstrates a narrow authorization boundary. | Replace with persisted payout instructions, employer approval, partner status webhooks, auditable idempotency, disputes, and role-based controls. |
| Explorer receipts and session-only history | Keep the principle of verifiable payment receipts. | Add durable run-level audit logs and partner receipts; Solana Explorer is only relevant for a permitted backend settlement leg or optional self-custody USDC payouts. |

The current product is therefore a real **devnet settlement demonstration**, not yet an orchestration product. It has no database, authentication, CSV ingestion, customer accounts, KYC/compliance workflow, licensed-partner integration, bank/e-wallet routing, dispute handling, production mainnet configuration, or real-money compliance model.

## 6. MVP scope for the next 4–6 weeks

The goal is a credible single-corridor pilot product, not a regional payments platform.

1. **Choose one corridor and one licensed partner path.**  
   Build only after confirming that the partner can support the intended recipient rails in sandbox and has a realistic commercial/onboarding path.

2. **Employer payout console.**  
   Add a simple authenticated workspace where one design partner can upload a CSV, inspect validation errors, approve a payout run, and download/view an operational receipt.

3. **Recipient profile and rail preference.**  
   Support destination country, partner KYC state, bank/e-wallet details or a worker-controlled USDC address, preference, and consent timestamp. Start with one destination country and no self-service worker portal beyond a secure form if necessary.

4. **Rules and exception engine.**  
   Implement a deliberately small, explicit rules table: supported corridor, required fields, allowed rails, KYC status, settlement-path availability, dispute hold, duplicate detection, and idempotency key. Output only ready, blocked, or needs-action states with a human-readable reason.

5. **Partner adapter.**  
   Define a single provider interface and implement one sandbox adapter. It should submit eligible local-payout instructions, ingest status callbacks/polling, and map partner states into Tiba states. Do not build a generic marketplace of providers.

6. **Operational audit trail.**  
   Persist payout-file version, employer approval, recipient decision, settlement reference, partner instruction ID, payout state, failure reason, and timestamps. This is more important than a sophisticated dashboard.

7. **Optional USDC rail proof.**  
   Keep the existing Solana module behind an adapter and use it only for test/demo operator-side settlement or, where explicitly permitted, a worker-owned self-custody USDC payout. Keep it fully separate from the licensed Indonesian local payout rail. Remove all claims that Devnet capability equals production readiness.

8. **Pilot-ready demo.**  
   Demonstrate one named corridor end-to-end with synthetic data and a partner sandbox, plus a design-partner-specific workflow. A live-money pilot occurs only after partner and legal approval.

## 7. Non-goals / explicitly out of scope for now

- Integration with major gig platforms
- Multi-country coverage before proving one corridor
- A worker wallet, balance, card, exchange, or crypto trading function
- Holding USDC or fiat on Tiba’s balance sheet
- Building proprietary KYC, sanctions, FX, or remittance infrastructure
- Automated pay-on-task execution without employer approval
- Payroll tax, employment classification, EOR, HRIS, invoicing, or benefits administration
- Public API platform work before a design partner repeatedly uses the operator workflow
- Mainnet Solana launch merely to make the demo look more complete

## 8. Path to first design partner

Start with one specific hypothesis:

**A Singapore-based BPO or remote-support staffing firm paying 25–75 Indonesia-based contractors or workers on a recurring monthly cadence.**

This corridor is narrow enough to validate buyer pain and operational fit: an overseas employer, recurring payout files, a need to manage cross-border settlement/liquidity and local payout-provider operations, and workers receiving through compliant Indonesian bank or e-wallet rails by default.

The founder should spend the next two weeks securing ten interviews, not adding countries:

- Contact BPO founders, staffing operators, outsourced customer-support agencies, and remote-work operators through direct LinkedIn outreach, founder networks, YC alumni, and Indonesian/Singaporean BPO communities.
- Ask for one existing, redacted payout file and map the actual workflow: pre-funding, provider accounts, recipient onboarding, failures, KYC requests, payout timing, reconciliation, support burden, and worker payout preferences.
- Qualify a design partner only if it has a recurring named corridor, at least 25 recipients, a real operator who owns payouts, and permission to run a sandbox/controlled pilot.
- Ask for a lightweight written commitment: access to an anonymized file, a weekly workflow review, and intent to run a pilot if partner/legal requirements are met.
- In parallel, approach licensed payout/remittance providers that support the chosen corridor. Do not imply partnership until one is confirmed in writing.

The deliverable is not “interest.” It is a documented corridor: **buyer, origin country, destination country, recipient count, payout cadence, local payout rails, current settlement/pre-funding burden, failure points, and a signed design-partner commitment.**

## 9. Success metrics for the YC application

Success should be measured as proof of a repeatable payout wedge:

- One signed design-partner letter or pilot agreement with a named buyer and operator.
- One defined corridor with a documented payout file, recipient count, cadence, current workflow, and pre-funding/provider-account burden.
- At least 25 real or consented pilot recipient profiles with a recorded preferred local rail.
- At least three approved payout runs processed end-to-end in sandbox or, if approved by the licensed partner, a compliant controlled live pilot.
- A clear payout-volume target tied to that partner—for example, at least US$10,000 in modeled or partner-approved pilot volume—not a generic waitlist count.
- At least 90% of submitted recipients automatically classified into ready, needs-action, or blocked with a specific explanation.
- Measured reduction in manual operational steps, payout exceptions, or local-account pre-funding burden for the design partner.
- Evidence that workers prefer multiple compliant local rails; success is not measured by forcing USDC adoption.

## 10. Key risks

**Regulatory boundary risk.** Calling Tiba “non-custodial” does not by itself remove regulatory obligations. Product, contracts, data handling, marketing, and fund flow must be reviewed with qualified local counsel and the licensed partner. Tiba must not control funds, promise regulated services it does not provide, or misrepresent its role.

**Indonesia virtual-currency payment-rail risk.** Bank Indonesia explicitly prohibits licensed payment-system providers from receiving virtual currency as a payment funding source, processing payments using it, or linking it to payment processing. Any USDC leg touching the Indonesian licensed payment rail is therefore a dead end. Tiba’s operator-side settlement use of crypto must remain clearly separated from the regulated Indonesian bank/e-wallet payout rail, and any optional worker self-custody USDC rail must be separately assessed and not routed through an Indonesian licensed payment-system provider. [Bank Indonesia PBI 23/6/PBI/2021](https://www.bi.go.id/id/publikasi/peraturan/Pages/PBI_230621.aspx)

**Licensed-partner dependency.** The MVP depends on a partner’s corridor coverage, API quality, underwriting, pricing, and willingness to work with an early-stage company. Mitigation: choose one corridor based on a real partner path before building a broad integration layer, and keep the adapter modular.

**KYC and worker-access friction.** Documentation or account-access issues can prevent local payout completion even when compliant rails exist. Mitigation: make missing KYC/documentation an explicit, assisted exception flow; do not present it as an invisible technical check or claim that USDC automatically solves it.

**Employer and worker adoption chicken-and-egg.** Employers will not switch for a theoretical settlement rail, while workers cannot express preference without an employer payout program. Mitigation: start from an employer’s existing recurring payout file, prove reduced pre-funding and operational friction, then capture worker preference during that established payout process.

**Scope risk.** A solo non-technical founder can lose the YC window by trying to become a multi-country payments company. Mitigation: one corridor, one buyer type, one partner path, one operational workflow.

**Legacy-engine risk.** The present Solana implementation demonstrates valuable atomic transfer and execution concepts, but Devnet transactions, an eight-worker transaction cap, and a server-held agent key are not production payment infrastructure. Reuse the code as a bounded adapter/proof, not as evidence that regulated payout execution is solved.
