import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "/dashboard", label: "Today", key: "dashboard" as const },
  { href: "/archive", label: "Past briefs", key: "archive" as const },
  { href: "/runs", label: "Runs", key: "runs" as const },
];

export function Nav({ current, isAdmin = false }: { current: "dashboard" | "archive" | "runs"; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-6">
        <Link href="/dashboard" aria-label="Nyux home" className="shrink-0 text-lg text-star sm:text-xl">
          <Logo />
        </Link>
        <nav className="flex items-center gap-0.5 text-[13px] sm:gap-1 sm:text-sm">
          {LINKS.filter((link) => link.key !== "runs" || isAdmin).map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={link.key === current ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors sm:px-3.5 ${
                link.key === current ? "bg-night-2 text-star ring-1 ring-line" : "text-haze hover:text-star"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-haze transition-colors hover:text-star sm:px-3.5">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
