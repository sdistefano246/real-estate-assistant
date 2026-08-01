import "server-only";

// Instagram Graph API (Content Publishing) — posts a photo + caption to a
// Business/Creator Instagram account. Needs a long-lived access token with
// content-publish permission and the account's IG user ID; see SETUP.md for
// how to get both. Two-call flow: create a media container, then publish it.
// Images process near-instantly (unlike video, which needs status polling),
// so this publishes right after creating the container.

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isInstagramConfigured() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
}

type GraphError = { error?: { message?: string; type?: string; code?: number } };

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
