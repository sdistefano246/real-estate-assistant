"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { addBuyer } from "@/app/actions/buyers";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from "@/lib/property-type";

export function AddBuyerForm() {
  const [state, formAction, pending] = useActionState(addBuyer, undefined);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-md bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Add a buyer
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200 bg-white p-6"
    >
      <div className="col-span-2">
        <h2 className="text-sm font-semibold text-teal-900">New buyer</h2>
        <p className="text-xs text-stone-500">
          Only the name is required — fill in whatever search criteria you know so far.
        </p>
      </div>

      <Field label="Name" required>
        <input name="name" required className={inputCls} />
      </Field>
      <Field label="Property type">
        <select name="propertyType" defaultValue="" className={inputCls}>
          <option value="">No preference</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROPERTY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Email">
        <input name="email" type="email" className={inputCls} />
      </Field>
      <Field label="Phone">
        <input name="phone" className={inputCls} />
      </Field>

      <Field label="Target locations">
        <input name="locations" placeholder="e.g. Oak Park, Riverside" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Min price">
          <input name="minPrice" inputMode="numeric" placeholder="$" className={inputCls} />
        </Field>
        <Field label="Max price">
          <input name="maxPrice" inputMode="numeric" placeholder="$" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Min beds">
          <input name="minBeds" inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="Min baths">
          <input name="minBaths" inputMode="decimal" className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Pre-approval $">
          <input name="preApprovalAmount" inputMode="numeric" placeholder="$" className={inputCls} />
        </Field>
        <label className="mt-6 flex items-center gap-2 text-sm text-stone-700">
          <input name="preApproved" type="checkbox" className="rounded border-stone-300" />
          Pre-approved
        </label>
      </div>

      <Field label="Must-haves" className="col-span-2">
        <input name="mustHaves" placeholder="e.g. garage, good schools, no HOA" className={inputCls} />
      </Field>
      <Field label="Notes" className="col-span-2">
        <textarea name="notes" rows={2} className={inputCls} />
      </Field>

      {state?.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}

      <div className="col-span-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add buyer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputCls = "mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm";

function Field({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
