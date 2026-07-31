import "server-only";
import { prisma } from "@/lib/db.server";

// A connector-free calendar feed: we emit a standard iCalendar (RFC 5545) document
// that Google/Apple/Outlook can subscribe to by URL. No OAuth, no push — the
// agent's real estate dates simply appear (and refresh) in whatever calendar they
// already live in.

const PRODID = "-//Real Estate Assistant//Calendar Feed//EN";

export async function getAgentIdByCalendarToken(token: string): Promise<string | null> {
  if (!token) return null;
  const agent = await prisma.agent.findUnique({ where: { calendarToken: token }, select: { id: true } });
  return agent?.id ?? null;
}

type CalEvent = {
  uid: string;
  summary: string;
  start: Date;
  allDay: boolean;
};

export async function buildAgentCalendar(agentId: string): Promise<string> {
  const [milestones, closingTransactions, showings] = await Promise.all([
    prisma.milestone.findMany({
      where: { completed: false, transaction: { agentId, status: "active" } },
      include: { transaction: { select: { propertyAddress: true } } },
    }),
    prisma.transaction.findMany({
      where: { agentId, status: "active", closingDate: { not: null } },
      select: { id: true, propertyAddress: true, closingDate: true },
    }),
    prisma.showing.findMany({
      where: { buyer: { agentId } },
      include: { buyer: { select: { name: true } } },
    }),
  ]);

  const events: CalEvent[] = [];

  for (const m of milestones) {
    events.push({
      uid: `milestone-${m.id}@real-estate-assistant`,
      summary: `${m.label}: ${m.transaction.propertyAddress}`,
      start: m.dueDate,
      allDay: true,
    });
  }

  for (const t of closingTransactions) {
    if (!t.closingDate) continue;
    events.push({
      uid: `closing-${t.id}@real-estate-assistant`,
      summary: `Closing: ${t.propertyAddress}`,
      start: t.closingDate,
      allDay: true,
    });
  }

  for (const s of showings) {
    const status = s.completed ? "Toured" : "Showing";
    events.push({
      uid: `showing-${s.id}@real-estate-assistant`,
      summary: `${status}: ${s.address} (${s.buyer.name})`,
      start: s.scheduledAt,
      allDay: false,
    });
  }

  return renderCalendar(events);
}

// --- iCalendar rendering -------------------------------------------------

function renderCalendar(events: CalEvent[]): string {
  const stamp = formatDateTimeUtc(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Real Estate Assistant",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateUtc(event.start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateUtc(addDays(event.start, 1))}`);
    } else {
      lines.push(`DTSTART:${formatDateTimeUtc(event.start)}`);
      lines.push(`DTEND:${formatDateTimeUtc(new Date(event.start.getTime() + 60 * 60 * 1000))}`);
    }
    lines.push(`SUMMARY:${icsEscape(event.summary)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // RFC 5545: CRLF line endings, and lines folded at 75 octets.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold a content line longer than 75 octets by inserting CRLF + a single space.
// We approximate octets with UTF-8 byte length and break on a safe boundary.
function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    // Continuation lines start with a space, so cap them one octet shorter.
    const limit = chunks.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current) chunks.push(current);

  return chunks.join("\r\n ");
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function formatDateTimeUtc(d: Date): string {
  return `${formatDateUtc(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
