/** Typed views of the Google Sheet tabs. Every page reads club data through here. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadTab, type Row } from "./sheet";
import { centralDate, dayKey, now, parseDate, parseTime } from "./time";

const yes = (v: string | undefined) => /^(y|yes|true|1|x)$/i.test((v ?? "").trim());
const shown = (r: Row) => yes(r["Show"]);
const num = (v: string) => (v.trim() === "" || isNaN(+v) ? null : +v);
const list = (v: string) => v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- Settings

export interface Settings {
  season: string;
  /** Coming Up shows games within this many days after the Next Game Day. */
  comingUpDays: number;
  homeEvents: number;
  email: string;
  announcement: string;
  announcementLink: string;
  /** East View's home field, used for home games that leave Location/Address blank. */
  homeStadium: string;
  homeAddress: string;
  homeTicketsLink: string;
  /** e.g. "6A District 24"; shown with the district record. */
  districtName: string;
}

export async function getSettings(): Promise<Settings> {
  const rows = await loadTab("Settings");
  const get = (k: string) => rows.find((r) => r["Setting"]?.toLowerCase() === k.toLowerCase())?.["Value"] ?? "";
  return {
    season: get("Current Season") || "2026-2027",
    comingUpDays: num(get("Coming Up Days")) ?? 14,
    homeEvents: num(get("Home Events To Show")) ?? 4,
    email: get("Club Email") || "eastviewsoccer@gmail.com",
    announcement: get("Announcement"),
    announcementLink: get("Announcement Link"),
    homeStadium: get("Home Stadium") || "Patriot Stadium",
    homeAddress: get("Home Address") || "4490 E University Ave, Georgetown, TX 78626",
    homeTicketsLink: get("Home Tickets Link"),
    districtName: get("District Name"),
  };
}

/** Season "2026-2027" → its final calendar year (2027). */
export const seasonEndYear = (season: string) => {
  const years = season.match(/\d{4}/g);
  return years ? +years[years.length - 1] : now().getFullYear();
};

// ---------------------------------------------------------------- Teams

export interface Team {
  name: string;
  slug: string;
  gender: "Women" | "Men";
  level: string;
  sort: number;
}

export async function getTeams(): Promise<Team[]> {
  return (await loadTab("Teams"))
    .filter((r) => r["Team"] && (r["Show"] === undefined || r["Show"] === "" || shown(r)))
    .map((r) => ({
      name: r["Team"],
      slug: slugify(r["Team"]),
      gender: /women|girl/i.test(r["Gender"] || r["Team"]) ? ("Women" as const) : ("Men" as const),
      // "JV A" from "JV A Women": the gender word is redundant inside a Women/Men group.
      level: (r["Level"] || r["Team"]).replace(/\s+(women|men|girls|boys)$/i, ""),
      sort: num(r["Sort"]) ?? 99,
    }))
    .sort((a, b) => a.sort - b.sort);
}

/** Resolve "All", "Women", "Men", or comma-separated team names to teams. */
function resolveTeams(value: string, teams: Team[]): Team[] {
  const out = new Set<Team>();
  for (const part of list(value)) {
    const p = part.toLowerCase();
    if (p === "all") teams.forEach((t) => out.add(t));
    else if (/^(women|girls)$/.test(p)) teams.filter((t) => t.gender === "Women").forEach((t) => out.add(t));
    else if (/^(men|boys)$/.test(p)) teams.filter((t) => t.gender === "Men").forEach((t) => out.add(t));
    else {
      const t = teams.find((t) => t.name.toLowerCase() === p || t.slug === slugify(part));
      if (t) out.add(t);
    }
  }
  return [...out];
}

// ---------------------------------------------------------------- Opponents

export interface Opponent {
  name: string;
  mascot: string;
  stadium: string;
  address: string;
  ticketsLink: string;
  logo: string;
  district: boolean;
}

/** "Hendrickson High School", "hendrickson hs", "Hendrickson" all match the same opponent. */
const opponentKey = (s: string) =>
  s.toLowerCase().replace(/\b(high school|hs|h\.s)\b\.?/g, "").replace(/[^a-z0-9]/g, "");

/** Google Drive share links → a direct image URL (the file must be shared "Anyone with the link"). */
export function imageUrl(url: string): string {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : url;
}

/** A logo dropped in public/images/opponents/, named after the school: "Vista Ridge HS" → vista-ridge.png. */
export function localLogo(school: string): string {
  const base = slugify(school.replace(/\b(high school|hs)\b\.?/gi, ""));
  if (!base) return "";
  for (const ext of ["svg", "png", "webp", "jpg", "jpeg"]) {
    if (existsSync(join(process.cwd(), "public", "images", "opponents", `${base}.${ext}`))) {
      return `/images/opponents/${base}.${ext}`;
    }
  }
  return "";
}

