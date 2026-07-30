import { NextRequest, after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db.server";
import { isLeadWebhookConfigured, getLeadWebhookSecret, secretsMatch } from "@/lib/lead-webhook.server";
import { sendInstantAck } from "@/lib/instant-ack.server";

const THANK_YOU_HTML = `<!doctype html>
<html>
  <body style="font-family: sans-serif; max-width: 32rem; margin: 4rem auto; text-align: center; color: #1c1917;">
    <h1 style="font-size: 1.25rem;">Thanks for reaching out!</h1>
    <p>We got your message and will follow up shortly.</p>
  </body>
</html>`;

// This app is single-tenant per deployment (one agent per install, per SETUP.md) —
// there is no way for an external form submission to identify "which agent" beyond
// that, so inbound leads always attach to the first-created Agent row. If this ever
// becomes multi-tenant, this endpoint needs a per-agent token instead of one shared secret.
async function getSoleAgent() {
  return prisma.agent.findFirst({ orderBy: { createdAt: "asc" } });
}

function redirectOrThankYou(formData: FormData) {
  const redirectTo = String(formData.get("redirect_to") ?? "").trim();
  if (redirectTo.startsWith("https://") || redirectTo.startsWith("http://")) {
    return Response.redirect(redirectTo, 303);
  }
  return new Response(THANK_YOU_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function POST(request: NextRequest) {
  if (!isLeadWebhookConfigured()) {
    return new Response("This form is not yet configured.", { status: 503 });
  }

  const providedKey = request.nextUrl.searchParams.get("key") ?? "";
  if (!secretsMatch(providedKey, getLeadWebhookSecret())) {
    return new Response("Invalid or missing key.", { status: 403 });
  }

  const formData = await request.formData();

  // Honeypot: a hidden field real visitors never see or fill in. A bot that fills
  // every field trips this — report success (so it doesn't learn to skip the field)
  // but don't actually create a lead from it.
  if (String(formData.get("company") ?? "").trim()) {
    return redirectOrThankYou(formData);
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return new Response("Name is required.", { status: 400 });
  }

  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("message") ?? formData.get("notes") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || "website-form";

  const agent = await getSoleAgent();
  if (!agent) {
    return new Response("No agent account exists yet.", { status: 500 });
  }

  const lead = await prisma.lead.create({
    data: { agentId: agent.id, name, email, phone, source, notes },
  });

  revalidatePath("/dashboard/leads");

  // Instant ack (Claude + possibly Resend/Twilio) can take a few seconds — don't
  // make the visitor's form submission wait on it. Runs after the response is
  // sent; Vercel extends the invocation's lifetime for this via `after`.
  after(async () => {
    await sendInstantAck(agent, lead);
    revalidatePath("/dashboard/leads");
  });

  return redirectOrThankYou(formData);
}
