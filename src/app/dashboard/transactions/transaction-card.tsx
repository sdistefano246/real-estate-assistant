"use client";

import { useState, useTransition, useActionState } from "react";
import {
  addMilestone,
  addTransactionContact,
  updateTransactionStatus,
  setTransactionFinancials,
} from "@/app/actions/transactions";
import { addContact } from "@/app/actions/contacts";
import { computeGci, usedAssumedRate } from "@/lib/commission";
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
import {
  CONTACT_RELATIONSHIPS,
  CONTACT_RELATIONSHIP_LABELS,
  type ContactRelationship,
} from "@/lib/contact-relationship";
import { MilestoneRow } from "./milestone-row";
import { ContactBlock } from "./contact-block";

function formatUsd(n: number): string {
  return `$${n.toLocaleString()}`;
}

type MilestoneItem = { id: string; label: string; dueDate: Date; completed: boolean };
type ChaseLogItem = { id: string; subject: string; body: string; status: string };
type ContactItem = { id: string; role: string; name: string; email: string; chaseLogs: ChaseLogItem[] };
type SphereContactItem = { id: string; name: string; relationship: string };
type LeadPrefill = { name: string; email: string | null; phone: string | null } | null;

type TransactionItem = {
  id: string;
  propertyAddress: string;
  side: string;
  status: string;
  contractDate: Date | null;
  closingDate: Date | null;
  salePrice: number | null;
  commissionRate: number | null;
  milestones: MilestoneItem[];
  contacts: ContactItem[];
  sphereContacts: SphereContactItem[];
  lead: LeadPrefill;
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

  const [showAddSphereContact, setShowAddSphereContact] = useState(false);
  const [sphereContactState, sphereContactFormAction, sphereContactPending] = useActionState(addContact, undefined);

  const [showEditFinancials, setShowEditFinancials] = useState(false);
  const [priceInput, setPriceInput] = useState(transaction.salePrice != null ? String(transaction.salePrice) : "");
  const [rateInput, setRateInput] = useState(transaction.commissionRate != null ? String(transaction.commissionRate) : "");

  const gci = computeGci(transaction.salePrice, transaction.commissionRate);
  const gciAssumed = usedAssumedRate(transaction.salePrice, transaction.commissionRate);

  function submitFinancials() {
    const price = priceInput.replace(/[$,\s]/g, "").trim();
    const rate = rateInput.replace(/[%,\s]/g, "").trim();
    const salePrice = price ? Number.parseInt(price, 10) : null;
    const commissionRate = rate ? Number.parseFloat(rate) : null;
    startTransition(async () => {
      await setTransactionFinancials(
        transaction.id,
        salePrice != null && Number.isFinite(salePrice) ? salePrice : null,
        commissionRate != null && Number.isFinite(commissionRate) ? commissionRate : null
      );
      setShowEditFinancials(false);
    });
  }

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
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5">
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
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Deal financials</h4>
          {!showEditFinancials && (
            <button
              onClick={() => setShowEditFinancials(true)}
              className="text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              {transaction.salePrice != null ? "Edit" : "+ Add sale price"}
            </button>
          )}
        </div>

        {!showEditFinancials && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-stone-600">
            {transaction.salePrice != null ? (
              <>
                <span>Sale price: {formatUsd(transaction.salePrice)}</span>
                <span>
                  Commission: {transaction.commissionRate != null ? `${transaction.commissionRate}%` : "—"}
                </span>
                {gci != null && (
                  <span className="font-medium text-teal-900">
                    GCI: {formatUsd(gci)}
                    {gciAssumed && <span className="font-normal text-stone-400"> (assumed rate)</span>}
                  </span>
                )}
              </>
            ) : (
              <span className="text-stone-400">No sale price yet — add one for commission tracking in Reports.</span>
            )}
          </div>
        )}

        {showEditFinancials && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              inputMode="numeric"
              placeholder="Sale price"
              className="w-36 rounded-md border border-stone-300 px-2 py-1 text-xs"
            />
            <input
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              inputMode="decimal"
              placeholder="Commission %"
              className="w-28 rounded-md border border-stone-300 px-2 py-1 text-xs"
            />
            <button
              disabled={isPending}
              onClick={submitFinancials}
              className="rounded-md bg-teal-900 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowEditFinancials(false);
                setPriceInput(transaction.salePrice != null ? String(transaction.salePrice) : "");
                setRateInput(transaction.commissionRate != null ? String(transaction.commissionRate) : "");
              }}
              className="text-xs text-stone-400 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        )}
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

      {transaction.status === "closed" && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Sphere of influence
          </h4>

          {transaction.sphereContacts.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {transaction.sphereContacts.map((contact) => (
                <li key={contact.id} className="text-xs text-stone-600">
                  {contact.name}{" "}
                  <span className="text-stone-400">
                    — {CONTACT_RELATIONSHIP_LABELS[contact.relationship as ContactRelationship] ?? contact.relationship}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!showAddSphereContact && (
            <button
              onClick={() => setShowAddSphereContact(true)}
              className="mt-2 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              + Add to sphere of influence
            </button>
          )}
          {showAddSphereContact && (
            <form action={sphereContactFormAction} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="transactionId" value={transaction.id} />
              <input
                name="name"
                required
                defaultValue={transaction.lead?.name ?? ""}
                placeholder="Name"
                className="rounded-md border border-stone-300 px-2 py-1 text-xs"
              />
              <input
                name="email"
                type="email"
                defaultValue={transaction.lead?.email ?? ""}
                placeholder="Email"
                className="rounded-md border border-stone-300 px-2 py-1 text-xs"
              />
              <input
                name="phone"
                defaultValue={transaction.lead?.phone ?? ""}
                placeholder="Phone"
                className="rounded-md border border-stone-300 px-2 py-1 text-xs"
              />
              <select
                name="relationship"
                defaultValue="past_client"
                className="rounded-md border border-stone-300 px-2 py-1 text-xs"
              >
                {CONTACT_RELATIONSHIPS.map((relationship) => (
                  <option key={relationship} value={relationship}>
                    {CONTACT_RELATIONSHIP_LABELS[relationship]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={sphereContactPending}
                className="rounded-md bg-teal-900 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddSphereContact(false)}
                className="text-xs text-stone-400 hover:text-stone-700"
              >
                Cancel
              </button>
              {sphereContactState?.error && (
                <p className="w-full text-xs text-red-600">{sphereContactState.error}</p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
