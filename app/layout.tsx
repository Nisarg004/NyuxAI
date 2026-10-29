import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// The editorial voice: everything the reader reads.
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

// The app's furniture: everything the reader operates.
const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brieff",
  description: "An edition of the news, edited for one reader.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        {children}
        <footer className="mx-auto w-full max-w-2xl border-t border-rule px-6 py-6 text-xs text-ink-soft">
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-editor">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-editor">
              Terms
            </Link>
            <span className="ml-auto">&copy; 2026 Brieff</span>
          </nav>
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
