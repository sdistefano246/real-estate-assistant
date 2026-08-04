import { getCurrentAgent } from "@/lib/dal.server";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const agent = await getCurrentAgent();
  // When the agent has set an assistant persona (e.g. "Nora"), lead with that
  // name in the header instead of the generic app/business name — it's what
  // the agent's leads actually see signed on messages, so it should be what
  // greets the agent here too. Falls back to the original branding when no
  // persona is set.
  const headerTitle = agent?.assistantName ?? agent?.businessName ?? "Real Estate Assistant";
  const headerSubtitle = agent?.assistantName
    ? `${agent?.businessName ?? agent?.name}'s Assistant`
    : agent?.name;
  const badgeLetter = (agent?.assistantName ?? agent?.businessName ?? agent?.name ?? "R")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-800 to-teal-950 text-base font-semibold text-white shadow-sm">
              {badgeLetter}
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-teal-950">{headerTitle}</p>
              <p className="text-xs text-stone-500">{headerSubtitle}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            >
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
