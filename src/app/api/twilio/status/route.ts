import twilio from "twilio";
import { NextRequest } from "next/server";
import { validateTwilioSignature, formDataToParams, getTwilioClient } from "@/lib/twilio.server";
import { prisma } from "@/lib/db.server";

const MISSED_CALL_TEXT =
  "Sorry we missed your call! We'll get back to you shortly — reply here anytime and we'll pick it up.";

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

  const agent = await prisma.agent.findFirst();

  let textSent = false;
  if (wasMissed && agent) {
    try {
      const client = getTwilioClient();
      await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: callerNumber,
        body: MISSED_CALL_TEXT,
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
        textBody: textSent ? MISSED_CALL_TEXT : null,
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
