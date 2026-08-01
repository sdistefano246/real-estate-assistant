"use client";

import { useActionState, useRef, useEffect } from "react";
import { addLead } from "@/app/actions/leads";

export function LeadForm() {
  const [state, formAction, pending] = useActionState(addLead, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <div>
        <label className="block text-sm font-medium text-stone-700">Name</label>
        <input name="name" required className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Email</label>
        <input name="email" type="email" className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Phone</label>
        <input name="phone" className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Source</label>
        <input name="source" placeholder="Zillow, referral, open house…" className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-stone-700">Notes</label>
        <textarea name="notes" rows={2} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>

      {state?.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add lead"}
        </button>
      </div>
    </form>
  );
}
