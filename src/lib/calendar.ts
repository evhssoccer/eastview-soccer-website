/** "Add to calendar" links and .ics feeds for games and events. */
import type { ClubEvent, Game } from "./data";
import { icsStamp } from "./time";

const SITE = "https://eastviewsoccer.com";
const GAME_LENGTH_MS = 2 * 3600_000;

export function gameTitle(g: Game) {
  return `East View ${g.team.name} ${g.venue === "Away" ? "at" : "vs"} ${g.opponent}`;
}

function gameDetails(g: Game) {
  return [g.district && "District game", g.special, g.notes, `${SITE}/schedule/${g.team.slug}/`]
    .filter(Boolean).join("\n");
}

const where = (location: string, address: string) => [location, address].filter(Boolean).join(", ");

export function googleCalendarLink(g: Game): string {
  const end = new Date(g.start.getTime() + GAME_LENGTH_MS);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: gameTitle(g),
    dates: `${icsStamp(g.start)}/${icsStamp(end)}`,
    details: gameDetails(g),
    location: where(g.location, g.address),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines to 75 octets as RFC 5545 requires. */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

const allDay = (d: Date) => icsStamp(d).slice(0, 8);

export function icsFeed(name: string, games: Game[], events: ClubEvent[] = []): string {
  const stamp = icsStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//East View Soccer Booster Club//Schedule//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:America/Chicago",
  ];
  for (const g of games) {
    if (g.status === "Canceled") continue;
    const title = gameTitle(g) + (g.result ? ` (${g.result} ${g.evScore}-${g.oppScore})` : "")
      + (g.status === "Postponed" ? " (POSTPONED)" : "");
    lines.push("BEGIN:VEVENT", `UID:${g.id}@eastviewsoccer.com`, `DTSTAMP:${stamp}`,
      g.timeKnown ? `DTSTART:${icsStamp(g.start)}` : `DTSTART;VALUE=DATE:${allDay(g.start)}`,
      ...(g.timeKnown ? [`DTEND:${icsStamp(new Date(g.start.getTime() + GAME_LENGTH_MS))}`] : []),
      `SUMMARY:${esc(title)}`, `LOCATION:${esc(where(g.location, g.address))}`,
      `DESCRIPTION:${esc(gameDetails(g))}`, "END:VEVENT");
  }
  for (const e of events) {
    const end = e.end ?? new Date(e.start.getTime() + 2 * 3600_000);
    lines.push("BEGIN:VEVENT", `UID:${e.id}@eastviewsoccer.com`, `DTSTAMP:${stamp}`,
      e.timeKnown ? `DTSTART:${icsStamp(e.start)}` : `DTSTART;VALUE=DATE:${allDay(e.start)}`,
      ...(e.timeKnown ? [`DTEND:${icsStamp(end)}`] : []),
      `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(where(e.location, e.address))}`,
      `DESCRIPTION:${esc([e.details, e.link].filter(Boolean).join("\n"))}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
