import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getUpcomingShowings } from "@/lib/upcoming-showings.server";
import { getBuyersWithSearch } from "@/lib/buyers.server";
import { evaluateMatch, hasAnyCriteria, type BuyerCriteria } from "@/lib/buyer-match";
import { AddBuyerForm } from "./add-buyer-form";
import { BuyerCard, type MatchedListing } from "./buyer-card";

export default async function BuyersPage() {
  const { agentId } = await verifySession();

  const [buyers, listings, upcomingShowings] = await Promise.all([
    getBuyersWithSearch(agentId),
    prisma.listing.findMany({
      where: { agentId },
      select: { id: true, address: true, price: true, beds: true, baths: true },
    }),
    getUpcomingShowings(agentId),
  ]);

  // Which of the agent's own active listings each buyer would like — computed
  // here (the listing set is small and lives server-side) and handed to each card.
  function matchesFor(criteria: BuyerCriteria): MatchedListing[] {
    if (!hasAnyCriteria(criteria)) return [];
    return listings
      .filter(
        (l) => evaluateMatch(criteria, { price: l.price, beds: l.beds, baths: l.baths }).matches
      )
      .map((l) => ({ id: l.id, address: l.address, price: l.price }));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Buyers</h1>
        <p className="text-sm text-stone-500">
          Buyers you&apos;re representing, their search criteria, the homes they&apos;re considering,
          and showings on the calendar. Candidate homes are checked against each buyer&apos;s
          criteria automatically.
        </p>
      </div>

      {upcomingShowings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{upcomingShowings.length}</strong>{" "}
          {upcomingShowings.length === 1 ? "showing" : "showings"} in the next couple of days or
          awaiting feedback — flagged on each buyer below.
        </div>
      )}

      <AddBuyerForm />

      {buyers.length === 0 ? (
        <p className="text-sm text-stone-400">
          No buyers yet — add one above to start tracking their search.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {buyers.map((buyer) => (
            <BuyerCard
              key={buyer.id}
              buyer={buyer}
              matchedListings={matchesFor({
                minPrice: buyer.minPrice,
                maxPrice: buyer.maxPrice,
                minBeds: buyer.minBeds,
                minBaths: buyer.minBaths,
                propertyType: buyer.propertyType,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
