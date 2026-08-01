"use client";

import { useState, useTransition, useActionState, useRef, useEffect } from "react";
import {
  updateBuyer,
  updateBuyerStatus,
  deleteBuyer,
  addBuyerProperty,
  updateBuyerPropertyStatus,
  deleteBuyerProperty,
  scheduleShowing,
  completeShowing,
  deleteShowing,
} from "@/app/actions/buyers";
import { BUYER_STATUSES, BUYER_STATUS_LABELS, type BuyerStatus } from "@/lib/buyer-status";
import {
  BUYER_PROPERTY_STATUSES,
  BUYER_PROPERTY_STATUS_LABELS,
  type BuyerPropertyStatus,
} from "@/lib/buyer-property-status";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, propertyTypeLabel } from "@/lib/property-type";
import { evaluateMatch, hasAnyCriteria, type BuyerCriteria } from "@/lib/buyer-match";
import { HomeIcon, CalendarIcon } from "../icons";

export type PropertyItem = {
  id: string;
  address: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  propertyType: string | null;
  listingUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
};

export type ShowingItem = {
  id: string;
  address: string;
  scheduledAt: Date;
  completed: boolean;
  feedback: string | null;
  buyerPropertyId: string | null;
  isPast: boolean;
};

export type BuyerItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  locations: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minBeds: number | null;
  minBaths: number | null;
  propertyType: string | null;
  mustHaves: string | null;
  preApproved: boolean;
  preApprovalAmount: number | null;
  notes: string | null;
  createdAt: Date;
  properties: PropertyItem[];
  showings: ShowingItem[];
};

export type MatchedListing = { id: string; address: string; price: number };

const inputCls = "mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm";

// Same fixed categorical order used for Overview's stat cards — a buyer's
// avatar color is stable (hashed from their id) so it stays consistent
// across renders, and distinct buyers read apart at a glance in a long list.
const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-700",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function usd(n: number): string {
  return `$${n.toLocaleString()}`;
}

function priceRange(buyer: BuyerItem): string | null {
  const { minPrice, maxPrice } = buyer;
  if (minPrice != null && maxPrice != null) return `${usd(minPrice)}–${usd(maxPrice)}`;
  if (maxPrice != null) return `up to ${usd(maxPrice)}`;
  if (minPrice != null) return `${usd(minPrice)}+`;
  return null;
}

function criteriaSummary(buyer: BuyerItem): string[] {
  const parts: string[] = [];
  if (buyer.locations) parts.push(buyer.locations);
  const range = priceRange(buyer);
  if (range) parts.push(range);
  if (buyer.minBeds != null) parts.push(`${buyer.minBeds}+ bd`);
  if (buyer.minBaths != null) parts.push(`${buyer.minBaths}+ ba`);
  const type = propertyTypeLabel(buyer.propertyType);
  if (type && buyer.propertyType !== "any") parts.push(type);
  return parts;
}

function criteriaFrom(buyer: BuyerItem): BuyerCriteria {
  return {
    minPrice: buyer.minPrice,
    maxPrice: buyer.maxPrice,
    minBeds: buyer.minBeds,
    minBaths: buyer.minBaths,
    propertyType: buyer.propertyType,
  };
}

