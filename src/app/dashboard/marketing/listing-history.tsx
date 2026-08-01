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

            {posts.map((post, i) => {
              if (post.platform === "instagram" || post.platform === "facebook" || post.platform === "tiktok") {
                const photo = listing.photos[0];
                return (
                  <PlatformPost
                    key={i}
                    post={post}
                    photo={photo}
                    downloading={!!photo && downloadingId === photo.id}
                    onDownload={photo ? () => handleDownload(photo.id, photo.url) : undefined}
                  />
                );
              }

              return (
                <div key={i} className="mt-3 rounded-md bg-stone-50 p-3">
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-800">
                    {post.platform}
                  </span>
                  <CopyBlock label="Caption" text={post.caption} />
                  {post.hashtags.length > 0 && (
                    <CopyBlock label="Hashtags" text={post.hashtags.map((h) => `#${h}`).join(" ")} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Shared card for platforms with a single caption field (Instagram, Facebook,
// TikTok) — pairs the caption with the listing's photo (with its own download
// button, since none of these reliably accept a pasted image — see
// src/lib/download-photo.ts) and copies caption + hashtags as one paste-ready
// text block, since none of these platforms have separate caption/hashtag
// inputs. TikTok's "caption" is a multi-line on-camera script rather than a
// short blurb, but it renders fine here as-is via whitespace-pre-wrap.
const PLATFORM_LABELS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

function PlatformPost({
  post,
  photo,
  downloading,
  onDownload,
}: {
  post: SocialPost;
  photo?: PhotoItem;
  downloading?: boolean;
  onDownload?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const readyToPost =
    post.caption + (post.hashtags.length > 0 ? `\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}` : "");
  const platformLabel =
    PLATFORM_LABELS[post.platform] ?? post.platform.charAt(0).toUpperCase() + post.platform.slice(1);

  return (
    <div className="mt-3 flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
      {photo && (
        <div className="relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className="h-20 w-20 rounded-md border border-stone-200 object-cover"
          />
          <button
            type="button"
            disabled={downloading}
            onClick={onDownload}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-xs text-white hover:bg-teal-800 disabled:opacity-50"
            title="Download photo"
          >
            ⬇
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-800">
            {post.platform}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(readyToPost);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="whitespace-nowrap text-xs font-medium text-teal-800 hover:text-teal-900"
          >
            {copied ? "Copied ✓" : `Copy for ${platformLabel}`}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{post.caption}</p>
        {post.hashtags.length > 0 && (
          <p className="mt-1.5 text-xs text-stone-400">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
      </div>
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
