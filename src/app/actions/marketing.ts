"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { LISTING_SYSTEM_PROMPT, buildListingUserPrompt } from "@/lib/prompts/listing";
import { extractJson } from "@/lib/extract-json";
import { isInstagramConfigured, publishToInstagram, publishCarouselToInstagram } from "@/lib/instagram.server";
import { isFacebookConfigured, publishToFacebook, publishMultiPhotoToFacebook } from "@/lib/facebook.server";
import {
  isTiktokConnected,
  ensureFreshAccessToken,
  getBestPrivacyLevel,
  publishToTiktok,
} from "@/lib/tiktok.server";

export type GenerateListingState = { error?: string } | undefined;

export async function generateListing(
  _prevState: GenerateListingState,
  formData: FormData
): Promise<GenerateListingState> {
  const { agentId } = await verifySession();

  const address = String(formData.get("address") ?? "").trim();
  const beds = Number(formData.get("beds"));
  const baths = Number(formData.get("baths"));
  const sqft = Number(formData.get("sqft"));
  const price = Number(formData.get("price"));
  const features = String(formData.get("features") ?? "").trim();

  if (!address || !beds || !baths || !sqft || !price) {
    return { error: "Fill in address, beds, baths, sqft, and price." };
  }

  const photoUrls = formData.getAll("photoUrls").map(String).filter(Boolean);

  const result = await createListingAndAutoPost({ agentId, address, beds, baths, sqft, price, features, photoUrls });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/marketing");
  return undefined;
}

type SocialPost = { platform: string; caption: string; hashtags: string[] };

// The shared core of listing creation — real Claude generation, the DB row,
// and the three best-effort auto-post attempts. Used by generateListing()
// above (the manual form) and by the listing-sync cron job
// (src/lib/listing-sync.server.ts) for automated onboarding — same logic,
// same auto-post behavior, no duplication between the two paths.
export async function createListingAndAutoPost(input: {
  agentId: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  price: number;
  features: string;
  photoUrls: string[];
  sourceUrl?: string;
}): Promise<{ listingId: string } | { error: string }> {
  const { agentId, address, beds, baths, sqft, price, features, photoUrls, sourceUrl } = input;

  if (!isAnthropicConfigured()) {
    return { error: "Add ANTHROPIC_API_KEY to .env to enable listing generation." };
  }

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: LISTING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildListingUserPrompt({ address, beds, baths, sqft, price, features }) }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { error: "Generation failed — no text returned. Try again." };
  }

  let parsed: { description: string; socialPosts: SocialPost[] };
  try {
    parsed = extractJson(textBlock.text);
  } catch (error) {
    // Full raw text only to server logs (Vercel function logs) — it's a real
    // listing description, not something to put in a widely-visible error
    // string. The parse error's own message (e.g. position/token) travels
    // with the returned error itself, since for the listing-sync path that's
    // the only place it's actually visible (see listing-sync.server.ts's
    // result.errors, surfaced all the way to /api/cron's response) — a
    // generic "try again" here left the 2026-08-08 recurrence of this
    // failure on Morley Avenue completely undiagnosable both times.
    console.error("Listing generation returned unparseable JSON. Raw text:", textBlock.text);
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `Generation returned an unexpected format (${detail}). Try again.` };
  }

  const listing = await prisma.listing.create({
    data: {
      agentId,
      address,
      beds,
      baths,
      sqft,
      price,
      features,
      sourceUrl,
      generatedDescription: parsed.description,
      socialPosts: JSON.stringify(parsed.socialPosts),
      photos: {
        create: photoUrls.map((url, index) => ({ url, order: index })),
      },
    },
  });

  await maybeAutoPostToInstagram(agentId, listing.id, parsed.socialPosts, photoUrls);
  await maybeAutoPostToFacebook(agentId, listing.id, parsed.socialPosts, photoUrls);
  await maybeAutoPostToTiktok(agentId, listing.id, parsed.socialPosts, photoUrls);

  return { listingId: listing.id };
}

// Best-effort — a failure here (not configured, no photo, no IG post, a real
// API error) never fails listing generation itself. The listing is already
// saved by the time this runs; the outcome just gets recorded on it.
//
// `force` skips the agent's auto-post toggle (but never the platform-configured
// check — no toggle can substitute for missing credentials) — used by
// retryAutoPost() below, since a deliberate manual retry click shouldn't be
// silently swallowed by a setting that only governs automatic posting.
async function maybeAutoPostToInstagram(
  agentId: string,
  listingId: string,
  socialPosts: { platform: string; caption: string; hashtags: string[] }[],
  photoUrls: string[],
  options: { force?: boolean } = {}
) {
  if (!isInstagramConfigured()) return;
  if (!options.force) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { autoPostInstagramEnabled: true } });
    if (!agent?.autoPostInstagramEnabled) return;
  }

  const igPost = socialPosts.find((p) => p.platform === "instagram");
  if (!igPost) return;

  if (photoUrls.length === 0) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { instagramPostError: "No photo uploaded — Instagram requires an image." },
    });
    return;
  }

  const caption =
    igPost.caption + (igPost.hashtags.length > 0 ? `\n\n${igPost.hashtags.map((h) => `#${h}`).join(" ")}` : "");

  // Instagram's carousel cap is 10 images per post.
  const igPhotoUrls = photoUrls.slice(0, 10);

  try {
    const mediaId =
      igPhotoUrls.length === 1
        ? await publishToInstagram({ imageUrl: igPhotoUrls[0], caption })
        : await publishCarouselToInstagram({ imageUrls: igPhotoUrls, caption });
    await prisma.listing.update({
      where: { id: listingId },
      data: { instagramPostId: mediaId, instagramPostedAt: new Date(), instagramPostError: null },
    });
  } catch (error) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { instagramPostError: error instanceof Error ? error.message : "Auto-post failed." },
    });
  }
}

