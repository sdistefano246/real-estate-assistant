import twilio from "twilio";
import { NextRequest } from "next/server";
import { validateTwilioSignature, formDataToParams } from "@/lib/twilio.server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = await formDataToParams(formData);

  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(signature, request.url, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const forwardingPhone = process.env.AGENT_FORWARDING_PHONE;
  const statusCallbackUrl = new URL("/api/twilio/status", request.url).toString();

  const response = new twilio.twiml.VoiceResponse();

  if (!forwardingPhone) {
    response.say("This number is not yet configured. Goodbye.");
  } else {
    const dial = response.dial({
      timeout: 20,
      action: statusCallbackUrl,
    });
    dial.number(forwardingPhone);
  }

  return new Response(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
