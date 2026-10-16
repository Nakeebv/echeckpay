import type { ReactNode } from "react";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
import Brand from "@/components/Brand";

export default async function WelcomeLayout({ children }: { children: ReactNode }) {
  const authed = await isAuthed();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand href="/" />
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-1 lg:flex">
              <Link href="/#features" className="nav-link">
                Features
              </Link>
              <Link href="/#how" className="nav-link">
                How it works
              </Link>
              <Link href="/#security" className="nav-link">
                Security
              </Link>
              <Link href="/#faq" className="nav-link">
                FAQ
              </Link>
            </div>
            {authed ? (
              <Link href="/dashboard" className="btn btn-ghost btn-sm">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="hidden text-[13px] font-semibold text-slate-600 transition hover:text-slate-900 sm:inline">
                Sign in
              </Link>
            )}
            <Link href="/register" className="btn btn-dark btn-sm">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Brand href="/" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              <Link href="/standards" className="transition hover:text-slate-900">
                Standards
              </Link>
              <Link href="/login" className="transition hover:text-slate-900">
                Sign in
              </Link>
              <Link href="/register" className="transition hover:text-slate-900">
                Create account
              </Link>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-slate-400">
            Bank acceptance depends on physical output: print at 100% scale on 24 lb+ security
            stock with magnetic (iron-oxide) MICR toner or pre-printed MICR blank stock, and issue a
            Positive Pay file. eCheckPay is for drawing on accounts you own or control.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            © {new Date().getFullYear()} eCheckPay · E-13B · ANSI X9.27 · X9.100-160-1 · UCC Article 3
          </p>
        </div>
      </footer>
    </div>
  );
}
