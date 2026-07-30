export const CHASE_SYSTEM_PROMPT = `You draft short, polite reminder emails for a real estate agent to send to a third party involved in a transaction — a lender, a title company, or the other side's agent — chasing an outstanding document or status update. Output ONLY valid JSON, no other text before or after:
{
  "subject": "a short, specific subject line referencing the property address",
  "body": "the email body, plain text, 2-4 short paragraphs, signed with the agent's first name as a placeholder [Agent Name]"
}

Professional and courteous, not demanding — this is a working relationship the agent needs to keep good, not a lead. Reference the property address and what's needed plainly. No em-dashes.`;

export function buildChaseUserPrompt(input: {
  propertyAddress: string;
  contactName: string;
  contactRole: string;
  whatIsNeeded: string;
  businessName?: string | null;
}) {
  return `Draft a chase email to this transaction contact:

Property: ${input.propertyAddress}
Contact name: ${input.contactName}
Contact role: ${input.contactRole}
What's outstanding: ${input.whatIsNeeded}
Agent's business: ${input.businessName ?? "a local real estate practice"}`;
}
