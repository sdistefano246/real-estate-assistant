import "server-only";
import { ensureFreshGoogleAccessToken } from "@/lib/google.server";

const PEOPLE_API_BASE = "https://people.googleapis.com/v1";

export type GoogleContactBirthday = {
  resourceName: string;
  email: string; // lowercased
  name: string | null;
  month: number | null;
  day: number | null;
  year: number | null;
};

type PeopleConnection = {
  resourceName?: string;
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
};

type PeopleConnectionsResponse = {
  connections?: PeopleConnection[];
  nextPageToken?: string;
  error?: { message?: string };
};

// Pulls every Google Contact that has both an email and a birthday set,
// flattened to one row per (connection, email) pair — a connection with
// multiple emails produces multiple rows, all sharing the same birthday.
// Pages fully via nextPageToken; fine at small-to-medium contact-list sizes,
// a possible slow point for an agent with thousands of Google Contacts
// (not solved here — see the birthday-sync plan's open questions).
export async function fetchGoogleContactBirthdays(agentId: string): Promise<GoogleContactBirthday[]> {
  const accessToken = await ensureFreshGoogleAccessToken(agentId);
  const results: GoogleContactBirthday[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: "names,emailAddresses,birthdays",
      pageSize: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${PEOPLE_API_BASE}/people/me/connections?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as PeopleConnectionsResponse;
    if (!res.ok) {
      throw new Error(`Google Contacts lookup failed: ${json.error?.message ?? res.statusText}`);
    }

    for (const connection of json.connections ?? []) {
      const birthday = connection.birthdays?.[0]?.date;
      if (!birthday || (!birthday.month && !birthday.day)) continue;

      const name = connection.names?.[0]?.displayName ?? null;
      for (const emailEntry of connection.emailAddresses ?? []) {
        const email = emailEntry.value?.toLowerCase().trim();
        if (!email) continue;
        results.push({
          resourceName: connection.resourceName ?? "",
          email,
          name,
          month: birthday.month ?? null,
          day: birthday.day ?? null,
          year: birthday.year ?? null,
        });
      }
    }

    pageToken = json.nextPageToken;
  } while (pageToken);

  return results;
}
