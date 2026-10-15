import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { isAuthed } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Defense in depth: the proxy only checks cookie presence; verify the HMAC
  // signature so a stale or forged session can never render an app page.
  if (!(await isAuthed())) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print sticky top-0 z-40 border-b border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-[#1d1d1f]">
            eCheckPay
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-slate-100"
            >
              Dashboard
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <footer className="no-print mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs leading-relaxed text-slate-500">
        eCheckPay prints bank-accepted checks — true E-13B MICR, security features and Positive Pay
        built in. Print at 100% scale on security stock with MICR toner.
      </footer>
    </div>
  );
}
