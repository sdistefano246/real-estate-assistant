import "server-only";

// Facebook Page photo posts (Graph API). Needs a Page Access Token
// (pages_manage_posts + pages_read_engagement) and the Page's ID — not the
// same credentials as instagram.server.ts, which uses an Instagram-Login
// user token. Single-call: posting a photo with a caption directly publishes
// it, no container/poll step like Instagram's content-publishing flow needs.

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isFacebookConfigured() {
  return Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID);
}

type GraphError = { error?: { message?: string; type?: string; code?: number } };

export async function publishToFacebook({
  imageUrl,
  caption,
}: {
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!accessToken || !pageId) {
    throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_PAGE_ID are not set");
  }

  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl, caption, access_token: accessToken }),
  });
  const json = (await res.json()) as GraphError & { id?: string; post_id?: string };
  if (!res.ok || !json.id) {
    throw new Error(`Facebook publish failed: ${json.error?.message ?? res.statusText}`);
  }

  return json.post_id ?? json.id;
}
