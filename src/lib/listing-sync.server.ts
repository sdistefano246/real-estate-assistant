import "server-only";
import { prisma } from "@/lib/db.server";
import { createListingAndAutoPost } from "@/app/actions/marketing";

// Automated version of the manual "Listing Sync Workflow" (see the vault note
// of the same name) — checks the agent's public Century 21 site for new
// listings and onboards them through the real Marketing pipeline, same as a
// human driving the form. Opt-in via LISTING_SYNC_FEED_URL; unset means this
// entire feature is a no-op, matching every other integration in this app.

// The site itself displays her name as `Susan "Susie" Carone` (embedded
// nickname, confirmed via a real dry run against the live feed) — neither
// "Susie Carone" nor "Susan Carone" appears as an exact substring of that.
// Match on the surname plus either first-name variant instead of a fixed
// phrase, so this doesn't silently break again if the site's exact wording
// shifts.
function isSusiesCredit(creditText: string): boolean {
  return creditText.includes("Carone") && (creditText.includes("Susan") || creditText.includes("Susie"));
}

// A bound on how far past a card's own href its "Listed By" text can
// realistically sit — confirmed via real testing at ~4000 characters for a
// normal grid card. Needed because the site's pinned/featured listing banner
// (see the vault's "Listing Sync Workflow" note) has no href of its own
// nearby; without this bound, its "Listed By" text gets attributed to
// whatever unrelated card's "until the next href" window it happens to fall
// inside — a real false-positive/false-negative bug caught during dry-run
// testing before this went live.
const MAX_CARD_WINDOW_CHARS = 6000;

// Bounds one run's work so a day with several new listings can't blow the
// cron route's time budget — the rest simply get picked up on the next run.
// Same reasoning as automation.server.ts's MAX_NURTURE_PER_RUN.
const MAX_NEW_LISTINGS_PER_RUN = 3;

// Safety cap on how many feed pages to walk, independent of whatever the site
// itself reports — protects against a parsing bug reading a bogus max-page
// number and looping far longer than the real listing count could ever need.
const MAX_FEED_PAGES = 60;

export function isListingSyncConfigured(): boolean {
  return Boolean(process.env.LISTING_SYNC_FEED_URL);
}

export type ListingSyncResult = {
  onboarded: number;
  skipped: number;
  errors: string[];
};

export async function syncNewListings(agentId: string): Promise<ListingSyncResult> {
  const feedUrl = process.env.LISTING_SYNC_FEED_URL;
  const result: ListingSyncResult = { onboarded: 0, skipped: 0, errors: [] };
  if (!feedUrl) return result;

  let candidates: Map<string, FeedCardFacts>;
  try {
    candidates = await findMatchingListingUrls(feedUrl);
  } catch (error) {
    result.errors.push(`feed scan failed: ${errorMessage(error)}`);
    return result;
  }

  for (const [detailUrl, feedFacts] of candidates) {
    if (result.onboarded >= MAX_NEW_LISTINGS_PER_RUN) break;

    const existing = await prisma.listing.findUnique({ where: { sourceUrl: detailUrl }, select: { id: true } });
    if (existing) continue;

    try {
      // Same standing exception as the manual workflow: the Marketing form
      // requires non-zero beds/baths/sqft, so vacant land (and any listing
      // missing these facts) can't go through it honestly. Skip, don't fake.
      // Checked from the feed page's own plain summary — see the note on
      // FeedCardFacts for why that's preferred over the detail page's
      // ambiguous JSON-LD bathroom fields.
      if (!feedFacts.beds || !feedFacts.baths || !feedFacts.sqft) {
        result.skipped += 1;
        continue;
      }

      const parsed = await parseListingDetail(detailUrl);
      if (!parsed) {
        result.skipped += 1;
        continue;
      }

      const outcome = await createListingAndAutoPost({
        agentId,
        address: parsed.address,
        beds: feedFacts.beds,
        baths: feedFacts.baths,
        sqft: feedFacts.sqft,
        price: parsed.price,
        features: "",
        photoUrls: parsed.photoUrls,
        sourceUrl: detailUrl,
      });

      if ("error" in outcome) {
        result.errors.push(`${detailUrl}: ${outcome.error}`);
      } else {
        result.onboarded += 1;
      }
    } catch (error) {
      result.errors.push(`${detailUrl}: ${errorMessage(error)}`);
    }
  }

  return result;
}

// --- Feed page scan (find candidate listing URLs) -------------------------

// Fetched in small parallel batches rather than one page at a time — a fully
// sequential loop across up to MAX_FEED_PAGES real requests is exactly the
// pattern that caused this project's earlier Instagram production timeout
// (see instagram.server.ts's history). A batch size of 5 keeps this fast
// without hammering the source site all at once.
const FEED_PAGE_BATCH_SIZE = 5;

// beds/baths/sqft as shown in the feed card's own plain summary text (e.g.
// "3 Bed 3 Baths 3862 sqft") — confirmed via a real dry run to be more
// trustworthy than the detail page's schema.org bathroom fields, which don't
// reliably follow the standard "full + half x0.5" convention on this site
// (one real listing's numberOfFullBathrooms/numberOfPartialBathrooms summed
// to a bath count the site's own plain-text display disagreed with). Since
// this is what actually appears in the generated public post, the
// human-readable summary a site visitor would see is the safer source.
type FeedCardFacts = { beds: number; baths: number; sqft: number };

