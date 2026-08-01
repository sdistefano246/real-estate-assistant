"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { LISTING_SYSTEM_PROMPT, buildListingUserPrompt } from "@/lib/prompts/listing";
import { extractJson } from "@/lib/extract-json";
import { isInstagramConfigured, publishToInstagram } from "@/lib/instagram.server";

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

  await maybeAutoPostToInstagram(agentId, listing.id, parsed.socialPosts, photoUrls[0]);

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
  firstPhotoUrl: string | undefined
) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { autoPostInstagramEnabled: true } });
  if (!agent?.autoPostInstagramEnabled || !isInstagramConfigured()) return;

  const igPost = socialPosts.find((p) => p.platform === "instagram");
  if (!igPost) return;

  if (!firstPhotoUrl) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { instagramPostError: "No photo uploaded — Instagram requires an image." },
    });
    return;
  }

  const caption =
    igPost.caption + (igPost.hashtags.length > 0 ? `\n\n${igPost.hashtags.map((h) => `#${h}`).join(" ")}` : "");

  try {
    const mediaId = await publishToInstagram({ imageUrl: firstPhotoUrl, caption });
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

export async function deleteListing(listingId: string) {
  const { agentId } = await verifySession();
  await prisma.listing.deleteMany({ where: { id: listingId, agentId } });
  revalidatePath("/dashboard/marketing");
}
