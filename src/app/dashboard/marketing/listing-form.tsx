"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { generateListing } from "@/app/actions/marketing";
import { PhotoUpload } from "./photo-upload";

export function ListingForm({ configured, blobConfigured }: { configured: boolean; blobConfigured: boolean }) {
  const [state, formAction, pending] = useActionState(generateListing, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [photoUploadKey, setPhotoUploadKey] = useState(0);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
      // PhotoUpload keeps its uploaded photos in its own React state, which a
      // native form.reset() doesn't touch — remount it so a fresh listing
      // draft doesn't start with the last one's photos still attached.
      setPhotoUploadKey((k) => k + 1);
    }
  }, [pending, state]);

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Add <code className="font-mono">ANTHROPIC_API_KEY</code> to <code className="font-mono">.env</code> to
        enable listing and social content generation.
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <div className="col-span-2">
        <label className="block text-sm font-medium text-stone-700">Address</label>
        <input
          name="address"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          placeholder="123 Main St, Springfield"
        />
      </div>
      <Field name="beds" label="Beds" type="number" />
      <Field name="baths" label="Baths" type="number" step="0.5" />
      <Field name="sqft" label="Square feet" type="number" />
      <Field name="price" label="Price ($)" type="number" />
      <div className="col-span-2">
        <label className="block text-sm font-medium text-stone-700">Notable features</label>
        <textarea
          name="features"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          placeholder="Updated kitchen, fenced backyard, two-car garage, near Riverside Park"
        />
      </div>

      <PhotoUpload key={photoUploadKey} configured={blobConfigured} />

      {state?.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate listing + social posts"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type,
  step,
}: {
  name: string;
  label: string;
  type: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700">{label}</label>
      <input
        name={name}
        type={type}
        step={step}
        required
        className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
