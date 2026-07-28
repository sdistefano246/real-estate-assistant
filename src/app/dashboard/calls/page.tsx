import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isTwilioConfigured } from "@/lib/twilio.server";

export default async function CallsPage() {
  const { agentId } = await verifySession();
  const calls = await prisma.callLog.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const configured = isTwilioConfigured();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Calls</h1>
        <p className="text-sm text-slate-500">Missed-call auto-text log and setup.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Setup</h2>
        {!configured && (
          <p className="mt-1 text-sm text-amber-700">
            Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and
            AGENT_FORWARDING_PHONE to .env to enable this.
          </p>
        )}
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-slate-600">
          <li>Buy or use an existing Twilio phone number.</li>
          <li>
            Once this app is deployed to a public URL, open the number&apos;s configuration in the
            Twilio console and set &quot;A call comes in&quot; to a webhook pointing at{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
              https://your-domain.com/api/twilio/voice
            </code>{" "}
            (HTTP POST).
          </li>
          <li>
            Set <code className="font-mono">AGENT_FORWARDING_PHONE</code> to the agent&apos;s real
            cell number in E.164 format (e.g. <code className="font-mono">+15551234567</code>) — calls
            ring there first for 20 seconds before being treated as missed.
          </li>
          <li>
            This won&apos;t work against <code className="font-mono">localhost</code> — Twilio needs a
            publicly reachable URL, so this step only applies once deployed.
          </li>
        </ol>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Call log</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-slate-400">No calls logged yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Caller</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Text sent</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((call) => (
                  <tr key={call.id}>
                    <td className="px-4 py-2 text-slate-900">{call.callerNumber}</td>
                    <td className="px-4 py-2 text-slate-600">{call.missed ? "Missed" : "Answered"}</td>
                    <td className="px-4 py-2 text-slate-600">{call.textSent ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {call.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
