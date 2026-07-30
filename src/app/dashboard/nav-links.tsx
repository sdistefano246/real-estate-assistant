"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/today", label: "Today" },
  { href: "/dashboard/marketing", label: "Marketing" },
  { href: "/dashboard/leads", label: "Leads & Email" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/calls", label: "Calls" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-5xl gap-6 px-6">
      {navItems.map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`border-b-2 py-3 text-sm font-medium ${
              active
                ? "border-teal-700 text-teal-900"
                : "border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
