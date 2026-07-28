import Link from "next/link";
import { getCurrentAgent } from "@/lib/dal.server";
import { logout } from "@/app/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const agent = await getCurrentAgent();

  const navItems = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/marketing", label: "Marketing" },
    { href: "/dashboard/leads", label: "Leads & Email" },
    { href: "/dashboard/calls", label: "Calls" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {agent?.businessName ?? "Real Estate Assistant"}
            </p>
            <p className="text-xs text-slate-500">{agent?.name}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-6 px-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b-2 border-transparent py-3 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
