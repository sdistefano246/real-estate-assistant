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

  if (!isAnthropicConfigured()) {
    return { error: "Add ANTHROPIC_API_KEY to .env to enable listing generation." };
  }

  const address = String(formData.get("address") ?? "").trim();
  const beds = Number(formData.get("beds"));
  const baths = Number(formData.get("baths"));
  const sqft = Number(formData.get("sqft"));
  const price = Number(formData.get("price"));
  const features = String(formData.get("features") ?? "").trim();

  if (!address || !beds || !baths || !sqft || !price) {
    return { error: "Fill in address, beds, baths, sqft, and price." };
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

  type SocialPost = { platform: string; caption: string; hashtags: string[] };
  let parsed: { description: string; socialPosts: SocialPost[] };
  try {
    parsed = extractJson(textBlock.text);
  } catch {
    return { error: "Generation returned an unexpected format. Try again." };
  }

  const photoUrls = formData.getAll("photoUrls").map(String).filter(Boolean);

  const listing = await prisma.listing.create({
    data: {
      agentId,
      address,
      beds,
      baths,
      sqft,
      price,
      features,
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

  revalidatePath("/dashboard/marketing");
  return undefined;
}

// Best-effort — a failure here (not configured, no photo, no IG post, a real
// API error) never fails listing generation itself. The listing is already
// saved by the time this runs; the outcome just gets recorded on it.
async function maybeAutoPostToInstagram(
  agentId: string,
  listingId: string,
  socialPosts: { platform: string; caption: string; hashtags: string[] }[],
  photoUrls: string[]
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { autoPostInstagramEnabled: true } });
  if (!agent?.autoPostInstagramEnabled || !isInstagramConfigured()) return;

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
// generation itself.
async function maybeAutoPostToFacebook(
  agentId: string,
  listingId: string,
  socialPosts: { platform: string; caption: string; hashtags: string[] }[],
  photoUrls: string[]
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { autoPostFacebookEnabled: true } });
  if (!agent?.autoPostFacebookEnabled || !isFacebookConfigured()) return;

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
// go through" from the listing's point of view.
async function maybeAutoPostToTiktok(
  agentId: string,
  listingId: string,
  socialPosts: { platform: string; caption: string; hashtags: string[] }[],
  photoUrls: string[]
) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { autoPostTiktokEnabled: true, tiktokOpenId: true },
  });
  if (!agent?.autoPostTiktokEnabled || !isTiktokConnected(agent)) return;

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
