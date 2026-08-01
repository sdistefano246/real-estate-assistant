import "server-only";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { extractJson } from "@/lib/extract-json";
import { CHECK_IN_SYSTEM_PROMPT, buildCheckInUserPrompt } from "@/lib/prompts/check-in";

type CheckInContact = {
  name: string;
  relationship: string;
  notes: string | null;
};

type CheckInAgent = {
  businessName: string | null;
};

/**
 * Drafts a warm "just checking in" email for a sphere contact. Shared by the
 * manual draftCheckIn server action (agent clicks a button) and the automated
 * nurture job (Phase 5 cron) so both produce identical output from one prompt —
 * neither owns a private copy of the generation logic.
 */
export async function generateCheckIn(
  contact: CheckInContact,
  agent: CheckInAgent
): Promise<{ subject: string; body: string }> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system: CHECK_IN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildCheckInUserPrompt({
          contactName: contact.name,
          relationship: contact.relationship,
          notes: contact.notes,
          businessName: agent.businessName,
        }),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Generation failed — no text returned");
  }

  return extractJson<{ subject: string; body: string }>(textBlock.text);
}
