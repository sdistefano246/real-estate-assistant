"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

type UploadedPhoto = { url: string; name: string };

export function PhotoUpload({ configured }: { configured: boolean }) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded: UploadedPhoto[] = [];
      for (const file of Array.from(files)) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/listings/upload",
        });
        uploaded.push({ url: blob.url, name: file.name });
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
  }

  if (!configured) {
    return (
      <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Add a Vercel Blob store (see <code className="font-mono">SETUP.md</code>) to enable photo
        uploads.
      </div>
    );
  }

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-stone-700">Photos</label>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={uploading}
        onChange={(e) => handleFiles(e.target.files)}
        className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-50 disabled:opacity-50"
      />
      {uploading && <p className="mt-1 text-xs text-stone-400">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div key={photo.url} className="relative">
              <input type="hidden" name="photoUrls" value={photo.url} />
              {/* Real photos live on Vercel Blob, not this app's domain — plain
                  img avoids needing next/image remotePatterns config for a URL
                  we don't know ahead of time. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.name}
                className="h-20 w-20 rounded-md border border-stone-200 object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(photo.url)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-xs text-white hover:bg-red-600"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