export async function getOpponents(): Promise<Map<string, Opponent>> {
  const rows = await loadTab("Opponents");
  const map = new Map<string, Opponent>();
  for (const r of rows) {
    const name = r["School"] || r["Opponent"] || "";
    if (!name) continue;
    map.set(opponentKey(name), {
      name, mascot: r["Mascot"] ?? "", stadium: r["Stadium"] ?? "", address: r["Address"] ?? "",
      ticketsLink: r["Tickets Link"] ?? "", logo: imageUrl(r["Logo"] ?? "") || localLogo(name),
      district: yes(r["District Opponent"]),
    });
  }
  return map;
}

// ---------------------------------------------------------------- Games

export type Result = "W" | "L" | "T";

export interface Game {
  id: string;
  team: Team;
  start: Date;
  timeKnown: boolean;
  day: string;
  opponent: string;
  venue: "Home" | "Away" | "Neutral";
  location: string;
  address: string;
  district: boolean;
  special: string;
  status: "Scheduled" | "Final" | "Postponed" | "Canceled";
  evScore: number | null;
  oppScore: number | null;
  result: Result | null;
  ticketsLink: string;
  /** From the sheet's "Watch Link" column; not shown on the site yet (no livestreams for now). */
  watchLink: string;
  recapLink: string;
  opponentLogo: string;
  opponentMascot: string;
  notes: string;
}

export async function getGames(): Promise<Game[]> {
  const [rows, teams, settings, opponents] = await Promise.all([loadTab("Games"), getTeams(), getSettings(), getOpponents()]);
  const games: Game[] = [];
  for (const r of rows) {
    if (!shown(r)) continue;
    if (r["Season"] && r["Season"] !== settings.season) continue;
    const team = teams.find((t) => t.name.toLowerCase() === (r["Team"] ?? "").toLowerCase());
    const d = parseDate(r["Date"] ?? "");
    if (!team || !d || !r["Opponent"]) continue;
    const t = parseTime(r["Time"] ?? "");
    const start = centralDate(d[0], d[1], d[2], t?.[0] ?? 12, t?.[1] ?? 0);
    const statusRaw = (r["Status"] || "Scheduled").toLowerCase();
    const status = statusRaw.startsWith("final") ? "Final"
      : statusRaw.startsWith("post") ? "Postponed"
      : statusRaw.startsWith("cancel") ? "Canceled" : "Scheduled";
    const ev = num(r["EV Score"] ?? ""), opp = num(r["Opp Score"] ?? "");
    const result: Result | null = status === "Final" && ev !== null && opp !== null
      ? ev > opp ? "W" : ev < opp ? "L" : "T" : null;
    const venueRaw = (r["Home/Away"] || "Home").toLowerCase();
    const venue = venueRaw.startsWith("a") ? "Away" : venueRaw.startsWith("n") ? "Neutral" : "Home";
    // Anything left blank on the game row falls back to the Opponents tab (away) or Settings (home).
    const o = opponents.get(opponentKey(r["Opponent"]));
    const host = venue === "Home"
      ? { stadium: settings.homeStadium, address: settings.homeAddress, tickets: settings.homeTicketsLink }
      : venue === "Away" && o ? { stadium: o.stadium, address: o.address, tickets: o.ticketsLink }
      : { stadium: "", address: "", tickets: "" };
    const districtCell = (r["District Game"] ?? "").trim();
    games.push({
      id: `${team.slug}-${dayKey(start)}-${slugify(r["Opponent"])}`,
      team, start, timeKnown: !!t, day: dayKey(start),
      opponent: r["Opponent"],
      venue,
      location: r["Location"] || host.stadium, address: r["Address"] || (r["Location"] ? "" : host.address),
      district: districtCell ? yes(districtCell) : !!o?.district, special: r["Special"] ?? "",
      status, evScore: ev, oppScore: opp, result,
      ticketsLink: r["Tickets Link"] || host.tickets, watchLink: r["Watch Link"] ?? "",
      recapLink: r["Recap Link"] ?? "", opponentLogo: imageUrl(r["Opponent Logo"] || o?.logo || "") || localLogo(r["Opponent"]),
      opponentMascot: o?.mascot ?? "",
      notes: r["Notes"] ?? "",
    });
  }
  return games.sort((a, b) => a.start.getTime() - b.start.getTime() || a.team.sort - b.team.sort);
}

/** Games that haven't happened yet (kept until 3 hours after kickoff). */
export const isUpcoming = (g: Game, at = now()) =>
  g.status !== "Final" && g.status !== "Canceled" && g.start.getTime() + 3 * 3600_000 > at.getTime();

