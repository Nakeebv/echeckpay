"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Desktop navigation with an active-state pill. */
export default function TopNav({
  isAdmin,
  lowBalance = false,
}: {
  isAdmin: boolean;
  lowBalance?: boolean;
}) {
  const path = usePathname();
  const links = isAdmin
    ? [{ href: "/admin", label: "Admin console" }]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/write", label: "Write" },
        { href: "/checks", label: "History" },
        { href: "/wallet", label: "Wallet" },
        { href: "/support", label: "Support" },
      ];

  return (
    <nav className="ml-2 hidden items-center gap-0.5 md:flex">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        const warn = l.href === "/wallet" && lowBalance;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${active ? "bg-slate-100 text-slate-900" : ""} ${
              warn && !active ? "text-amber-700" : ""
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