export function BuyerCard({ buyer, matchedListings }: { buyer: BuyerItem; matchedListings: MatchedListing[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingProperty, setAddingProperty] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const summary = criteriaSummary(buyer);
  const criteria = criteriaFrom(buyer);
  const upcomingShowings = buyer.showings.filter((s) => !s.completed);
  const pastShowings = buyer.showings.filter((s) => s.completed);

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(buyer.id)}`}
          >
            {buyer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-teal-900">{buyer.name}</h3>
              {buyer.preApproved && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  Pre-approved{buyer.preApprovalAmount ? ` · ${usd(buyer.preApprovalAmount)}` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              {[buyer.email, buyer.phone].filter(Boolean).join(" · ") || "No contact info"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={buyer.status}
            disabled={isPending}
            onChange={(e) => run(() => updateBuyerStatus(buyer.id, e.target.value))}
            className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 disabled:opacity-50"
          >
            {BUYER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BUYER_STATUS_LABELS[s as BuyerStatus]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <EditBuyerForm buyer={buyer} onDone={() => setEditing(false)} onDelete={() => run(() => deleteBuyer(buyer.id))} />
      ) : (
        <>
          {summary.length > 0 ? (
            <p className="mt-2 text-xs text-stone-600">
              <span className="text-stone-400">Looking for: </span>
              {summary.join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-stone-400">No search criteria yet — add some via Edit.</p>
          )}
          {buyer.mustHaves && (
            <p className="mt-1 text-xs text-stone-500">
              <span className="text-stone-400">Must-haves: </span>
              {buyer.mustHaves}
            </p>
          )}
          {buyer.notes && <p className="mt-1 text-xs text-stone-500">{buyer.notes}</p>}
        </>
      )}

      {matchedListings.length > 0 && (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3">
          <p className="text-xs font-medium text-teal-900">
            {matchedListings.length} of your listings fit this buyer:
          </p>
          <ul className="mt-1 space-y-0.5">
            {matchedListings.map((l) => (
              <li key={l.id} className="text-xs text-teal-800">
                {l.address} — {usd(l.price)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Candidate properties */}
      <div className="mt-4 border-t border-stone-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <HomeIcon className="h-3.5 w-3.5 text-stone-400" />
            Properties ({buyer.properties.length})
          </h4>
          <button
            onClick={() => setAddingProperty((v) => !v)}
            className="text-xs font-medium text-teal-800 hover:text-teal-900"
          >
            {addingProperty ? "Cancel" : "+ Add property"}
          </button>
        </div>

        {addingProperty && <AddPropertyForm buyerId={buyer.id} onDone={() => setAddingProperty(false)} />}

        {buyer.properties.length === 0 && !addingProperty && (
          <p className="mt-2 text-xs text-stone-400">
            No candidate homes yet. Add ones you find, and they&apos;ll be checked against the criteria.
          </p>
        )}

        <div className="mt-2 flex flex-col gap-2">
          {buyer.properties.map((property) => (
            <PropertyRow
              key={property.id}
              property={property}
              hasCriteria={hasAnyCriteria(criteria)}
              match={evaluateMatch(criteria, {
                price: property.price,
                beds: property.beds,
                baths: property.baths,
                propertyType: property.propertyType,
              })}
              onStatus={(status) => run(() => updateBuyerPropertyStatus(property.id, status))}
              onDelete={() => run(() => deleteBuyerProperty(property.id))}
              disabled={isPending}
            />
          ))}
        </div>
      </div>

      {/* Showings */}
      <div className="mt-4 border-t border-stone-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <CalendarIcon className="h-3.5 w-3.5 text-stone-400" />
            Showings
          </h4>
          <button
            onClick={() => setScheduling((v) => !v)}
            className="text-xs font-medium text-teal-800 hover:text-teal-900"
          >
            {scheduling ? "Cancel" : "+ Schedule showing"}
          </button>
        </div>

        {scheduling && (
          <ScheduleShowingForm
            buyerId={buyer.id}
            properties={buyer.properties}
            onDone={() => setScheduling(false)}
          />
        )}

        {upcomingShowings.length === 0 && pastShowings.length === 0 && !scheduling && (
          <p className="mt-2 text-xs text-stone-400">No showings scheduled.</p>
        )}

        <div className="mt-2 flex flex-col gap-2">
          {upcomingShowings.map((showing) => (
            <ShowingRow
              key={showing.id}
              showing={showing}
              onComplete={(feedback) => run(() => completeShowing(showing.id, feedback))}
              onDelete={() => run(() => deleteShowing(showing.id))}
              disabled={isPending}
            />
          ))}
          {pastShowings.map((showing) => (
            <ShowingRow
              key={showing.id}
              showing={showing}
              onComplete={(feedback) => run(() => completeShowing(showing.id, feedback))}
              onDelete={() => run(() => deleteShowing(showing.id))}
              disabled={isPending}
            />
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// --- Edit buyer -----------------------------------------------------------

function EditBuyerForm({
  buyer,
  onDone,
  onDelete,
}: {
  buyer: BuyerItem;
  onDone: () => void;
  onDelete: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateBuyer, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-stone-50 p-4">
      <input type="hidden" name="buyerId" value={buyer.id} />

      <Labeled label="Name">
        <input name="name" defaultValue={buyer.name} required className={inputCls} />
      </Labeled>
      <Labeled label="Status">
        <select name="status" defaultValue={buyer.status} className={inputCls}>
          {BUYER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BUYER_STATUS_LABELS[s as BuyerStatus]}
            </option>
          ))}
        </select>
      </Labeled>

      <Labeled label="Email">
        <input name="email" type="email" defaultValue={buyer.email ?? ""} className={inputCls} />
      </Labeled>
      <Labeled label="Phone">
        <input name="phone" defaultValue={buyer.phone ?? ""} className={inputCls} />
      </Labeled>

      <Labeled label="Target locations">
        <input name="locations" defaultValue={buyer.locations ?? ""} className={inputCls} />
      </Labeled>
      <Labeled label="Property type">
        <select name="propertyType" defaultValue={buyer.propertyType ?? ""} className={inputCls}>
          <option value="">No preference</option>
          <option value="any">Any type</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROPERTY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Labeled>

      <div className="grid grid-cols-2 gap-2">
        <Labeled label="Min price">
          <input name="minPrice" inputMode="numeric" defaultValue={buyer.minPrice ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Max price">
          <input name="maxPrice" inputMode="numeric" defaultValue={buyer.maxPrice ?? ""} className={inputCls} />
        </Labeled>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Labeled label="Min beds">
          <input name="minBeds" inputMode="numeric" defaultValue={buyer.minBeds ?? ""} className={inputCls} />
        </Labeled>
        <Labeled label="Min baths">
          <input name="minBaths" inputMode="decimal" defaultValue={buyer.minBaths ?? ""} className={inputCls} />
        </Labeled>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Labeled label="Pre-approval $">
          <input
            name="preApprovalAmount"
            inputMode="numeric"
            defaultValue={buyer.preApprovalAmount ?? ""}
            className={inputCls}
          />
        </Labeled>
        <label className="mt-6 flex items-center gap-2 text-sm text-stone-700">
          <input name="preApproved" type="checkbox" defaultChecked={buyer.preApproved} className="rounded border-stone-300" />
          Pre-approved
        </label>
      </div>
      <Labeled label="Must-haves">
        <input name="mustHaves" defaultValue={buyer.mustHaves ?? ""} className={inputCls} />
      </Labeled>

      <Labeled label="Notes" className="col-span-2">
        <textarea name="notes" rows={2} defaultValue={buyer.notes ?? ""} className={inputCls} />
      </Labeled>

      {state?.error && <p className="col-span-2 text-xs text-red-600">{state.error}</p>}

      <div className="col-span-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${buyer.name} and all their properties and showings?`)) onDelete();
          }}
          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete buyer
        </button>
      </div>
    </form>
  );
}