export interface VenueColumn {
  venue: Game["venue"];
  games: Game[];
  location: string;
  address: string;
  tickets: string;
}

/** All of one day's games against one school, split into Home / Away / Neutral columns. */
export interface Matchup {
  day: string;
  start: Date;
  opponent: string;
  logo: string;
  mascot: string;
  columns: VenueColumn[];
}

/** Group games by date + opponent (games must already be in kickoff order). */
export function groupMatchups(games: Game[]): Matchup[] {
  const out: Matchup[] = [];
  for (const g of games) {
    let m = out.find((x) => x.day === g.day && x.opponent === g.opponent);
    if (!m) {
      m = { day: g.day, start: g.start, opponent: g.opponent, logo: "", mascot: g.opponentMascot, columns: [] };
      out.push(m);
    }
    m.logo ||= g.opponentLogo;
    let c = m.columns.find((x) => x.venue === g.venue);
    if (!c) {
      c = { venue: g.venue, games: [], location: "", address: "", tickets: "" };
      m.columns.push(c);
    }
    c.games.push(g);
    c.location ||= g.location;
    c.address ||= g.address;
    if (g.status === "Scheduled") c.tickets ||= g.ticketsLink;
  }
  const order = { Home: 0, Away: 1, Neutral: 2 };
  for (const m of out) m.columns.sort((a, b) => order[a.venue] - order[b.venue]);
  return out;
}

/** Every game on the next date with an upcoming scheduled game, in kickoff order. */
export function nextGameDay(games: Game[], at = now()): Game[] {
  const first = games.find((g) => isUpcoming(g, at) && g.status === "Scheduled");
  if (!first) return [];
  return games.filter((g) => g.day === first.day && g.status !== "Canceled" && (g.status !== "Final"));
}

export interface Record_ {
  overall: string;
  district: string;
  home: string;
  away: string;
  streak: string;
  played: number;
}

export function record(games: Game[]): Record_ {
  const tally = (gs: Game[]) => {
    const w = gs.filter((g) => g.result === "W").length;
    const l = gs.filter((g) => g.result === "L").length;
    const t = gs.filter((g) => g.result === "T").length;
    return `${w}-${l}-${t}`;
  };
  const done = games.filter((g) => g.result).sort((a, b) => a.start.getTime() - b.start.getTime());
  let streak = "";
  if (done.length) {
    const last = done[done.length - 1].result!;
    let n = 0;
    for (let i = done.length - 1; i >= 0 && done[i].result === last; i--) n++;
    streak = `${last}${n}`;
  }
  return {
    overall: tally(done),
    district: tally(done.filter((g) => g.district)),
    home: tally(done.filter((g) => g.venue === "Home")),
    away: tally(done.filter((g) => g.venue !== "Home")),
    streak: streak || "–",
    played: done.length,
  };
}

// ---------------------------------------------------------------- Events

export interface ClubEvent {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  timeKnown: boolean;
  endTime: string;
  teams: Team[];
  allTeams: boolean;
  /** Who it's for, e.g. "All teams", "Women's teams", "Varsity Men". */
  audience: string;
  location: string;
  address: string;
  details: string;
  link: string;
  linkText: string;
  image: string;
}

