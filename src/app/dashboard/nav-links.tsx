"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CalendarIcon,
  ChartIcon,
  MegaphoneIcon,
  EnvelopeIcon,
  SearchIcon,
  DocumentIcon,
  NetworkIcon,
  PhoneIcon,
  GearIcon,
} from "./icons";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: HomeIcon },
  { href: "/dashboard/today", label: "Today", icon: CalendarIcon },
  { href: "/dashboard/analytics", label: "Reports", icon: ChartIcon },
  { href: "/dashboard/marketing", label: "Marketing", icon: MegaphoneIcon },
  { href: "/dashboard/leads", label: "Leads & Email", icon: EnvelopeIcon },
  { href: "/dashboard/buyers", label: "Buyers", icon: SearchIcon },
  { href: "/dashboard/transactions", label: "Transactions", icon: DocumentIcon },
  { href: "/dashboard/sphere", label: "Sphere", icon: NetworkIcon },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneIcon },
  { href: "/dashboard/settings", label: "Settings", icon: GearIcon },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-5xl gap-0.5 overflow-x-auto px-4 pb-2.5">
      {navItems.map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium transition ${
              active
                ? "bg-teal-900 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            <Icon className={`h-[15px] w-[15px] ${active ? "text-white" : "text-stone-400"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