// --- Add candidate property ----------------------------------------------

function AddPropertyForm({ buyerId, onDone }: { buyerId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(addBuyerProperty, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={formAction} className="mt-2 grid grid-cols-2 gap-3 rounded-md bg-stone-50 p-4">
      <input type="hidden" name="buyerId" value={buyerId} />
      <Labeled label="Address" className="col-span-2">
        <input name="address" required className={inputCls} />
      </Labeled>
      <div className="grid grid-cols-3 gap-2 col-span-2">
        <Labeled label="Price">
          <input name="price" inputMode="numeric" placeholder="$" className={inputCls} />
        </Labeled>
        <Labeled label="Beds">
          <input name="beds" inputMode="numeric" className={inputCls} />
        </Labeled>
        <Labeled label="Baths">
          <input name="baths" inputMode="decimal" className={inputCls} />
        </Labeled>
      </div>
      <Labeled label="Property type">
        <select name="propertyType" defaultValue="" className={inputCls}>
          <option value="">Unspecified</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROPERTY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Listing URL">
        <input name="listingUrl" placeholder="https://…" className={inputCls} />
      </Labeled>
      <Labeled label="Notes" className="col-span-2">
        <input name="notes" className={inputCls} />
      </Labeled>

      {state?.error && <p className="col-span-2 text-xs text-red-600">{state.error}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add property"}
        </button>
      </div>
    </form>
  );
}

function PropertyRow({
  property,
  hasCriteria,
  match,
  onStatus,
  onDelete,
  disabled,
}: {
  property: PropertyItem;
  hasCriteria: boolean;
  match: { matches: boolean; mismatches: string[] };
  onStatus: (status: string) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const detail = [
    property.price != null ? usd(property.price) : null,
    property.beds != null ? `${property.beds} bd` : null,
    property.baths != null ? `${property.baths} ba` : null,
    propertyTypeLabel(property.propertyType),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-md border border-stone-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-teal-900">{property.address}</p>
            {hasCriteria &&
              (match.matches ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  Fits criteria
                </span>
              ) : (
                <span
                  title={match.mismatches.join(", ")}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500"
                >
                  {match.mismatches[0] ?? "Off criteria"}
                </span>
              ))}
          </div>
          {detail && <p className="mt-0.5 text-xs text-stone-500">{detail}</p>}
          {property.notes && <p className="mt-0.5 text-xs text-stone-400">{property.notes}</p>}
          {property.listingUrl && (
            <a
              href={property.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-xs text-teal-700 hover:text-teal-900"
            >
              View listing →
            </a>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <select
            value={property.status}
            disabled={disabled}
            onChange={(e) => onStatus(e.target.value)}
            className="rounded-md border border-stone-300 px-2 py-1 text-[11px] text-stone-700 disabled:opacity-50"
          >
            {BUYER_PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BUYER_PROPERTY_STATUS_LABELS[s as BuyerPropertyStatus]}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            disabled={disabled}
            title="Remove property"
            className="rounded-md border border-stone-200 px-2 py-1 text-[11px] text-stone-400 hover:bg-stone-50 hover:text-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Showings -------------------------------------------------------------

function ScheduleShowingForm({
  buyerId,
  properties,
  onDone,
}: {
  buyerId: string;
  properties: PropertyItem[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(scheduleShowing, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={formAction} className="mt-2 grid grid-cols-2 gap-3 rounded-md bg-stone-50 p-4">
      <input type="hidden" name="buyerId" value={buyerId} />

      {properties.length > 0 && (
        <Labeled label="Property" className="col-span-2">
          <PropertyPicker properties={properties} />
        </Labeled>
      )}

      <Labeled label="Address" className="col-span-2">
        <input name="address" required placeholder="Where's the showing?" className={inputCls} />
      </Labeled>
      <Labeled label="Date & time" className="col-span-2">
        <input name="scheduledAt" type="datetime-local" required className={inputCls} />
      </Labeled>

      {state?.error && <p className="col-span-2 text-xs text-red-600">{state.error}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Scheduling…" : "Schedule showing"}
        </button>
      </div>
    </form>
  );
}

// Picking a tracked property pre-fills the address field so the agent doesn't
// retype it — but the address input stays editable for one-off showings.
function PropertyPicker({ properties }: { properties: PropertyItem[] }) {
  return (
    <select
      name="buyerPropertyId"
      defaultValue=""
      onChange={(e) => {
        const match = properties.find((p) => p.id === e.target.value);
        const form = e.target.form;
        if (form && match) {
          const addressInput = form.elements.namedItem("address") as HTMLInputElement | null;
          if (addressInput) addressInput.value = match.address;
        }
      }}
      className={inputCls}
    >
      <option value="">One-off (not a tracked property)</option>
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.address}
        </option>
      ))}
    </select>
  );
}

function ShowingRow({
  showing,
  onComplete,
  onDelete,
  disabled,
}: {
  showing: ShowingItem;
  onComplete: (feedback: string) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const when = showing.scheduledAt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const isPast = showing.isPast;

  return (
    <div className={`rounded-md border p-3 ${showing.completed ? "border-stone-100 bg-stone-50" : "border-stone-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-teal-900">{showing.address}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {when}
            {showing.completed ? (
              <span className="ml-2 text-emerald-600">Toured</span>
            ) : isPast ? (
              <span className="ml-2 text-amber-700">Awaiting feedback</span>
            ) : null}
          </p>
          {showing.completed && showing.feedback && (
            <p className="mt-1 text-xs text-stone-600">{showing.feedback}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!showing.completed && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border border-stone-300 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
            >
              {open ? "Close" : "Mark toured"}
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={disabled}
            title="Remove showing"
            className="rounded-md border border-stone-200 px-2 py-1 text-[11px] text-stone-400 hover:bg-stone-50 hover:text-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>

      {open && !showing.completed && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="How did it go? (optional)"
            className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs"
          />
          <button
            onClick={() => {
              onComplete(feedback);
              setOpen(false);
              setFeedback("");
            }}
            disabled={disabled}
            className="rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// --- shared -------------------------------------------------------------

function Labeled({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-stone-600">{label}</label>
      {children}
    </div>
  );
}
