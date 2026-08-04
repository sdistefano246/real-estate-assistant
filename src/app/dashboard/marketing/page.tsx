import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isBlobConfigured } from "@/lib/blob.server";
import { ListingForm } from "./listing-form";
import { ListingHistory } from "./listing-history";

// generateListing()'s Instagram/Facebook auto-post steps (invoked as a
// Server Action from this page) can take a while for a multi-photo listing
// even after parallelizing the per-photo work in instagram.server.ts /
// facebook.server.ts — real network calls to Meta's API, not instant. A
// default serverless timeout silently killed one such request mid-flight
// before it could record success or failure; give real headroom instead.
export const maxDuration = 60;

export default async function MarketingPage() {
  const { agentId } = await verifySession();
  const listings = await prisma.listing.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Marketing</h1>
        <p className="text-sm text-stone-500">
          Generate an MLS-ready description and social posts for a new listing.
        </p>
      </div>

      <ListingForm configured={isAnthropicConfigured()} blobConfigured={isBlobConfigured()} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">History</h2>
        <ListingHistory listings={listings} />
      </div>
    </div>
  );
}
