"use client";

import { useActionState, useRef, useEffect } from "react";
import { addContact } from "@/app/actions/contacts";
import { CONTACT_RELATIONSHIPS, CONTACT_RELATIONSHIP_LABELS } from "@/lib/contact-relationship";

export function AddContactForm() {
  const [state, formAction, pending] = useActionState(addContact, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-stone-700">Name</label>
        <input name="name" required className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Relationship</label>
        <select name="relationship" defaultValue="friend" className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
          {CONTACT_RELATIONSHIPS.map((relationship) => (
            <option key={relationship} value={relationship}>
              {CONTACT_RELATIONSHIP_LABELS[relationship]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Email</label>
        <input name="email" type="email" className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700">Phone</label>
        <input name="phone" className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
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
          {pending ? "Adding…" : "Add contact"}
        </button>
      </div>
    </form>
  );
}
