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

// Multi-photo variant (2+ images): upload each photo unpublished (it gets an
// id but doesn't appear as its own post), then create the real post
// referencing all of them via attached_media. NOTE: this request shape came
// from practitioner sources, not Meta's current official Pages API docs
// (which no longer document attached_media directly) — unlike the rest of
// this file, it hasn't been confirmed against a real API response yet. If the
// /feed call below rejects the JSON array, the documented fallback is indexed
// form fields (attached_media[0]={"media_fbid":"..."}, attached_media[1]=...)
// instead of a JSON body.
export async function publishMultiPhotoToFacebook({
  imageUrls,
  caption,
}: {
  imageUrls: string[];
  caption: string;
}): Promise<string> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!accessToken || !pageId) {
    throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_PAGE_ID are not set");
  }

  const mediaIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const uploadRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl, published: false, access_token: accessToken }),
    });
    const uploadJson = (await uploadRes.json()) as GraphError & { id?: string };
    if (!uploadRes.ok || !uploadJson.id) {
      throw new Error(`Facebook unpublished photo upload failed: ${uploadJson.error?.message ?? uploadRes.statusText}`);
    }
    mediaIds.push(uploadJson.id);
  }

  const postRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: caption,
      attached_media: mediaIds.map((id) => ({ media_fbid: id })),
      access_token: accessToken,
    }),
  });
  const postJson = (await postRes.json()) as GraphError & { id?: string };
  if (!postRes.ok || !postJson.id) {
    throw new Error(`Facebook multi-photo post failed: ${postJson.error?.message ?? postRes.statusText}`);
  }

  return postJson.id;
}
