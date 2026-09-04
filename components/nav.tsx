import Link from "next/link";

const LINKS = [
  { href: "/dashboard", label: "Today's desk", key: "dashboard" as const },
  { href: "/archive", label: "Archive", key: "archive" as const },
  { href: "/runs", label: "Runs", key: "runs" as const },
];

export function Nav({ current }: { current: "dashboard" | "archive" | "runs" }) {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-6 px-6 py-5">
        <Link href="/dashboard" className="font-display text-2xl font-semibold leading-none tracking-tight text-ink">
          Brieff
        </Link>
        <nav className="flex gap-6 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={link.key === current ? "page" : undefined}
              className={
                link.key === current
                  ? "text-editor underline decoration-editor/40 decoration-1 underline-offset-4"
                  : "text-ink-soft transition-colors hover:text-ink"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
