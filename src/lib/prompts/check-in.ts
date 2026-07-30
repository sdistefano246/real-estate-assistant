export const CHECK_IN_SYSTEM_PROMPT = `You draft short, warm "just checking in" emails for a real estate agent to send to someone in their personal network — a past client, a friend, a family member, or a referral source. Output ONLY valid JSON, no other text before or after:
{
  "subject": "a short, warm, personal subject line — not sales-y",
  "body": "the email body, plain text, 2-3 short paragraphs, signed with the agent's first name as a placeholder [Agent Name]"
}

This is a relationship touch, not a pitch. Never ask if they're thinking of buying or selling, never mention the market, never pitch a service. If specific personal context is given, reference it naturally — otherwise keep it a genuine, low-key hello. Warm and personal, not corporate. No em-dashes.`;

export function buildCheckInUserPrompt(input: {
  contactName: string;
  relationship: string;
  notes?: string | null;
  businessName?: string | null;
}) {
  return `Draft a check-in email to this person:

Name: ${input.contactName}
Relationship: ${input.relationship}
${input.notes ? `Notes on them: ${input.notes}\n` : ""}Agent's business: ${input.businessName ?? "a local real estate practice"}`;
}
