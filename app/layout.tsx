import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haazir · Emergency referral router",
  description: "Phones every capable hospital nearby at once and hands the doctor a confirmed bed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const NAV = [
  { href: "/", label: "New referral" },
  { href: "/history", label: "History" },
  { href: "/facilities", label: "Facilities" },
  { href: "/demo", label: "Demo" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="z-[1100] border-b sm:sticky sm:top-0 border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
            <Link href="/" className="text-xl font-extrabold tracking-tight text-blue-800">
              Haazir
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
