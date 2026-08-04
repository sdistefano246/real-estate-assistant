import "server-only";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

// Instagram Graph API (Content Publishing) — posts a photo + caption to a
// Business/Creator Instagram account. Needs a long-lived access token with
// content-publish permission and the account's IG user ID; see SETUP.md for
// how to get both. Three-call flow: create a media container, poll it until
// Instagram finishes processing, then publish it. Photos usually process in
// a couple seconds but aren't guaranteed instant — publishing before the
// container reports FINISHED fails with "Media ID is not available".

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const CONTAINER_POLL_INTERVAL_MS = 1500;
const CONTAINER_POLL_TIMEOUT_MS = 20000;

// Instagram's documented supported range for a single photo.
const MIN_ASPECT_RATIO = 4 / 5; // 0.8, tallest supported portrait
const MAX_ASPECT_RATIO = 1.91; // widest supported landscape

// Instagram silently letterboxes (doesn't reject) a photo outside its
// supported aspect ratio, and only supports JPEG — a real live test showed
// visible black bars on a photo this app posted unmodified. Fixes both by
// inspecting the image and, only if actually needed, center-cropping to the
// nearest valid ratio and/or re-encoding as JPEG, then re-uploading the
// result to get a new public URL. Returns the original URL unchanged when the
// photo's already fine, to avoid pointless reprocessing. Never throws — a
// failure here just means Instagram gets the original, possibly-imperfect
// photo, which beats breaking auto-post entirely over a cosmetic fix.
async function normalizeImageForInstagram(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return imageUrl;
    const buffer = Buffer.from(await res.arrayBuffer());

    const image = sharp(buffer);
    const { format, width, height } = await image.metadata();
    if (!width || !height) return imageUrl;

    const ratio = width / height;
    const needsCrop = ratio < MIN_ASPECT_RATIO || ratio > MAX_ASPECT_RATIO;
    const needsReencode = format !== "jpeg";
    if (!needsCrop && !needsReencode) return imageUrl;

    let pipeline = image;
    if (needsCrop) {
      const targetRatio = ratio < MIN_ASPECT_RATIO ? MIN_ASPECT_RATIO : MAX_ASPECT_RATIO;
      // Center-crop toward the nearest valid boundary ratio.
      const cropWidth = ratio < MIN_ASPECT_RATIO ? width : Math.round(height * targetRatio);
      const cropHeight = ratio < MIN_ASPECT_RATIO ? Math.round(width / targetRatio) : height;
      pipeline = pipeline.extract({
        left: Math.max(0, Math.round((width - cropWidth) / 2)),
        top: Math.max(0, Math.round((height - cropHeight) / 2)),
        width: Math.min(cropWidth, width),
        height: Math.min(cropHeight, height),
      });
    }
    const processed = await pipeline.jpeg({ quality: 90 }).toBuffer();

    const blob = await put(`instagram-normalized/${randomUUID()}.jpg`, processed, {
      access: "public",
      contentType: "image/jpeg",
    });
    return blob.url;
  } catch {
    return imageUrl;
  }
}

export function isInstagramConfigured() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
}

type GraphError = { error?: { message?: string; type?: string; code?: number } };

async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + CONTAINER_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const statusRes = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusJson = (await statusRes.json()) as GraphError & { status_code?: string };
    if (statusJson.status_code === "FINISHED") return;
    if (statusJson.status_code === "ERROR") {
      throw new Error(`Instagram media processing failed: ${statusJson.error?.message ?? "unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
  }
  throw new Error("Instagram media took too long to process");
}

export async function publishToInstagram({
  imageUrl,
  caption,
}: {
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID are not set");
  }

  const normalizedUrl = await normalizeImageForInstagram(imageUrl);

  const containerRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: normalizedUrl, caption, access_token: accessToken }),
  });
  const containerJson = (await containerRes.json()) as GraphError & { id?: string };
  if (!containerRes.ok || !containerJson.id) {
    throw new Error(`Instagram container creation failed: ${containerJson.error?.message ?? containerRes.statusText}`);
  }

  await waitForContainerReady(containerJson.id, accessToken);

  const publishRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerJson.id, access_token: accessToken }),
  });
  const publishJson = (await publishRes.json()) as GraphError & { id?: string };
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(`Instagram publish failed: ${publishJson.error?.message ?? publishRes.statusText}`);
  }

  return publishJson.id;
}

// Multi-photo variant (2-10 images) — a real carousel post, not repeated
// single posts. Each image becomes its own "child" container (is_carousel_item,
// no caption of its own), each polled to FINISHED same as a single-image post,
// then a parent CAROUSEL container references all of them by a comma-separated
// id string (not a JSON array — that's what the Graph API actually expects
// here) and carries the caption. Instagram itself crops later carousel images
// to match the first one's aspect ratio; this app only controls getting each
// individual image into a valid ratio to begin with (see normalizeImageForInstagram).
export async function publishCarouselToInstagram({
  imageUrls,
  caption,
}: {
  imageUrls: string[];
  caption: string;
}): Promise<string> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !igUserId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID are not set");
  }

  const normalizedUrls = await Promise.all(imageUrls.map(normalizeImageForInstagram));

  // Each child container is independent until the final CAROUSEL container
  // references them all, so create + poll them concurrently rather than one
  // at a time. Sequential was the real cause of a silent production timeout
  // with 10 photos: create-then-poll-until-ready (up to 20s) per image, times
  // 10, could take up to ~200s serially — comfortably past this route's
  // serverless time limit, killing the request before it could even record
  // an error. Concurrent is bounded by the single slowest image instead.
  const childIds = await Promise.all(
    normalizedUrls.map(async (imageUrl) => {
      const childRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token: accessToken }),
      });
      const childJson = (await childRes.json()) as GraphError & { id?: string };
      if (!childRes.ok || !childJson.id) {
        throw new Error(`Instagram carousel child creation failed: ${childJson.error?.message ?? childRes.statusText}`);
      }
      await waitForContainerReady(childJson.id, accessToken);
      return childJson.id;
    })
  );

  const parentRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: accessToken,
    }),
  });
  const parentJson = (await parentRes.json()) as GraphError & { id?: string };
  if (!parentRes.ok || !parentJson.id) {
    throw new Error(`Instagram carousel container creation failed: ${parentJson.error?.message ?? parentRes.statusText}`);
  }

  await waitForContainerReady(parentJson.id, accessToken);

  const publishRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: parentJson.id, access_token: accessToken }),
  });
  const publishJson = (await publishRes.json()) as GraphError & { id?: string };
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(`Instagram carousel publish failed: ${publishJson.error?.message ?? publishRes.statusText}`);
  }

  return publishJson.id;
}
