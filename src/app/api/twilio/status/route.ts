import twilio from "twilio";
import { NextRequest } from "next/server";
import { validateTwilioSignature, formDataToParams, getTwilioClient } from "@/lib/twilio.server";
import { prisma } from "@/lib/db.server";

const DEFAULT_MISSED_CALL_TEXT =
  "Sorry we missed your call! We'll get back to you shortly, reply here anytime and we'll pick it up.";

// Personalizes with the agent's assistant persona when one is set (e.g.
// "Nora") — honestly names who's handling it and gives a same-day promise,
// rather than a generic autoresponder line. Falls back to the original
// generic text for any agent who hasn't set a persona name.
function buildMissedCallText(agent: { assistantName: string | null; name: string }): string {
  if (!agent.assistantName) return DEFAULT_MISSED_CALL_TEXT;
  const agentFirstName = agent.name.split(" ")[0];
  return `Hey, it's ${agent.assistantName}, ${agentFirstName}'s assistant! Sorry we missed you. ${agentFirstName}'s with a client right now, reply here and I'll flag it for a callback today.`;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = await formDataToParams(formData);

  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(signature, request.url, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const callerNumber = params.From ?? "unknown";
  const dialStatus = params.DialCallStatus ?? "unknown";
  const wasMissed = dialStatus !== "completed";

  const agent = await prisma.agent.findFirst({ orderBy: { createdAt: "asc" } });

  const missedCallText = agent ? buildMissedCallText(agent) : DEFAULT_MISSED_CALL_TEXT;

  let textSent = false;
  if (wasMissed && agent) {
    try {
      const client = getTwilioClient();
      await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: callerNumber,
        body: missedCallText,
      });
      textSent = true;
    } catch (error) {
      console.error("Failed to send missed-call text:", error);
    }
  }

  if (agent) {
    await prisma.callLog.create({
      data: {
        agentId: agent.id,
        callerNumber,
        missed: wasMissed,
        textSent,
        textBody: textSent ? missedCallText : null,
      },
    });
  }

  const response = new twilio.twiml.VoiceResponse();
  response.hangup();

  return new Response(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
