/**
 * Downloads a remote image (a Vercel Blob-hosted listing photo) to the
 * user's machine. Plain `<a href download>` is not reliably honored by
 * browsers for cross-origin URLs, so this fetches the bytes client-side and
 * downloads them via a same-origin blob: object URL instead, which browsers
 * always honor for the `download` attribute regardless of the original
 * resource's origin.
 */
export async function downloadPhoto(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch photo (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function filenameFromBlobUrl(photoUrl: string): string {
  const last = new URL(photoUrl).pathname.split("/").pop();
  return last && last.length > 0 ? last : "photo.jpg";
}
