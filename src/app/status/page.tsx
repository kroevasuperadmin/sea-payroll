import Link from "next/link";

export default function Status() {
  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-6 py-24 text-center">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70] mb-3">
        Status
      </p>
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#0F766E]" />
        <h1 className="text-xl font-semibold text-[#123B63]">
          All systems operational
        </h1>
      </div>
      <div className="mt-10 flex flex-col gap-3 text-sm text-left rounded-lg border border-[#123B63]/12 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-[#16343A]">Solana Devnet RPC</span>
          <span className="text-[#0F766E] text-xs">Operational</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#16343A]">Payment engine</span>
          <span className="text-[#0F766E] text-xs">Operational</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#16343A]">AI agent endpoint</span>
          <span className="text-[#0F766E] text-xs">Operational</span>
        </div>
      </div>
      <Link href="/" className="text-sm text-[#123B63] underline mt-8 inline-block">
        ← Try the app
      </Link>
    </div>
  );
}