async function findMatchingListingUrls(feedUrl: string): Promise<Map<string, FeedCardFacts>> {
  const firstPage = await fetchText(withPage(feedUrl, 1));
  const totalPages = Math.min(detectMaxPage(firstPage), MAX_FEED_PAGES);

  const found = new Map<string, FeedCardFacts>(); // also dedupes both same-listing-ID repeats and the site's own pinned-listing quirk
  extractMatchingUrlsFromFeedPage(firstPage, feedUrl, found);

  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  for (let i = 0; i < remainingPages.length; i += FEED_PAGE_BATCH_SIZE) {
    const batch = remainingPages.slice(i, i + FEED_PAGE_BATCH_SIZE);
    const htmls = await Promise.all(batch.map((page) => fetchText(withPage(feedUrl, page))));
    for (const html of htmls) extractMatchingUrlsFromFeedPage(html, feedUrl, found);
  }

  return found;
}

function detectMaxPage(html: string): number {
  let max = 1;
  for (const match of html.matchAll(/[?&]page=(\d+)/g)) {
    const n = Number(match[1]);
    if (n > max) max = n;
  }
  return max;
}

function extractMatchingUrlsFromFeedPage(html: string, feedUrl: string, found: Map<string, FeedCardFacts>): void {
  const origin = new URL(feedUrl).origin;
  const cardRe = new RegExp(
    `href="(${escapeRegex(origin)}/listing/[^"]+)"[^>]*data-listingID="\\d+"`,
    "g"
  );

  const matches = [...html.matchAll(cardRe)];
  for (let i = 0; i < matches.length; i++) {
    const url = matches[i][1];
    const cardStart = matches[i].index! + matches[i][0].length;
    const nextCardStart = i + 1 < matches.length ? matches[i + 1].index! : html.length;
    const cardEnd = Math.min(nextCardStart, cardStart + MAX_CARD_WINDOW_CHARS);
    const cardHtml = html.slice(cardStart, cardEnd);

    const creditMatch = cardHtml.match(/Listed By:\s*([^<]+)/);
    if (!creditMatch || !isSusiesCredit(creditMatch[1])) continue;

    const factsMatch = cardHtml.match(/bed_bath_sqft'>\s*<div>\s*(\d+)\s*Bed\s*<\/div>\s*<div>\s*(\d+)\s*Baths?\s*<\/div>\s*<div>\s*(\d+)\s*sqft\s*<\/div>/);
    found.set(url, {
      beds: factsMatch ? Number(factsMatch[1]) : 0,
      baths: factsMatch ? Number(factsMatch[2]) : 0,
      sqft: factsMatch ? Number(factsMatch[3]) : 0,
    });
  }
}

function withPage(feedUrl: string, page: number): string {
  const url = new URL(feedUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

// --- Detail page parse (real facts, via the site's own schema.org JSON-LD) -

type ParsedListing = {
  address: string;
  price: number;
  photoUrls: string[];
};

async function parseListingDetail(detailUrl: string): Promise<ParsedListing | null> {
  const html = await fetchText(detailUrl);

  const ldJsonMatch = html.match(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/);
  if (!ldJsonMatch) return null;

  let graph: Array<Record<string, unknown>>;
  try {
    graph = (JSON.parse(ldJsonMatch[1]) as { "@graph"?: Array<Record<string, unknown>> })["@graph"] ?? [];
  } catch {
    return null;
  }

  const listing = graph.find((n) => n["@type"] === "RealEstateListing");
  const house = graph.find((n) => n["@type"] === "House");
  const product = graph.find((n) => n["@type"] === "Product");
  if (!house) return null;

  // Re-verify against the detail page's own data, not just the feed-page
  // text match — cheap extra confidence since this page is already fetched.
  const creditText = String(listing?.creditText ?? "");
  if (!isSusiesCredit(creditText)) return null;

  const address = house.address as { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string } | undefined;
  const fullAddress = [address?.streetAddress, address?.addressLocality, address?.addressRegion, address?.postalCode]
    .filter(Boolean)
    .join(", ");

  const offers = (product as { offers?: { price?: number } } | undefined)?.offers;
  const price = Number(offers?.price ?? 0);

  const photos = (house.photo as Array<{ url?: string }> | undefined) ?? [];
  const photoUrls = dedupeConsecutivePhotos(photos.map((p) => p.url).filter((u): u is string => Boolean(u))).slice(0, 10);

  if (!fullAddress || !price) return null;

  return { address: fullAddress, price, photoUrls };
}

// The source site has served byte-identical photos at consecutive indices
// before (a real quirk of its own data, confirmed during the manual sync) —
// guard against uploading an obvious duplicate pair without a network round
// trip per photo by just dropping an exact URL repeat next to itself.
function dedupeConsecutivePhotos(urls: string[]): string[] {
  return urls.filter((url, i) => i === 0 || url !== urls[i - 1]);
}

// --- Small helpers ---------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  return res.text();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
