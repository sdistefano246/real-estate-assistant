import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isResendConfigured } from "@/lib/resend.server";
import { TransactionCard } from "./transaction-card";

export default async function TransactionsPage() {
  const { agentId } = await verifySession();

  const transactions = await prisma.transaction.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    include: {
      milestones: { orderBy: { dueDate: "asc" } },
      contacts: { include: { chaseLogs: { orderBy: { createdAt: "desc" } } } },
    },
  });

  const anthropicConfigured = isAnthropicConfigured();
  const resendConfigured = isResendConfigured();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Transactions</h1>
        <p className="text-sm text-stone-500">
          Deadlines, contacts, and document chasing for deals under contract.
        </p>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-stone-400">
          No transactions yet — convert a qualified lead from the Leads page to start one.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              anthropicConfigured={anthropicConfigured}
              resendConfigured={resendConfigured}
            />
          ))}
        </div>
      )}
    </div>
  );
}
