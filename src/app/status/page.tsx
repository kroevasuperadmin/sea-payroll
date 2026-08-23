import { BackLink, CARD_CLASS, Eyebrow } from "@/components/ui";

const SERVICES = [
  "Solana Devnet RPC",
  "Payment engine",
  "Agent endpoint",
];

export default function Status() {
  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-6 py-24 text-center">
      <Eyebrow className="mb-3">Status</Eyebrow>
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#0F766E]" />
        <h1 className="text-xl font-semibold text-[#123B63]">
          All systems operational
        </h1>
      </div>
      <div className={`mt-10 flex flex-col gap-3 text-sm text-left p-5 ${CARD_CLASS}`}>
        {SERVICES.map((service) => (
          <div key={service} className="flex items-center justify-between">
            <span className="text-[#16343A]">{service}</span>
            <span className="text-[#0F766E] text-xs">Operational</span>
          </div>
        ))}
      </div>
      <BackLink className="mt-8 inline-block">← Try the app</BackLink>
    </div>
  );
}
