import type { ReactNode } from "react";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";

export default async function WelcomeLayout({ children }: { children: ReactNode }) {
  const authed = await isAuthed();

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <nav className="no-print sticky top-0 z-40 h-12 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
            eCheckPay
          </Link>
          <div className="flex items-center gap-6 text-xs font-medium text-[#1d1d1f]">
            <Link href="/#features" className="hidden opacity-80 transition hover:opacity-100 sm:inline">
              Features
            </Link>
            <Link href="/#how" className="hidden opacity-80 transition hover:opacity-100 sm:inline">
              How it works
            </Link>
            <Link href="/#security" className="hidden opacity-80 transition hover:opacity-100 sm:inline">
              Security
            </Link>
            <Link href="/#faq" className="hidden opacity-80 transition hover:opacity-100 sm:inline">
              FAQ
            </Link>
            {authed ? (
              <Link href="/dashboard" className="opacity-80 transition hover:opacity-100">
                Dashboard
              </Link>
            ) : null}
            <Link
              href="/login?next=%2Fdashboard"
              className="rounded-full bg-[#0071e3] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0077ed]"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>
      {children}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs leading-relaxed text-[#86868b]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-semibold text-[#1d1d1f]">eCheckPay</span>
            <Link href="/standards" className="transition hover:text-[#1d1d1f]">
              Standards
            </Link>
            <Link href="/login" className="transition hover:text-[#1d1d1f]">
              Sign in
            </Link>
          </div>
          <p className="mt-3 max-w-3xl">
            Bank acceptance depends on physical output: print at 100% scale on 24 lb+ security
            stock with magnetic (iron-oxide) MICR toner or pre-printed MICR blank stock, and issue a
            Positive Pay file. eCheckPay is for drawing on accounts you own or control.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} eCheckPay. E-13B · ANSI X9.27 · X9.100-160-1 · UCC Article 3.</p>
        </div>
      </footer>
    </div>
  );
}
