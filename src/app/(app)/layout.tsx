import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/amount";
import MobileNav from "@/components/MobileNav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Defense in depth: the proxy only checks cookie presence; verify the HMAC
  // signature AND account status so a stale/forged session never renders.
  const user = await currentUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === "admin";
  const lowBalance = user.balanceCents < 1000;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="no-print sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/dashboard" className="flex-none text-lg font-bold tracking-tight text-[#1d1d1f]">
            eCheckPay
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <Link href="/dashboard" className="nav-link">Dashboard</Link>
            <Link href="/write" className="nav-link">Write</Link>
            <Link href="/checks" className="nav-link">History</Link>
            <Link href="/wallet" className={lowBalance ? "nav-link !text-[#b45309]" : "nav-link"}>Wallet</Link>
            <Link href="/support" className="nav-link">Support</Link>
            {isAdmin ? <Link href="/admin" className="nav-link !text-[#0071e3]">Admin</Link> : null}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <span
              className={`chip ${lowBalance ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-[#f5f5f7] text-[#1d1d1f]"}`}
              title="Printable balance"
            >
              {formatCents(user.balanceCents)}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
            </form>
          </div>

          {/* mobile controls */}
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <span className={`chip ${lowBalance ? "bg-amber-100 text-amber-900" : "bg-[#f5f5f7] text-[#1d1d1f]"}`}>
              {formatCents(user.balanceCents)}
            </span>
            <MobileNav isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="no-print mx-auto max-w-7xl px-4 pb-10 pt-4 text-[11px] leading-relaxed text-slate-400 sm:px-6">
        eCheckPay prints bank-accepted checks — true E-13B MICR, security features and Positive Pay
        built in. Print at 100% scale on security stock with MICR toner.
      </footer>
    </div>
  );
}
