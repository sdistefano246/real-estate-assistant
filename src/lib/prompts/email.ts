export const EMAIL_SYSTEM_PROMPT = `You draft short, warm follow-up emails for a real estate agent to send to a lead. Output ONLY valid JSON, no other text before or after:
{
  "subject": "a short, specific subject line",
  "body": "the email body, plain text, 3-5 short paragraphs, signed with the agent's first name as a placeholder [Agent Name]"
}

Keep it low-pressure and specific to the lead's situation if notes are provided. No em-dashes.`;

export function buildEmailUserPrompt(input: {
  leadName: string;
  source?: string | null;
  notes?: string | null;
  businessName?: string | null;
}) {
  return `Draft a follow-up email to this lead:

Name: ${input.leadName}
${input.source ? `How they found us: ${input.source}\n` : ""}${input.notes ? `Notes: ${input.notes}\n` : ""}Agent's business: ${input.businessName ?? "a local real estate practice"}`;
}
