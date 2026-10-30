import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { Logo } from "@/components/brand/logo";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

// The voice: headlines and the wordmark.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

// Everything read and operated.
const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Nyux: the news that matters to your work",
  description:
    "Nyux reads hundreds of stories a day, checks every claim against its source, and sends you the few that matter to your job.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-night font-sans text-star">
        {children}
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8 text-sm text-haze">
            <Logo className="text-lg text-star" />
            <nav className="flex gap-5">
              <Link href="/privacy" className="hover:text-star">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-star">
                Terms
              </Link>
              <Link href="/signin" className="hover:text-star">
                Sign in
              </Link>
            </nav>
            <span className="ml-auto">&copy; 2026 Nyux</span>
          </div>
        </footer>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
