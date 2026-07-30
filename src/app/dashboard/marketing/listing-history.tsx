"use client";

import { useState, useTransition } from "react";
import { deleteListing } from "@/app/actions/marketing";
import { downloadPhoto, filenameFromBlobUrl } from "@/lib/download-photo";

type SocialPost = { platform: string; caption: string; hashtags: string[] };
type PhotoItem = { id: string; url: string };

type ListingItem = {
  id: string;
  address: string;
  price: number;
  generatedDescription: string | null;
  socialPosts: string | null;
  createdAt: Date;
  photos: PhotoItem[];
};

function parseSocialPosts(raw: string | null): SocialPost[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Back-compat: listings generated before this update stored posts as
    // plain strings, not { platform, caption, hashtags } objects.
    return parsed.map((post: unknown) =>
      typeof post === "string" ? { platform: "post", caption: post, hashtags: [] } : (post as SocialPost)
    );
  } catch {
    return [];
  }
}

export function ListingHistory({ listings }: { listings: ListingItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(photoId: string, photoUrl: string) {
    setDownloadingId(photoId);
    try {
      await downloadPhoto(photoUrl, filenameFromBlobUrl(photoUrl));
    } catch (e) {
      console.error("Photo download failed:", e);
    } finally {
      setDownloadingId(null);
    }
  }

  if (listings.length === 0) {
    return <p className="text-sm text-stone-400">No listings generated yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {listings.map((listing) => {
        const posts = parseSocialPosts(listing.socialPosts);

        return (
          <div key={listing.id} className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-teal-900">{listing.address}</h3>
                <p className="text-xs text-stone-500">${listing.price.toLocaleString()}</p>
              </div>
              <button
                disabled={isPending}
                onClick={() => startTransition(() => deleteListing(listing.id))}
                className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </div>

            {listing.photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {listing.photos.map((photo) => (
                  <div key={photo.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={listing.address}
                      className="h-20 w-20 rounded-md border border-stone-200 object-cover"
                    />
                    <button
                      type="button"
                      disabled={downloadingId === photo.id}
                      onClick={() => handleDownload(photo.id, photo.url)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-xs text-white hover:bg-teal-800 disabled:opacity-50"
                      title="Download"
                    >
                      ⬇
                    </button>
                  </div>
                ))}
              </div>
            )}

            {listing.generatedDescription && (
              <CopyBlock label="Description" text={listing.generatedDescription} />
            )}

            {posts.map((post, i) => (
              <div key={i} className="mt-3 rounded-md bg-stone-50 p-3">
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-800">
                  {post.platform}
                </span>
                <CopyBlock label="Caption" text={post.caption} />
                {post.hashtags.length > 0 && (
                  <CopyBlock label="Hashtags" text={post.hashtags.map((h) => `#${h}`).join(" ")} />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
        <button
          onClick={() => navigator.clipboard.writeText(text)}
          className="text-xs text-stone-400 hover:text-teal-900"
        >
          Copy
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{text}</p>
    </div>
  );
}
