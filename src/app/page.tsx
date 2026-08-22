import Link from "next/link";

const RECENT_ACTIVITY = [
  {
    label: "Batch payroll · 3 workers",
    amount: "84.50 USDC",
    status: "Success",
    sig: "zYhQ33EviLihVSYNz95VKtsRqSaWqh5EZDUnwEZk5DQmvaqZFzF4rkEHQ2KDC3nLJUTCJZTUaHTRzBieSq9YUYZ",
  },
  {
    label: "AI agent · Delivery #482 verified",
    amount: "3.50 USDC",
    status: "Success",
    sig: "5Bf6aTsCLpHq2dZdDQd8eGP16gxW67H6MWxyCUABSyP8tA1tWK9evxhGY2AUSca2dXhkjF45XSA3YE4jdMA4R4qf",
  },
  {
    label: "AI agent · Design API call #1187",
    amount: "1.20 USDC",
    status: "Success",
    sig: "57v1vaHo9mi17GTgLMpgeWgXP1MkajPRdsQ89hYkVSyQhJqjgBeAjiDPSYFazMXuhhEuFM9qN6Lngu7QJY5MRGdB",
  },
];

const FEATURES = [
  {
    title: "Pay instantly across Southeast Asia",
    body: "One atomic Solana transaction settles every worker at once — Manila, Jakarta, Ho Chi Minh City, all in one click.",
  },
  {
    title: "Let AI agents pay autonomously",
    body: "No human approval step. An agent verifies a task is done and fires a real, signed on-chain payment itself — true machine-to-machine settlement.",
  },
  {
    title: "Every payment, publicly verifiable",
    body: "No trust-me ledger. Every transfer is a real USDC-Dev transaction, viewable by anyone on Solana Explorer.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connect a wallet",
    body: "Any Solana wallet — Phantom, Solflare, Backpack — via the Wallet Standard. No account, no signup.",
  },
  {
    n: "02",
    title: "Add your workers, or let your agent",
    body: "List who's owed what, or wire an AI agent to add payments the moment it verifies work is complete.",
  },
  {
    n: "03",
    title: "One click. Everyone's paid.",
    body: "A single atomic transaction settles the whole batch — instantly, and permanently verifiable on-chain.",
  },
];

