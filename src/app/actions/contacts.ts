"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isContactRelationship } from "@/lib/contact-relationship";

export type AddContactState = { error?: string } | undefined;

// Used both from a closed Transaction ("Add to sphere of influence", with
// transactionId set as a hidden field) and from a standalone "Add contact" form
// (transactionId omitted) — same validation either way, see Phase 4 task list, 4A.
export async function addContact(
  _prevState: AddContactState,
  formData: FormData
): Promise<AddContactState> {
  const { agentId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const relationship = String(formData.get("relationship") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const transactionId = String(formData.get("transactionId") ?? "").trim() || null;

  if (!name) {
    return { error: "Name is required." };
  }
  if (!isContactRelationship(relationship)) {
    return { error: "Pick a valid relationship." };
  }

  if (transactionId) {
    await prisma.transaction.findFirstOrThrow({ where: { id: transactionId, agentId } });
  }

  await prisma.contact.create({
    data: { agentId, transactionId, name, email, phone, relationship, notes },
  });

  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/sphere");
  return undefined;
}
