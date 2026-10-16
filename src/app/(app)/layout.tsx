import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/amount";
import MobileNav from "@/components/MobileNav";
import TopNav from "@/components/TopNav";
import Brand from "@/components/Brand";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Defense in depth: the proxy only checks cookie presence; verify the HMAC
  // signature AND account status so a stale/forged session never renders.
  const user = await currentUser();
  if (!user) redirect("/login");
  // first-login onboarding gate (profile → account type → bank)
  if (user.role !== "admin" && user.onboarded !== 1) redirect("/onboarding");

  const isAdmin = user.role === "admin";
  const lowBalance = user.balanceCents < 1000;
  const balanceChip = (
    <span
      className={`chip ${
        lowBalance
          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
          : "bg-slate-100 text-slate-900"
      }`}
      title="Printable balance"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${lowBalance ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      {formatCents(user.balanceCents)}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center gap-2">
          <Brand href="/dashboard" />

          <TopNav isAdmin={isAdmin} lowBalance={lowBalance} />

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <Link href="/wallet" className="transition hover:opacity-80">
              {balanceChip}
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>

          {/* mobile controls */}
          <div className="ml-auto flex items-center gap-2 md:hidden">
            {balanceChip}
            <MobileNav isAdmin={isAdmin} />
          </div>
        </div>
      </header>

      <main className="container-page py-6 sm:py-8">{children}</main>

      <footer className="no-print container-page pb-10 pt-4 text-[11px] leading-relaxed text-slate-400">
        eCheckPay prints bank-accepted checks — true E-13B MICR, security features and Positive Pay
        built in. Print at 100% scale on security stock with MICR toner.
      </footer>
    </div>
  );
}