// Same best-effort shape as maybeAutoPostToInstagram — never fails listing
// generation itself. See its comment above for what `force` does.
async function maybeAutoPostToFacebook(
  agentId: string,
  listingId: string,
  socialPosts: { platform: string; caption: string; hashtags: string[] }[],
  photoUrls: string[],
  options: { force?: boolean } = {}
) {
  if (!isFacebookConfigured()) return;
  if (!options.force) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { autoPostFacebookEnabled: true } });
    if (!agent?.autoPostFacebookEnabled) return;
  }

  const fbPost = socialPosts.find((p) => p.platform === "facebook");
  if (!fbPost) return;

  if (photoUrls.length === 0) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { facebookPostError: "No photo uploaded — Facebook photo posts require an image." },
    });
    return;
  }

  const caption =
    fbPost.caption + (fbPost.hashtags.length > 0 ? `\n\n${fbPost.hashtags.map((h) => `#${h}`).join(" ")}` : "");

  // No documented hard cap for attached_media — matching Instagram's carousel
  // cap of 10 as a sane bound rather than sending an unbounded request.
  const fbPhotoUrls = photoUrls.slice(0, 10);

  try {
    const postId =
      fbPhotoUrls.length === 1
        ? await publishToFacebook({ imageUrl: fbPhotoUrls[0], caption })
        : await publishMultiPhotoToFacebook({ imageUrls: fbPhotoUrls, caption });
    await prisma.listing.update({
      where: { id: listingId },
      data: { facebookPostId: postId, facebookPostedAt: new Date(), facebookPostError: null },
    });
  } catch (error) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { facebookPostError: error instanceof Error ? error.message : "Auto-post failed." },
    });
  }
}

// Same best-effort shape as maybeAutoPostToInstagram/Facebook, but with two
// extra steps unique to TikTok: a token refresh (access tokens expire every
// 24h) and a creator_info lookup TikTok requires immediately before every
// post (to learn which privacy levels — e.g. SELF_ONLY pre-audit — are
// currently allowed). Both wrapped in the same catch as the publish call
// itself, since a failure at any of these steps is equally "auto-post didn't
// go through" from the listing's point of view. See maybeAutoPostToInstagram's
// comment above for what `force` does — `isTiktokConnected` is checked either
// way, since force can bypass the toggle but never a missing OAuth connection.
async function maybeAutoPostToTiktok(
  agentId: string,
  listingId: string,
  socialPosts: { platform: string; caption: string; hashtags: string[] }[],
  photoUrls: string[],
  options: { force?: boolean } = {}
) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { autoPostTiktokEnabled: true, tiktokOpenId: true },
  });
  if (!agent || !isTiktokConnected(agent)) return;
  if (!options.force && !agent.autoPostTiktokEnabled) return;

  const tiktokPost = socialPosts.find((p) => p.platform === "tiktok");
  if (!tiktokPost) return;

  if (photoUrls.length === 0) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { tiktokPostError: "No photo uploaded — TikTok requires at least one image." },
    });
    return;
  }

  const description =
    tiktokPost.caption +
    (tiktokPost.hashtags.length > 0 ? `\n\n${tiktokPost.hashtags.map((h) => `#${h}`).join(" ")}` : "");

  try {
    const accessToken = await ensureFreshAccessToken(agentId);
    const privacyLevel = await getBestPrivacyLevel(accessToken);
    const publishId = await publishToTiktok({
      accessToken,
      // TikTok's own documented photo_images cap, already enforced inside
      // publishToTiktok too — sliced here as well for clarity at the call site.
      photoUrls: photoUrls.slice(0, 35),
      title: tiktokPost.caption,
      description,
      privacyLevel,
    });
    await prisma.listing.update({
      where: { id: listingId },
      data: { tiktokPostId: publishId, tiktokPostedAt: new Date(), tiktokPostError: null },
    });
  } catch (error) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { tiktokPostError: error instanceof Error ? error.message : "Auto-post failed." },
    });
  }
}

export async function deleteListing(listingId: string) {
  const { agentId } = await verifySession();
  await prisma.listing.deleteMany({ where: { id: listingId, agentId } });
  revalidatePath("/dashboard/marketing");
}

// Re-attempts a single platform's auto-post for a listing that already has
// its Claude-generated description/social copy — no regeneration, just
// replays the same publish step with `force: true` (see maybeAutoPostTo*
// above) so a stale toggle setting can't silently no-op a deliberate retry.
// Ownership-scoped the same way deleteListing is, since this is reachable
// directly from a client component.
export async function retryAutoPost(listingId: string, platform: "instagram" | "facebook" | "tiktok") {
  const { agentId } = await verifySession();
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, agentId },
    include: { photos: { orderBy: { order: "asc" } } },
  });
  if (!listing) return;

  const socialPosts: SocialPost[] = listing.socialPosts ? JSON.parse(listing.socialPosts) : [];
  const photoUrls = listing.photos.map((p) => p.url);

  if (platform === "instagram") {
    await maybeAutoPostToInstagram(agentId, listing.id, socialPosts, photoUrls, { force: true });
  } else if (platform === "facebook") {
    await maybeAutoPostToFacebook(agentId, listing.id, socialPosts, photoUrls, { force: true });
  } else {
    await maybeAutoPostToTiktok(agentId, listing.id, socialPosts, photoUrls, { force: true });
  }

  revalidatePath("/dashboard/marketing");
}