export default function Landing() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="text-center text-xs py-2 bg-[#123B63] text-white">
        Built for Superteam Malaysia's Solana Lab · DevLeague 2026
      </div>

      <nav className="flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto w-full">
        <span className="text-xl font-extrabold tracking-tight text-[#123B63]">
          Tiba
        </span>
        <div className="hidden sm:flex items-center gap-8 text-sm text-[#5A6B70]">
          <Link href="/app" className="hover:text-[#123B63] transition-colors">
            Product
          </Link>
          <Link href="/app/agent" className="hover:text-[#123B63] transition-colors">
            AI Agent
          </Link>
          <Link href="/docs" className="hover:text-[#123B63] transition-colors">
            Docs
          </Link>
          <Link href="/pricing" className="hover:text-[#123B63] transition-colors">
            Pricing
          </Link>
        </div>
        <Link
          href="/app"
          className="rounded-full bg-[#123B63] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#0d2c4b] transition-colors"
        >
          Open App
        </Link>
      </nav>

      <section className="text-center px-6 pt-14 pb-16 max-w-3xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-[#123B63]">
          Payments that arrive
          <br />
          when work is <span className="text-[#E3A63B]">done</span>.
        </h1>
        <p className="text-base text-[#5A6B70] mt-6 max-w-xl mx-auto">
          Tiba pays Southeast Asian gig workers in USDC — one atomic Solana
          transaction, instantly verifiable. Or let an AI agent pay them
          autonomously the moment it verifies the work.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/app"
            className="rounded-full bg-[#123B63] text-white text-sm font-semibold px-6 py-3 hover:bg-[#0d2c4b] transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/app/agent"
            className="rounded-full border border-[#123B63]/20 text-[#123B63] text-sm font-semibold px-6 py-3 hover:border-[#123B63] transition-colors"
          >
            See the AI agent demo
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 border-t border-[#123B63]/10 max-w-6xl mx-auto w-full">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className={`px-8 py-10 ${
              i > 0 ? "sm:border-l border-[#123B63]/10" : ""
            } ${i > 0 ? "border-t sm:border-t-0 border-[#123B63]/10" : ""}`}
          >
            <h3 className="font-semibold text-[#123B63] mb-2">{f.title}</h3>
            <p className="text-sm text-[#5A6B70]">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-2xl mx-auto w-full px-6 py-16">
        <div className="rounded-2xl border border-[#123B63]/12 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-[#123B63]/10 flex items-center justify-between">
            <span className="text-[11px] tracking-[0.15em] uppercase text-[#5A6B70]">
              Recent activity
            </span>
            <span className="text-[11px] text-[#5A6B70]">Solana Devnet</span>
          </div>
          {RECENT_ACTIVITY.map((r) => (
            <a
              key={r.sig}
              href={`https://explorer.solana.com/tx/${r.sig}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-5 py-3.5 text-sm border-b last:border-b-0 border-[#123B63]/8 hover:bg-[#123B63]/[0.03] transition-colors"
            >
              <span className="text-[#16343A]">{r.label}</span>
              <span className="flex items-center gap-4">
                <span className="font-mono text-[#5A6B70]">{r.amount}</span>
                <span className="text-xs text-[#0F766E]">{r.status}</span>
              </span>
            </a>
          ))}
        </div>
        <p className="text-center text-xs text-[#5A6B70] mt-3">
          Real transactions, sent live during development — click any row to
          verify on Solana Explorer.
        </p>
      </section>

      <section className="border-t border-[#123B63]/10 max-w-6xl mx-auto w-full px-6 py-16">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70] text-center mb-10">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span className="text-xs font-mono text-[#E3A63B]">{s.n}</span>
              <h3 className="font-semibold text-[#123B63] mt-1 mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-[#5A6B70]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#123B63]/10 text-center px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#123B63]">
          Ready to pay your team?
        </h2>
        <Link
          href="/app"
          className="inline-block mt-6 rounded-full bg-[#E3A63B] text-[#16343A] text-sm font-semibold px-6 py-3 hover:brightness-95 transition"
        >
          Get Started — it's free on devnet
        </Link>
      </section>

      <footer className="border-t border-[#123B63]/10 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div>
            <p className="text-[#123B63] font-semibold mb-3">Product</p>
            <div className="flex flex-col gap-2 text-[#5A6B70]">
              <Link href="/app" className="hover:text-[#123B63]">
                Payroll
              </Link>
              <Link href="/app/agent" className="hover:text-[#123B63]">
                AI Agent
              </Link>
              <Link href="/pricing" className="hover:text-[#123B63]">
                Pricing
              </Link>
            </div>
          </div>
          <div>
            <p className="text-[#123B63] font-semibold mb-3">Resources</p>
            <div className="flex flex-col gap-2 text-[#5A6B70]">
              <Link href="/docs" className="hover:text-[#123B63]">
                Docs
              </Link>
              <Link href="/changelog" className="hover:text-[#123B63]">
                Changelog
              </Link>
              <Link href="/status" className="hover:text-[#123B63]">
                Status
              </Link>
              <a
                href="https://github.com/kroevasuperadmin/sea-payroll"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#123B63]"
              >
                GitHub
              </a>
            </div>
          </div>
          <div>
            <p className="text-[#123B63] font-semibold mb-3">Company</p>
            <div className="flex flex-col gap-2 text-[#5A6B70]">
              <Link href="/blog" className="hover:text-[#123B63]">
                Blog
              </Link>
              <a
                href="https://superteam.fun/earn/listing/solana-lab-for-devleague-2026/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#123B63]"
              >
                Superteam Malaysia
              </a>
            </div>
          </div>
          <div>
            <p className="text-[#123B63] font-semibold mb-3">Network</p>
            <div className="flex flex-col gap-2 text-[#5A6B70]">
              <span>Solana Devnet</span>
              <span>Circle USDC-Dev</span>
            </div>
          </div>
        </div>
        <div className="border-t border-[#123B63]/10 px-6 py-6 max-w-6xl mx-auto text-xs text-[#5A6B70]/70">
          Tiba is a devnet hackathon demo built for Superteam Malaysia&apos;s
          Solana Lab — DevLeague 2026. No real funds are used or at risk;
          devnet USDC has no monetary value.
        </div>
      </footer>
    </div>
  );
}