export async function getEvents(): Promise<ClubEvent[]> {
  const [rows, teams] = await Promise.all([loadTab("Events"), getTeams()]);
  const events: ClubEvent[] = [];
  for (const r of rows) {
    if (!shown(r) || !r["Title"]) continue;
    const d = parseDate(r["Date"] ?? "");
    if (!d) continue;
    const t = parseTime(r["Start Time"] ?? "");
    const start = centralDate(d[0], d[1], d[2], t?.[0] ?? 0, t?.[1] ?? 0);
    const ed = parseDate(r["End Date"] ?? "");
    const et = parseTime(r["End Time"] ?? "");
    const endDay = ed ?? d;
    const end = ed || et ? centralDate(endDay[0], endDay[1], endDay[2], et?.[0] ?? 23, et?.[1] ?? 59) : null;
    const teamList = resolveTeams(r["Teams"] || "All", teams);
    events.push({
      id: `${dayKey(start)}-${slugify(r["Title"])}`,
      title: r["Title"], start, end, timeKnown: !!t, endTime: r["End Time"] ?? "",
      teams: teamList, allTeams: teamList.length === teams.length, audience: audience(teamList, teams),
      location: r["Location"] ?? "", address: r["Address"] ?? "",
      details: r["Details"] ?? "", link: r["Link"] ?? "",
      linkText: r["Link Text"] || "Details", image: r["Image"] ?? "",
    });
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function audience(list: Team[], teams: Team[]): string {
  if (list.length === teams.length) return "All teams";
  const groups = (["Women", "Men"] as const).filter((g) => {
    const all = teams.filter((t) => t.gender === g);
    return all.length > 0 && all.every((t) => list.includes(t));
  });
  const rest = list.filter((t) => !groups.includes(t.gender));
  return [...groups.map((g) => `${g}'s teams`), ...rest.map((t) => t.name)].join(", ");
}

export const eventIsUpcoming =(e: ClubEvent, at = now()) => {
  const until = e.end ?? new Date(e.start.getTime() + (e.timeKnown ? 3 : 24) * 3600_000);
  return until.getTime() > at.getTime();
};

// ---------------------------------------------------------------- Players

export interface Player {
  team: Team;
  number: string;
  first: string;
  last: string;
  gradYear: number | null;
  classYear: string;
  position: string;
}

const CLASS = ["Sr", "Jr", "So", "Fr"];

export async function getPlayers(): Promise<Player[]> {
  const [rows, teams, settings] = await Promise.all([loadTab("Players"), getTeams(), getSettings()]);
  const endYear = seasonEndYear(settings.season);
  return rows
    // A roster sheet without a Show column shows every row.
    .filter((r) => (r["Show"] === undefined || shown(r)) && (!r["Season"] || r["Season"] === settings.season))
    .map((r) => {
      const team = teams.find((t) => t.name.toLowerCase() === (r["Team"] ?? "").toLowerCase());
      const grad = num(r["Grad Year"] ?? "");
      return team && (r["First Name"] || r["Last Name"]) ? {
        team, number: (r["Number"] ?? "").replace(/^'/, ""),
        first: r["First Name"] ?? "", last: r["Last Name"] ?? "",
        gradYear: grad, classYear: grad !== null ? CLASS[grad - endYear] ?? "" : "",
        position: r["Position"] ?? "",
      } : null;
    })
    .filter((p): p is Player => !!p)
    .sort((a, b) => {
      const na = parseInt(a.number), nb = parseInt(b.number);
      // 0 before 00 before 1, numbers before blanks
      if (isNaN(na) || isNaN(nb)) return isNaN(na) ? 1 : -1;
      return na - nb || a.number.length - b.number.length;
    });
}

// ---------------------------------------------------------------- Coaches / Board / Sponsors

export interface Coach {
  name: string;
  title: string;
  teams: Team[];
  email: string;
  photo: string;
  bio: string;
  sort: number;
}

export async function getCoaches(): Promise<Coach[]> {
  const [rows, teams] = await Promise.all([loadTab("Coaches"), getTeams()]);
  return rows
    .filter((r) => shown(r) && r["Name"])
    .map((r) => ({
      name: r["Name"], title: r["Title"] || "Coach", teams: resolveTeams(r["Teams"] ?? "", teams),
      email: r["Email"] ?? "", photo: r["Photo"] ?? "", bio: r["Bio"] ?? "", sort: num(r["Sort"] ?? "") ?? 99,
    }))
    .sort((a, b) => a.sort - b.sort);
}

export interface BoardMember { role: string; name: string; email: string; sort: number }

/** The current season's board, or the most recent season listed. */
export async function getBoard(): Promise<{ season: string; members: BoardMember[] }> {
  const [rows, settings] = await Promise.all([loadTab("Board"), getSettings()]);
  const visible = rows.filter((r) => shown(r) && r["Name"]);
  const seasons = [...new Set(visible.map((r) => r["Season"]).filter(Boolean))].sort();
  const season = seasons.includes(settings.season) ? settings.season : seasons[seasons.length - 1] ?? settings.season;
  return {
    season,
    members: visible
      .filter((r) => !r["Season"] || r["Season"] === season)
      .map((r) => ({ role: r["Role"] ?? "", name: r["Name"], email: r["Email"] ?? "", sort: num(r["Sort"] ?? "") ?? 99 }))
      .sort((a, b) => a.sort - b.sort),
  };
}

export interface Sponsor { name: string; level: string; website: string; logo: string; sort: number }

export async function getSponsors(): Promise<Sponsor[]> {
  return (await loadTab("Sponsors"))
    .filter((r) => shown(r) && r["Name"])
    .map((r) => ({ name: r["Name"], level: r["Level"] ?? "", website: r["Website"] ?? "", logo: r["Logo"] ?? "", sort: num(r["Sort"] ?? "") ?? 99 }))
    .sort((a, b) => a.sort - b.sort);
}

// ---------------------------------------------------------------- Links

export const mapLink = (address: string, location = "") =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || location)}`;

export function initials(name: string) {
  const words = name.replace(/\b(HS|High School|High)\b/gi, "").trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}
