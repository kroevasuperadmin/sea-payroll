import Link from "next/link";

export default function Docs() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center gap-4">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#5A6B70]">
        Docs
      </p>
      <h1 className="text-3xl font-extrabold text-[#123B63]">
        The code is the documentation.
      </h1>
      <p className="text-sm text-[#5A6B70] max-w-sm">
        Tiba is fully open source — read the README and the payment engine
        directly on GitHub.
      </p>
      <a
        href="https://github.com/kroevasuperadmin/sea-payroll"
        target="_blank"
        rel="noreferrer"
        className="text-sm text-[#123B63] underline mt-2"
      >
        View the repository ↗
      </a>
      <Link href="/" className="text-sm text-[#5A6B70] underline">
        ← Try the app instead
      </Link>
    </div>
  );
}
