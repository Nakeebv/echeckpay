"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions";

/** Mobile navigation sheet — desktop keeps the inline nav. */
export default function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/write", label: "Write a check" },
    { href: "/checks", label: "History" },
    { href: "/wallet", label: "Wallet" },
    { href: "/support", label: "Support" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin console" }] : []),
  ];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
        </svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-black/5 bg-white shadow-xl">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block border-b border-black/5 px-4 py-3 text-sm font-medium text-[#1d1d1f] last:border-0 hover:bg-[#f5f5f7]"
              >
                {l.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button
                type="submit"
                className="block w-full px-4 py-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}

