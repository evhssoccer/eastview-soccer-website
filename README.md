# East View Soccer website

Static site for the East View High School Soccer Booster Club, built with [Astro](https://astro.build).
All club data (games, events, rosters, coaches, board, sponsors) comes from a Google Sheet; nothing is
edited in this code for day-to-day updates.

## How updates reach the site

1. An approved volunteer edits the Google Sheet.
2. Every hour, a GitHub Action (`.github/workflows/deploy.yml`) rebuilds the site from the published
   sheet and uploads it to Bluehost (`public_html`) over SSH.
3. To publish right away: GitHub → **Actions** → **Deploy site** → **Run workflow**.

If the sheet can't be read, the build fails and the current site stays up unchanged.

## Sheet tabs

`Settings`, `Teams`, `Games`, `Events`, `Opponents`, `Players`, `Coaches`, `Board`, `Sponsors`.
A game row only needs Date, Time, Team, Opponent, and Home/Away; blank Location/Address/Tickets Link
fall back to the `Opponents` tab (away games) or the Home Stadium/Address/Tickets settings (home games). Instructions for
editors are on the sheet's **Read Me** tab. The starter file is `sheet-template/EastView-Soccer-Website-Data.xlsx`.

**Opponent logos:** drop a file in `public/images/opponents/` named after the school, without "HS"
(`Vista Ridge HS` → `vista-ridge.png`; `.svg`, `.png`, `.webp`, `.jpg` work). It's picked up automatically;
a link in the sheet's Logo column overrides it. Square, transparent PNGs around 200×200 px look best.

Rows only appear when **Show = Yes**. Rosters only show rows for the **Current Season** (Settings tab).
Anything in the sheet is publicly readable once it's published to the web, so don't put private info in it.

## Local development

```bash
npm install
npm run dev                                   # uses sample-data/*.csv
PREVIEW_DATE=2027-02-10 npm run dev           # pretend it's mid-season (shows results + upcoming)
SHEET_PUB_ID=2PACX-... npm run build          # build from the real sheet
node scripts/make-sample-data.mjs             # regenerate the sample CSVs (all made-up data)
```

## GitHub settings the deploy needs

| Kind | Name | Value |
|---|---|---|
| Variable | `SHEET_PUB_ID` | `2PACX-1vTtp4eeMgi9CHHhYRZIGCT_9qfldAubNwXB-Y_D4ju1Bm5MLuiQDL_HU2Kt5XRBz2m3PgvYbUrfqzat` (from the sheet's *Publish to web* link) |
| Variable | `ROSTER_PUB_ID` | `2PACX-1vQn2OYI_MSKwMJTWoM6hNrJO1GT8nZAsUbjTMsldGaV9NFt2Mj0Hyzgt6GCGbZ92f8ZNFfMlRjm4bAS` (the separate *2026-2027-Rosters* sheet; leave unset to use the main sheet's Players tab) |
| Variable | `DEPLOY_PATH` | `mockup.eastviewsoccer.com` or `public_html` (live site). Leave unset to pause deploys. |
| Variable | `DEPLOY_HOST` | `162.241.217.192` |
| Variable | `DEPLOY_USER` | `eastvie6` |
| Variable | `DEPLOY_KNOWN_HOSTS` | `162.241.217.192 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICVL1ymHRhZX7lLzR7gvfN8AUA2ezNIs9oDI28XPtKLo` |
| Secret | `DEPLOY_SSH_KEY` | Private deploy key whose public half is authorized in Bluehost → SSH Management |

## Security notes

- The site is plain HTML/CSS with a little JavaScript; `public/.htaccess` blocks PHP from running.
- The previous WordPress site was hacked (casino spam) and was removed on 2026-10-13.
