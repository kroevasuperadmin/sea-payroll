import Link from "next/link";
import type { ReactNode } from "react";

export const EYEBROW_CLASS =
  "text-[11px] tracking-[0.2em] uppercase text-[#5A6B70]";
export const CARD_CLASS = "rounded-lg border border-[#123B63]/12 bg-white";
export const PANEL_CLASS =
  "rounded-2xl border border-[#123B63]/12 bg-[#123B63]/[0.04] p-5";
export const INPUT_CLASS =
  "rounded-lg border bg-white px-3 py-2.5 text-base outline-none transition-colors";
export const ADDRESS_LINK_CLASS =
  "font-mono text-xs underline decoration-dotted decoration-[#5A6B70] hover:text-[#123B63]";
export const PRIMARY_BUTTON_CLASS =
  "rounded-full bg-[#E3A63B] text-[#16343A] font-semibold disabled:opacity-30 disabled:bg-[#123B63]/10 disabled:text-[#5A6B70] transition-colors";

export function Eyebrow({
  as: Tag = "p",
  className = "",
  children,
}: {
  as?: "p" | "h2";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`${EYEBROW_CLASS} ${className}`.trim()}>{children}</Tag>;
}

export function ExternalLink({
  href,
  className = "",
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className={className}
    >
      {children}
    </a>
  );
}

export function NavLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-[#5A6B70] hover:text-[#123B63] transition-colors ${className}`.trim()}
    >
      {children}
    </Link>
  );
}

export function BackLink({
  href = "/",
  tone = "primary",
  className = "",
  children,
}: {
  href?: string;
  tone?: "primary" | "muted";
  className?: string;
  children: ReactNode;
}) {
  const color = tone === "primary" ? "text-[#123B63]" : "text-[#5A6B70]";
  return (
    <Link href={href} className={`text-sm underline ${color} ${className}`.trim()}>
      {children}
    </Link>
  );
}

// Shared shell for the short informational pages (blog, docs, pricing): an
// eyebrow, a headline, one paragraph, optional extra call-to-action, and a link
// back into the app.
export function PlaceholderPage({
  eyebrow,
  title,
  body,
  backTone = "primary",
  backLabel = "← Try the app instead",
  children,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  backTone?: "primary" | "muted";
  backLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center gap-4">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-3xl font-extrabold text-[#123B63]">{title}</h1>
      <p className="text-sm text-[#5A6B70] max-w-sm">{body}</p>
      {children}
      <BackLink tone={backTone} className={children ? "" : "mt-2"}>
        {backLabel}
      </BackLink>
    </div>
  );
}
