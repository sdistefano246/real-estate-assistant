"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isBuyerStatus } from "@/lib/buyer-status";
import { isBuyerPropertyStatus } from "@/lib/buyer-property-status";
import { isPropertyType } from "@/lib/property-type";

export type BuyerFormState = { error?: string } | undefined;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  return str(formData, key) || null;
}

function optionalInt(formData: FormData, key: string): number | null {
  const raw = str(formData, key).replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function optionalFloat(formData: FormData, key: string): number | null {
  const raw = str(formData, key).replace(/[,\s]/g, "");
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// "" -> null (no preference), "any" -> "any", a concrete type -> itself.
// Anything unrecognised is dropped to null rather than persisted as junk.
function parsePropertyType(formData: FormData): string | null {
  const value = str(formData, "propertyType");
  if (!value) return null;
  if (value === "any") return "any";
  return isPropertyType(value) ? value : null;
}

function buyerFieldsFrom(formData: FormData) {
  return {
    name: str(formData, "name"),
    email: optionalStr(formData, "email"),
    phone: optionalStr(formData, "phone"),
    locations: optionalStr(formData, "locations"),
    minPrice: optionalInt(formData, "minPrice"),
    maxPrice: optionalInt(formData, "maxPrice"),
    minBeds: optionalInt(formData, "minBeds"),
    minBaths: optionalFloat(formData, "minBaths"),
    propertyType: parsePropertyType(formData),
    mustHaves: optionalStr(formData, "mustHaves"),
    preApproved: str(formData, "preApproved") === "on" || str(formData, "preApproved") === "true",
    preApprovalAmount: optionalInt(formData, "preApprovalAmount"),
    notes: optionalStr(formData, "notes"),
  };
}

function validateBuyerFields(fields: ReturnType<typeof buyerFieldsFrom>): string | null {
  if (!fields.name) return "Buyer name is required.";
  if (fields.minPrice != null && fields.maxPrice != null && fields.minPrice > fields.maxPrice) {
    return "Min price can't be greater than max price.";
  }
  return null;
}

export async function addBuyer(_prevState: BuyerFormState, formData: FormData): Promise<BuyerFormState> {
  const { agentId } = await verifySession();

  const fields = buyerFieldsFrom(formData);
  const error = validateBuyerFields(fields);
  if (error) return { error };

  await prisma.buyer.create({ data: { agentId, ...fields } });

  revalidatePath("/dashboard/buyers");
  return undefined;
}

export async function updateBuyer(_prevState: BuyerFormState, formData: FormData): Promise<BuyerFormState> {
  const { agentId } = await verifySession();

  const buyerId = str(formData, "buyerId");
  if (!buyerId) return { error: "Missing buyer." };

  const fields = buyerFieldsFrom(formData);
  const error = validateBuyerFields(fields);
  if (error) return { error };

  const statusRaw = str(formData, "status");
  const status = isBuyerStatus(statusRaw) ? statusRaw : undefined;

  await prisma.buyer.updateMany({
    where: { id: buyerId, agentId },
    data: { ...fields, ...(status ? { status } : {}) },
  });

  revalidatePath("/dashboard/buyers");
  return undefined;
}

export async function updateBuyerStatus(buyerId: string, status: string) {
  const { agentId } = await verifySession();
  if (!isBuyerStatus(status)) throw new Error(`Invalid status: ${status}`);

  await prisma.buyer.updateMany({ where: { id: buyerId, agentId }, data: { status } });
  revalidatePath("/dashboard/buyers");
}

export async function deleteBuyer(buyerId: string) {
  const { agentId } = await verifySession();
  await prisma.buyer.deleteMany({ where: { id: buyerId, agentId } });
  revalidatePath("/dashboard/buyers");
}

// --- Candidate properties -------------------------------------------------

export async function addBuyerProperty(
  _prevState: BuyerFormState,
  formData: FormData
): Promise<BuyerFormState> {
  const { agentId } = await verifySession();

  const buyerId = str(formData, "buyerId");
  const address = str(formData, "address");
  if (!buyerId) return { error: "Missing buyer." };
  if (!address) return { error: "Property address is required." };

  // Confirm the buyer belongs to this agent before attaching anything to it.
  const buyer = await prisma.buyer.findFirst({ where: { id: buyerId, agentId }, select: { id: true } });
  if (!buyer) return { error: "Buyer not found." };

  await prisma.buyerProperty.create({
    data: {
      buyerId,
      address,
      price: optionalInt(formData, "price"),
      beds: optionalInt(formData, "beds"),
      baths: optionalFloat(formData, "baths"),
      propertyType: parsePropertyType(formData),
      listingUrl: optionalStr(formData, "listingUrl"),
      notes: optionalStr(formData, "notes"),
    },
  });

  revalidatePath("/dashboard/buyers");
  return undefined;
}

export async function updateBuyerPropertyStatus(propertyId: string, status: string) {
  const { agentId } = await verifySession();
  if (!isBuyerPropertyStatus(status)) throw new Error(`Invalid status: ${status}`);

  await prisma.buyerProperty.updateMany({
    where: { id: propertyId, buyer: { agentId } },
    data: { status },
  });
  revalidatePath("/dashboard/buyers");
}

export async function deleteBuyerProperty(propertyId: string) {
  const { agentId } = await verifySession();
  await prisma.buyerProperty.deleteMany({ where: { id: propertyId, buyer: { agentId } } });
  revalidatePath("/dashboard/buyers");
}

// --- Showings -------------------------------------------------------------

export async function scheduleShowing(
  _prevState: BuyerFormState,
  formData: FormData
): Promise<BuyerFormState> {
  const { agentId } = await verifySession();

  const buyerId = str(formData, "buyerId");
  const address = str(formData, "address");
  const scheduledRaw = str(formData, "scheduledAt");
  if (!buyerId) return { error: "Missing buyer." };
  if (!address) return { error: "A property address is required." };
  if (!scheduledRaw) return { error: "Pick a date and time." };

  const scheduledAt = new Date(scheduledRaw);
  if (Number.isNaN(scheduledAt.getTime())) return { error: "That date and time didn't parse." };

  const buyer = await prisma.buyer.findFirst({ where: { id: buyerId, agentId }, select: { id: true } });
  if (!buyer) return { error: "Buyer not found." };

  // Only accept a property link if that property really belongs to this buyer.
  const rawPropertyId = optionalStr(formData, "buyerPropertyId");
  let buyerPropertyId: string | null = null;
  if (rawPropertyId) {
    const property = await prisma.buyerProperty.findFirst({
      where: { id: rawPropertyId, buyerId },
      select: { id: true },
    });
    buyerPropertyId = property?.id ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.showing.create({ data: { buyerId, buyerPropertyId, address, scheduledAt } });
    // Scheduling a tour moves a "considering" candidate forward automatically.
    if (buyerPropertyId) {
      await tx.buyerProperty.updateMany({
        where: { id: buyerPropertyId, status: "considering" },
        data: { status: "showing_scheduled" },
      });
    }
  });

  revalidatePath("/dashboard/buyers");
  return undefined;
}

export async function completeShowing(showingId: string, feedback: string) {
  const { agentId } = await verifySession();

  const showing = await prisma.showing.findFirst({
    where: { id: showingId, buyer: { agentId } },
    select: { id: true, buyerPropertyId: true },
  });
  if (!showing) throw new Error("Showing not found.");

  const trimmed = feedback.trim();

  await prisma.$transaction(async (tx) => {
    await tx.showing.update({
      where: { id: showing.id },
      data: { completed: true, feedback: trimmed || null },
    });
    // A completed tour means the linked candidate has now been toured (unless
    // it's already moved further along, e.g. an offer was made).
    if (showing.buyerPropertyId) {
      await tx.buyerProperty.updateMany({
        where: { id: showing.buyerPropertyId, status: { in: ["considering", "showing_scheduled"] } },
        data: { status: "toured" },
      });
    }
  });

  revalidatePath("/dashboard/buyers");
}

export async function deleteShowing(showingId: string) {
  const { agentId } = await verifySession();
  await prisma.showing.deleteMany({ where: { id: showingId, buyer: { agentId } } });
  revalidatePath("/dashboard/buyers");
}
