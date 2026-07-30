"use client";

import { useState, useTransition, useActionState } from "react";
import { addMilestone, addTransactionContact, updateTransactionStatus } from "@/app/actions/transactions";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  type TransactionStatus,
} from "@/lib/transaction-status";
import {
  TRANSACTION_CONTACT_ROLES,
  TRANSACTION_CONTACT_ROLE_LABELS,
  type TransactionContactRole,
} from "@/lib/transaction-contact-role";
import { MilestoneRow } from "./milestone-row";
import { ContactBlock } from "./contact-block";

type MilestoneItem = { id: string; label: string; dueDate: Date; completed: boolean };
type ChaseLogItem = { id: string; subject: string; body: string; status: string };
type ContactItem = { id: string; role: string; name: string; email: string; chaseLogs: ChaseLogItem[] };

type TransactionItem = {
  id: string;
  propertyAddress: string;
  side: string;
  status: string;
  contractDate: Date | null;
  closingDate: Date | null;
  milestones: MilestoneItem[];
  contacts: ContactItem[];
};

export function TransactionCard({
  transaction,
  anthropicConfigured,
  resendConfigured,
}: {
  transaction: TransactionItem;
  anthropicConfigured: boolean;
  resendConfigured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneLabel, setMilestoneLabel] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);

  const addContactAction = addTransactionContact.bind(null, transaction.id);
  const [addContactState, addContactFormAction, addContactPending] = useActionState(addContactAction, undefined);

  function submitMilestone() {
    if (!milestoneLabel.trim() || !milestoneDate) return;
    startTransition(async () => {
      await addMilestone(transaction.id, milestoneLabel, milestoneDate);
      setMilestoneLabel("");
      setMilestoneDate("");
      setShowAddMilestone(false);
    });
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-teal-900">{transaction.propertyAddress}</h3>
          <p className="text-xs text-stone-500">
            {transaction.side === "buyer" ? "Buyer side" : "Seller side"}
            {transaction.contractDate && ` · Contract ${transaction.contractDate.toLocaleDateString()}`}
            {transaction.closingDate && ` · Closing ${transaction.closingDate.toLocaleDateString()}`}
          </p>
        </div>
        <select
          value={transaction.status}
          disabled={isPending}
          onChange={(e) => startTransition(() => updateTransactionStatus(transaction.id, e.target.value))}
          className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 disabled:opacity-50"
        >
          {TRANSACTION_STATUSES.map((status: TransactionStatus) => (
            <option key={status} value={status}>
              {TRANSACTION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Milestones</h4>
        <div className="mt-2 flex flex-col gap-1.5">
          {transaction.milestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone} />
          ))}
        </div>

        {!showAddMilestone && (
          <button
            onClick={() => setShowAddMilestone(true)}
            className="mt-2 text-xs font-medium text-stone-500 hover:text-stone-800"
          >
            + Add milestone
          </button>
        )}
        {showAddMilestone && (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={milestoneLabel}
              onChange={(e) => setMilestoneLabel(e.target.value)}
              placeholder="Label"
              className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs"
            />
            <input
              type="date"
              value={milestoneDate}
              onChange={(e) => setMilestoneDate(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1 text-xs"
            />
            <button
              disabled={isPending}
              onClick={submitMilestone}
              className="rounded-md bg-teal-900 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddMilestone(false)}
              className="text-xs text-stone-400 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Contacts</h4>
        <div className="mt-2 flex flex-col gap-2">
          {transaction.contacts.map((contact) => (
            <ContactBlock
              key={contact.id}
              contact={contact}
              anthropicConfigured={anthropicConfigured}
              resendConfigured={resendConfigured}
            />
          ))}
        </div>

        {!showAddContact && (
          <button
            onClick={() => setShowAddContact(true)}
            className="mt-2 text-xs font-medium text-stone-500 hover:text-stone-800"
          >
            + Add contact
          </button>
        )}
        {showAddContact && (
          <form action={addContactFormAction} className="mt-2 flex flex-wrap items-center gap-2">
            <select name="role" defaultValue="lender" className="rounded-md border border-stone-300 px-2 py-1 text-xs">
              {TRANSACTION_CONTACT_ROLES.map((role: TransactionContactRole) => (
                <option key={role} value={role}>
                  {TRANSACTION_CONTACT_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <input name="name" required placeholder="Name" className="rounded-md border border-stone-300 px-2 py-1 text-xs" />
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              className="rounded-md border border-stone-300 px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={addContactPending}
              className="rounded-md bg-teal-900 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddContact(false)}
              className="text-xs text-stone-400 hover:text-stone-700"
            >
              Cancel
            </button>
            {addContactState?.error && <p className="w-full text-xs text-red-600">{addContactState.error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
