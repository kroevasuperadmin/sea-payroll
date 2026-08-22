import Link from "next/link";

export default function Blog() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center gap-4">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70]">
        Blog
      </p>
      <h1 className="text-3xl font-extrabold text-[#123B63]">
        Nothing published yet.
      </h1>
      <p className="text-sm text-[#5A6B70] max-w-sm">
        Tiba shipped in a single hackathon sprint for Superteam Malaysia&apos;s
        Solana Lab — DevLeague 2026. Check back after the dust settles.
      </p>
      <Link href="/app" className="text-sm text-[#123B63] underline mt-2">
        ← Try the app instead
      </Link>
    </div>
  );
}
