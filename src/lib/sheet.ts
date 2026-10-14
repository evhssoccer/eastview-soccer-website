/**
 * Loads tabs from the club's Google Sheet ("File > Share > Publish to web").
 *
 * Source, in order:
 *   1. SHEET_PUB_ID env var, or "publishedId" in sheet.config.json → the live Google Sheet
 *      Players can come from a separate roster spreadsheet: ROSTER_PUB_ID / "rosterPublishedId"
 *      (its "Players" tab, else a tab with "Roster" in the name, else its first tab).
 *   2. SAMPLE_DATA=1 (or `astro dev` with no sheet configured) → sample-data/<Tab>.csv
 * A production build with no sheet configured fails rather than publishing sample data.
 */
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { csvToRecords } from "./csv";

export type Row = Record<string, string>;

const ROOT = process.cwd();

interface SheetConfig {
  publishedId?: string;
  rosterPublishedId?: string;
  /** Optional manual tab → gid map; normally discovered from the published sheet. */
  gids?: Record<string, string>;
}

function config(): SheetConfig {
  const file = join(ROOT, "sheet.config.json");
  const fromFile: SheetConfig = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  return {
    ...fromFile,
    publishedId: process.env.SHEET_PUB_ID || fromFile.publishedId,
    rosterPublishedId: process.env.ROSTER_PUB_ID || fromFile.rosterPublishedId,
  };
}

const pubBase = (id: string) => `https://docs.google.com/spreadsheets/d/e/${id}`;

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw new Error(`Failed to fetch ${url}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const gidMaps = new Map<string, Promise<Record<string, string>>>();

/** Read tab names and gids (in tab order) from a published sheet's HTML view. */
function discoverGids(id: string): Promise<Record<string, string>> {
  if (!gidMaps.has(id)) gidMaps.set(id, fetchText(`${pubBase(id)}/pubhtml`).then((html) => {
    const map: Record<string, string> = {};
    // Current format: items.push({name: "Games", pageUrl: "...", gid: "123", ...})
    for (const m of html.matchAll(/name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:\s*"[^"]*",\s*gid:\s*"(\d+)"/g)) {
      map[JSON.parse(`"${m[1]}"`).trim()] = m[2];
    }
    // Older format: <a onclick="switchToSheet('123')">Games</a>
    for (const m of html.matchAll(/switchToSheet\('(\d+)'\)[^>]*>([^<]+)</g)) {
      map[m[2].trim()] ??= m[1];
    }
    return map;
  }));
  return gidMaps.get(id)!;
}

const csvUrl = (id: string, gid: string) => `${pubBase(id)}/pub?gid=${gid}&single=true&output=csv`;

const OPTIONAL_TABS = ["Opponents", "Sponsors"];

const cache = new Map<string, Promise<Row[]>>();

export function loadTab(tab: string): Promise<Row[]> {
  if (!cache.has(tab)) cache.set(tab, load(tab));
  return cache.get(tab)!;
}

async function load(tab: string): Promise<Row[]> {
  const cfg = config();
  if (tab === "Players" && cfg.rosterPublishedId) {
    const tabs = Object.entries(await discoverGids(cfg.rosterPublishedId));
    const pick = tabs.find(([n]) => n === "Players") ?? tabs.find(([n]) => /roster/i.test(n)) ?? tabs[0];
    // A single-tab document may not list its tabs; its first sheet is then gid 0.
    return csvToRecords(await fetchText(csvUrl(cfg.rosterPublishedId, pick?.[1] ?? "0")));
  }
  if (cfg.publishedId) {
    const gid = cfg.gids?.[tab] ?? (await discoverGids(cfg.publishedId))[tab];
    if (gid === undefined) {
      // Tabs added after launch are optional so an older copy of the sheet still builds.
      if (OPTIONAL_TABS.includes(tab)) return [];
      throw new Error(`Tab "${tab}" was not found in the published Google Sheet. Check the tab name and that the whole document is published.`);
    }
    return csvToRecords(await fetchText(csvUrl(cfg.publishedId, gid)));
  }

  const useSample = process.env.SAMPLE_DATA === "1" || import.meta.env.DEV;
  if (!useSample) {
    throw new Error("No Google Sheet configured. Set SHEET_PUB_ID (or sheet.config.json), or SAMPLE_DATA=1 for a sample build.");
  }
  const file = join(ROOT, "sample-data", `${tab}.csv`);
  return existsSync(file) ? csvToRecords(await readFile(file, "utf8")) : [];
}

export const usingSampleData = () => !config().publishedId;
