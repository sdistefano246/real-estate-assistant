import "server-only";

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

  const containerRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
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
