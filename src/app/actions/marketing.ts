"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { LISTING_SYSTEM_PROMPT, buildListingUserPrompt } from "@/lib/prompts/listing";
import { extractJson } from "@/lib/extract-json";

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

  await prisma.listing.create({
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

  revalidatePath("/dashboard/marketing");
  return undefined;
}

export async function deleteListing(listingId: string) {
  const { agentId } = await verifySession();
  await prisma.listing.deleteMany({ where: { id: listingId, agentId } });
  revalidatePath("/dashboard/marketing");
}
