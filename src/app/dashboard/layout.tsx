import { getCurrentAgent } from "@/lib/dal.server";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const agent = await getCurrentAgent();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-900 text-sm font-semibold text-white">
              {(agent?.businessName ?? agent?.name ?? "R")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-950">
                {agent?.businessName ?? "Real Estate Assistant"}
              </p>
              <p className="text-xs text-stone-500">{agent?.name}</p>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="text-sm text-stone-500 hover:text-stone-900">
              Sign out
            </button>
          </form>
        </div>
        <NavLinks />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
