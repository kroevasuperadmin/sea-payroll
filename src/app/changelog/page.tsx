import Link from "next/link";

const ENTRIES = [
  {
    date: "22 Aug 2026",
    title: "Tiba launches",
    body: "Batch payroll for SEA gig workers + autonomous agent pay-per-task, both on Solana devnet.",
  },
];

export default function Changelog() {
  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-6 py-24">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70] mb-3">
        Changelog
      </p>
      <h1 className="text-3xl font-extrabold text-[#123B63] mb-10">
        What&apos;s new
      </h1>
      <div className="flex flex-col gap-6">
        {ENTRIES.map((e) => (
          <div
            key={e.date}
            className="rounded-lg border border-[#123B63]/12 bg-white p-5"
          >
            <p className="text-xs font-mono text-[#5A6B70]">{e.date}</p>
            <h2 className="font-semibold text-[#123B63] mt-1">{e.title}</h2>
            <p className="text-sm text-[#5A6B70] mt-1">{e.body}</p>
          </div>
        ))}
      </div>
      <Link href="/" className="text-sm text-[#123B63] underline mt-8 inline-block">
        ← Try the app
      </Link>
    </div>
  );
}
