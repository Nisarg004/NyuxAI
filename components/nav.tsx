import Link from "next/link";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" as const },
  { href: "/archive", label: "Archive", key: "archive" as const },
  { href: "/runs", label: "Runs", key: "runs" as const },
];

export function Nav({ current }: { current: "dashboard" | "archive" | "runs" }) {
  return (
    <header className="border-b border-border bg-ink text-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-display text-lg tracking-tight">Brieff</span>
        <nav className="flex gap-6 font-mono text-xs uppercase tracking-wide">
          {LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={link.key === current ? "text-amber" : "text-paper/70 hover:text-paper"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
