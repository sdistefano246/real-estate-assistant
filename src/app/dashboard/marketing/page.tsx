import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { ListingForm } from "./listing-form";
import { ListingHistory } from "./listing-history";

export default async function MarketingPage() {
  const { agentId } = await verifySession();
  const listings = await prisma.listing.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Marketing</h1>
        <p className="text-sm text-stone-500">
          Generate an MLS-ready description and social posts for a new listing.
        </p>
      </div>

      <ListingForm configured={isAnthropicConfigured()} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">History</h2>
        <ListingHistory listings={listings} />
      </div>
    </div>
  );
}
