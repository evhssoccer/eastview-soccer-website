// Generates sample-data/*.csv for local previews. All names and scores are made up.
// Run: node scripts/make-sample-data.mjs   then preview with PREVIEW_DATE=2027-02-10 npm run dev
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];
const csv = (rows) => rows.map((r) => r.map((v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(",")).join("\n") + "\n";
const write = (name, rows) => writeFileSync(`sample-data/${name}.csv`, csv(rows));
mkdirSync("sample-data", { recursive: true });

const SEASON = "2026-2027";
const TEAMS = ["Varsity Women", "JV A Women", "JV B Women", "Varsity Men", "JV A Men", "JV B Men"];
const HOME = ["Patriot Stadium", "4490 E University Ave, Georgetown, TX 78626"];
// [school, stadium, address, mascot, district?]. 6A District 24 (2026-27): Austin, Vandegrift,
// Cedar Park, Vista Ridge, East View, Hutto, Leander, Rouse. Stadiums/addresses here are placeholders for the preview only.
const OPP = [
  ["Round Rock", "Kelly Reeves Athletic Complex", "1651 Gattis School Rd, Round Rock, TX", "Dragons", false],
  // Non-district opponents on the 2026-27 MaxPreps schedule (venues unknown: tournaments / TBD).
  ["Cedar Ridge", "", "", "Raiders", false, true],
  ["Chaparral", "", "", "Bobcats", false, true],
  ["San Angelo Central", "", "", "Bobcats", false, true],
  ["McKinney Boyd", "", "", "Broncos", false, true],
  ["Cedar Creek", "", "", "Eagles", false, true],
  ["Pearland", "", "", "Oilers", false, true],
  ["Hebron", "", "", "Hawks", false, true],
  ["Austin", "House Park", "1301 Shoal Creek Blvd, Austin, TX", "Maroons", true],
  ["Vandegrift", "Vandegrift HS Stadium", "9500 McNeil Dr, Austin, TX", "Vipers", true],
  ["Cedar Park", "Gupton Stadium", "2150 Cypress Creek Rd, Cedar Park, TX", "Timberwolves", true],
  ["Vista Ridge", "Gupton Stadium", "2150 Cypress Creek Rd, Cedar Park, TX", "Rangers", true],
  ["Hutto", "Hutto Memorial Stadium", "101 FM 685, Hutto, TX", "Hippos", true],
  ["Leander", "Bible Stadium", "1101 S Leander Rd, Leander, TX", "Lions", true],
  ["Rouse", "Bible Stadium", "1101 S Leander Rd, Leander, TX", "Raiders", true],
];
// One non-district game, then a double round-robin of district play (home/away flips in round 2).
const DISTRICT = OPP.filter((o) => o[4] && !o[5]).map((o) => o[0]);
const SCHEDULE = [
  ["Round Rock", true],
  ...DISTRICT.map((o, k) => [o, k % 2 === 0]),
  ...DISTRICT.map((o, k) => [o, k % 2 === 1]),
];
const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
const PLAYED_BEFORE = new Date(2027, 1, 10);

const seniorNight = {};
const games = [["Season", "Date", "Time", "Team", "Opponent", "Home/Away", "Location", "Address", "District Game",
  "Special", "Status", "EV Score", "Opp Score", "Tickets Link", "Watch Link", "Recap Link", "Opponent Logo", "Notes", "Show"]];
for (const [gender, firstDay] of [["Women", new Date(2027, 0, 8)], ["Men", new Date(2027, 0, 8)]]) {
  const isHome = ([, womenHome]) => womenHome === (gender === "Women");
  const lastHome = SCHEDULE.findLastIndex(isHome);
  seniorNight[gender] = fmt(new Date(firstDay.getTime() + (Math.floor(lastHome / 2) * 7 + (lastHome % 2) * 4) * 864e5));
  SCHEDULE.forEach(([opp, womenHome], i) => {
    // Fridays and Tuesdays, starting Fri Jan 8.
    const day = new Date(firstDay.getTime() + (Math.floor(i / 2) * 7 + (i % 2) * 4) * 864e5);
    // Both programs play the same school the same night: when the women are home, the men are away.
    const home = womenHome === (gender === "Women");
    const levels = [["JV B", "4:15 PM"], ["JV A", "5:30 PM"], ["Varsity", "7:15 PM"]];
    for (const [level, time] of levels) {
      const team = `${level} ${gender}`;
      const played = day < PLAYED_BEFORE;
      const ev = played ? Math.floor(rand() * 4) : "", op = played ? Math.floor(rand() * 3) : "";
      const special = level === "Varsity" && i === lastHome ? "Senior Night" : "";
      games.push([SEASON, fmt(day), time, team, `${opp} HS`,
        // Location, Address, District, and Tickets Link are left blank: they come from the
        // Opponents tab (away games) or Settings (home games).
        home ? "Home" : "Away", "", "", "", special,
        played ? "Final" : i === 11 && level === "JV B" ? "Postponed" : "Scheduled", ev, op,
        "",
        level === "Varsity" ? "https://www.nfhsnetwork.com/" : "",
        played && level === "Varsity" ? "https://www.maxpreps.com/" : "", "", "", "Yes"]);
    }
  });
}
// Prefer the real schedule pulled from MaxPreps when present; otherwise use the generated one.
const MAXPREPS = "sheet-import/maxpreps-games-2026-27.csv";
if (existsSync(MAXPREPS)) copyFileSync(MAXPREPS, "sample-data/Games.csv");
else write("Games", games);

write("Opponents", [["School", "Mascot", "Stadium", "Address", "Tickets Link", "Logo", "District Opponent"],
  ...OPP.map(([school, stadium, address, mascot, district]) => [`${school} HS`, mascot, stadium, address,
    `https://gofan.co/app/school/TX-${school.replace(/ /g, "")}`, "", district ? "Yes" : "No"])]);

write("Settings", [["Setting", "Value", "Notes"], ["Current Season", SEASON, ""], ["Coming Up Days", 14, ""],
  ["Home Events To Show", 4, ""], ["Club Email", "eastviewsoccer@gmail.com", ""],
  ["Announcement", "Meet the Patriots is Nov 14. Grab your tickets!", ""], ["Announcement Link", "/events/", ""],
  ["Home Stadium", HOME[0], ""], ["Home Address", HOME[1], ""], ["Home Tickets Link", "https://gofan.co/app/school/TX-EastView", ""],
  ["District Name", "6A District 24", ""]]);

write("Teams", [["Team", "Gender", "Level", "Sort", "Show"],
  ...TEAMS.map((t, i) => [t, t.includes("Women") ? "Women" : "Men", t.replace(/ (Wo)?men$/i, ""), i + 1, "Yes"])]);

write("Events", [["Date", "End Date", "Start Time", "End Time", "Title", "Teams", "Location", "Address", "Details", "Link", "Link Text", "Image", "Show"],
  ["11/14/2026", "", "6:00 PM", "8:00 PM", "Meet the Patriots", "All", "East View HS Cafeteria", HOME[1], "Kick off the season with dinner and team introductions.", "https://square.link/", "Buy Tickets", "", "Yes"],
  ["11/16/2026", "11/18/2026", "", "", "Tryouts", "All", "Patriot Stadium", HOME[1], "Tryouts for all six teams. Bring a completed physical.", "", "", "", "Yes"],
  ["12/5/2026", "", "9:00 AM", "1:00 PM", "Concessions Volunteer Training", "All", "Patriot Stadium", HOME[1], "Learn the ropes before the first home game.", "https://www.signupgenius.com/", "Sign Up", "", "Yes"],
  [seniorNight.Men, "", "6:30 PM", "", "Men's Senior Night", "Men", "Patriot Stadium", HOME[1], "Honoring our senior players before the varsity game.", "", "", "", "Yes"],
  [seniorNight.Women, "", "6:30 PM", "", "Women's Senior Night", "Women", "Patriot Stadium", HOME[1], "Honoring our senior players before the varsity game.", "", "", "", "Yes"],
  ["4/22/2027", "", "6:00 PM", "8:30 PM", "End of Season Banquet", "All", "Georgetown Community Center", "445 E Morrow St, Georgetown, TX", "$20 per ticket. Players are free but need a ticket for a meal.", "https://square.link/", "Buy Tickets", "", "Yes"]]);

const FIRST = ["Ava", "Mia", "Sofia", "Emma", "Isabella", "Camila", "Harper", "Lucia", "Elena", "Nora", "Zoe", "Lily",
  "Liam", "Mateo", "Noah", "Diego", "Lucas", "Ethan", "Gabriel", "Leo", "Adrian", "Owen", "Julian", "Caleb"];
const LAST = ["Garcia", "Martinez", "Smith", "Johnson", "Lopez", "Brown", "Hernandez", "Davis", "Rodriguez", "Wilson",
  "Gonzalez", "Moore", "Perez", "Taylor", "Ramirez", "Anderson", "Torres", "Thomas", "Flores", "Jackson", "Rivera", "White"];
const players = [["Season", "Team", "Number", "First Name", "Last Name", "Grad Year", "Position", "Show"]];
for (const team of TEAMS) {
  const women = team.includes("Women");
  const nums = ["0", "00", ...Array.from({ length: 24 }, (_, i) => String(i + 1))].sort(() => rand() - 0.5).slice(0, 20);
  for (const n of nums) {
    const firsts = women ? FIRST.slice(0, 12) : FIRST.slice(12);
    const grad = team.startsWith("Varsity") ? pick([2027, 2027, 2028, 2028, 2029]) : team.startsWith("JV A") ? pick([2028, 2029, 2029, 2030]) : pick([2029, 2030, 2030]);
    players.push([SEASON, team, n, pick(firsts), pick(LAST), grad, n === "0" || n === "00" ? "GK" : pick(["D", "D", "M", "M", "F"]), "Yes"]);
  }
}
write("Players", players);

write("Coaches", [["Name", "Title", "Teams", "Email", "Photo", "Bio", "Sort", "Show"],
  ["Sierrah Soto", "Head Coach", "Varsity Women", "sotos@georgetownisd.org", "", "", 1, "Yes"],
  ["Jessica Crawford", "Assistant Coach", "Varsity Women, JV A Women, JV B Women", "crawfordj@georgetownisd.org", "", "", 2, "Yes"],
  ["Ryan Killian", "Head Coach", "Varsity Men", "", "", "", 3, "Yes"],
  ["Valente Solorzano", "Assistant Coach", "Varsity Men, JV A Men", "", "", "", 4, "Yes"],
  ["John Brockway", "Assistant Coach", "JV A Men, JV B Men", "", "", "", 5, "Yes"]]);

write("Board", [["Season", "Role", "Name", "Email", "Sort", "Show"],
  ...[["Co-President", "Marcos Gonzalez"], ["Co-President", "Chrystal Gonzalez"], ["Vice President", "Andy Brazell"],
    ["Treasurer", "Renee Harrison"], ["Secretary", "Charity Boff"], ["Member at Large", "Shane Boff"],
    ["Concessions Coordinator", "Anai Cantu"], ["Volunteer Coordinator", "Devina Coffman-Romick"],
    ["Webmaster / Social Media", "Joseph Barb"]].map(([r, n], i) => ["2026-2027", r, n, "", i + 1, "Yes"])]);

write("Sponsors", [["Name", "Level", "Website", "Logo", "Sort", "Show"],
  // No sponsors yet: the Sponsors sections stay hidden until a row with Show = Yes is added.
]);

console.log("sample-data written:", games.length - 1, "games,", players.length - 1, "players");
