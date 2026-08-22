import Link from "next/link";

export default function Pricing() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center gap-4">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70]">
        Pricing
      </p>
      <h1 className="text-3xl font-extrabold text-[#123B63]">
        Free on devnet, always.
      </h1>
      <p className="text-sm text-[#5A6B70] max-w-sm">
        Tiba is a devnet demo — no fees, no plans, no billing. A mainnet
        pricing model (a small basis-point fee per settled batch) would come
        with a production launch.
      </p>
      <Link href="/" className="text-sm text-[#123B63] underline mt-2">
        ← Try the app instead
      </Link>
    </div>
  );
}
