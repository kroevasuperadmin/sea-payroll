import { BackLink, CARD_CLASS, Eyebrow } from "@/components/ui";

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
      <Eyebrow className="mb-3">Changelog</Eyebrow>
      <h1 className="text-3xl font-extrabold text-[#123B63] mb-10">
        What&apos;s new
      </h1>
      <div className="flex flex-col gap-6">
        {ENTRIES.map((e) => (
          <div
            key={e.date}
            className={`p-5 ${CARD_CLASS}`}
          >
            <p className="text-xs font-mono text-[#5A6B70]">{e.date}</p>
            <h2 className="font-semibold text-[#123B63] mt-1">{e.title}</h2>
            <p className="text-sm text-[#5A6B70] mt-1">{e.body}</p>
          </div>
        ))}
      </div>
      <BackLink className="mt-8 inline-block">← Try the app</BackLink>
    </div>
  );
}
