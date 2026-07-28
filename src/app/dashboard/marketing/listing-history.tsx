"use client";

import { useTransition } from "react";
import { deleteListing } from "@/app/actions/marketing";

type ListingItem = {
  id: string;
  address: string;
  price: number;
  generatedDescription: string | null;
  socialPosts: string | null;
  createdAt: Date;
};

export function ListingHistory({ listings }: { listings: ListingItem[] }) {
  const [isPending, startTransition] = useTransition();

  if (listings.length === 0) {
    return <p className="text-sm text-slate-400">No listings generated yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {listings.map((listing) => {
        const posts: string[] = listing.socialPosts ? JSON.parse(listing.socialPosts) : [];
        return (
          <div key={listing.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{listing.address}</h3>
                <p className="text-xs text-slate-500">${listing.price.toLocaleString()}</p>
              </div>
              <button
                disabled={isPending}
                onClick={() => startTransition(() => deleteListing(listing.id))}
                className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </div>

            {listing.generatedDescription && (
              <CopyBlock label="Description" text={listing.generatedDescription} />
            )}

            {posts.map((post, i) => (
              <CopyBlock key={i} label={`Social post ${i + 1}`} text={post} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <button
          onClick={() => navigator.clipboard.writeText(text)}
          className="text-xs text-slate-400 hover:text-slate-900"
        >
          Copy
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{text}</p>
    </div>
  );
}
