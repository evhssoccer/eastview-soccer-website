/** Date/time helpers. All club times are US Central (Georgetown, TX). */
export const TZ = "America/Chicago";

/** "Now" for the build. PREVIEW_DATE (e.g. 2027-02-10) lets you preview mid-season. */
export function now(): Date {
  const p = process.env.PREVIEW_DATE;
  return p ? new Date(p.includes("T") ? p : `${p}T12:00:00-06:00`) : new Date();
}

/** Parse sheet dates: 1/9/2027, 01/09/27, 2027-01-09. Returns [y, m, d] or null. */
export function parseDate(s: string): [number, number, number] | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return [y, +m[1], +m[2]];
  }
  return null;
}

/** Parse "7:15 PM", "7 pm", "19:15", "TBD". Returns [h, min] in 24h or null. */
export function parseTime(s: string): [number, number] | null {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ap = m[3]?.[0].toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  return h < 24 && min < 60 ? [h, min] : null;
}

/** Offset in minutes of TZ from UTC at a given instant. */
function tzOffset(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => +parts.find((p) => p.type === t)!.value;
  const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return (asUtc - at.getTime()) / 60000;
}

/** Build a Date for a wall-clock time in Central time. */
export function centralDate(y: number, mo: number, d: number, h = 0, mi = 0): Date {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const off = tzOffset(guess);
  const result = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffset(result); // correct across DST boundaries
  return off2 === off ? result : new Date(guess.getTime() - off2 * 60000);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });
export const fmtMonthDay = fmt({ month: "short", day: "numeric" });
export const fmtWeekday = fmt({ weekday: "short" });
export const fmtWeekdayLong = fmt({ weekday: "long" });
export const fmtMonthYear = fmt({ month: "long", year: "numeric" });
export const fmtFull = fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const fmtTime = fmt({ hour: "numeric", minute: "2-digit" });

/** YYYYMMDDTHHMMSSZ for calendar links. */
export const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Central-time calendar day key, e.g. 2027-01-09. */
export const dayKey = (d: Date) => fmt({ year: "numeric", month: "2-digit", day: "2-digit" })
  .format(d).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
