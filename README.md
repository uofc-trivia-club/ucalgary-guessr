# UCalgaryGuessr

UCalgaryGuessr is a photo-based location guessing game set at the University of Calgary. Study a campus photo, choose a building or drop a pin on the interactive map, and see how close you were!

The game includes **276 registered photos**: **265** eligible for Daily and random Play, plus **11** reserved exclusively for Weekly.

## Game modes

| Mode | How it works |
| --- | --- |
| **Play** | Five random photos per round, with up to **25,000 points** available. Start another round whenever you like. |
| **Weekly** | One shared randomly chosen photo each week, with one attempt, up to **5,000 points**, and a separate leaderboard. Resets Sunday at **00:00 Mountain Time**. |
| **Daily** | One shared photo each day, with one attempt and up to **5,000 points**. Compete on the daily leaderboard or play as a guest. |

Daily challenges reset at **00:00 Mountain Time** every day. Weekly challenges run Sunday-to-Sunday using `America/Edmonton`, including daylight saving time. The weekly photo is randomly selected from `public/assets/photos/weekly-images/` once, then stored so everyone plays the same photo. Weekly photos are excluded from Daily and random Play. Sign in before playing for a ranked attempt; a guest result stays unranked after the answer has been revealed. Daily and Weekly have independent timers that count only time spent on their respective visible challenge pages. It pauses on the main page, during random rounds, and while the tab is hidden, then resumes when you return in the same tab. Leaderboard ties are broken by distance, then active completion time.

## Playing and scoring

1. Look at the photo for clues.
2. Select a building or place a pin on the ArcGIS campus map. You can change your selection before submitting.
3. Press **Submit guess** to reveal the correct location, distance, and score.
4. Continue through the round, or share your completed Daily or Weekly result.

Selecting the correct building earns **5,000 points**. Other guesses earn points based on geographic distance in metres, with closer guesses rewarded more strongly and scores reaching zero at 1,000 metres. Building guesses are measured between building centres.

## Features

- **Interactive result maps:** exact matches use a single marker; other guesses show both locations connected by a line, with an optional map key.
- **Clear results:** score, location, distance, and challenge completion time and ranking, plus a brief celebration for perfect guesses that respects reduced-motion preferences.
- **Challenge sharing:** copy your score with red and yellow emoji circles showing how well you did.
- **Guest play and accounts:** sign up or log in with a password, use an emailed login link, or recover a forgotten password.
- **Saved Daily and Weekly results:** return to a completed challenge to review your result. Ranked results are saved to your account; guest results remain available in the same browser session.
- **Photo zoom:** scroll over gameplay photos to zoom from 1× to 4× toward the cursor. Click and hold to pan a zoomed photo in any direction. Photos stay clipped inside their frame and reset when the photo changes.
- **Photo interaction protection:** gameplay photos disable context menus, copying, and dragging in every mode to deter casual filename discovery. Browser inspection and screenshots remain possible.
- **Desktop and mobile layouts:** side-by-side photo and map on desktop, Photo / Map tabs on smaller screens, and full photos displayed without cropping away clues.

## Run locally

Use **Node.js 22 or 24** with npm. From the repository root:

```bash
npm install
```

Copy [`.env.example`](.env.example) to `.env` and replace `SESSION_SECRET` with a long random value. Leave `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` empty to develop with local SQLite. To use your own Turso database, set both values:

```dotenv
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=paste-your-token-here
```

Keep these values on the server. `.env` is ignored by Git. Then initialise the database and start the server:

```bash
npm run db:init
npm start
```

Open [http://localhost:3000](http://localhost:3000). The campus map loads through ArcGIS and requires an internet connection.

> **Game photos are not included in this repository.** The photo catalog is registered in the database, so the game runs, but photos will not load until you add the WebP files under `public/assets/photos/` (see [Adding photos](#adding-photos)). That directory is ignored by Git so photos are never committed by accident.

`npm run db:init` creates missing tables, applies additive migrations, and adds bundled photos. It preserves existing accounts, scores, and sessions and is safe to run again. Normal startup applies the same initialization, including for an empty Turso database. Initialization uses your configured database; it does not copy records from an existing local SQLite database to Turso.

To develop offline, leave `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` empty to use `server/db/dev.db`, or set `GUESSR_DB_PATH` to a separate SQLite file. Production requires a remote URL and token.

For development with automatic server restarts, use `npm run dev` instead of `npm start`.

### Deploy on Vercel

The root `app.js` exports the Express application for Vercel. Static files remain in `public/`. Set these server environment variables in **Vercel project → Settings → Environment Variables**, then deploy:

- `TURSO_DATABASE_URL`: your own remote Turso database URL.
- `TURSO_AUTH_TOKEN`: your database token.
- `SESSION_SECRET`: a long random secret shared across all instances.
- `APP_BASE_URL`: your deployed HTTPS URL.
- `EMAIL_MODE`: `smtp`, with the SMTP settings below, or explicitly `console` while testing email flows through server logs.

Accounts, scores, login tokens, and browser sessions all use Turso, so the app does not depend on a writable deployment filesystem. Use a separate Turso database for preview deployments if they should not share production data.

A deployment must include the photo collection under `public/assets/photos/`. Because this repository does not contain it, deploy from a copy that has the photos in place.

### Email configuration

Leave `EMAIL_MODE=console` for local development: login and password-reset links are printed in the server terminal. To send real email, use `EMAIL_MODE=smtp` and fill in the SMTP settings in `.env`. Set `APP_BASE_URL` to the address where the app is running so emailed links point to the right place.

## Built with

- **Frontend:** HTML, CSS, vanilla JavaScript, and the ArcGIS Maps SDK for JavaScript.
- **Backend:** Node.js and Express, with server-side scoring and session-based play.
- **Storage:** Turso/libSQL through `@libsql/client` for photos, accounts, Daily results, login tokens, and sessions. Local SQLite files are supported for development and tests; `better-sqlite3` is used only by test fixtures.

The frontend is served directly by Express; there is no separate frontend build step.

## Development checks

```bash
npm test
npx playwright install chromium
npm run test:e2e
```

The tests cover scoring, game rules, accounts, Daily results, map interactions, and desktop/mobile gameplay. Browser tests use an isolated database and a controlled ArcGIS fixture, so they do not reset your development data.

Tests that check the full photo collection are skipped when `public/assets/photos/` is not present. Add the photos locally to run them.

## Adding photos

The game uses the WebP images in `public/assets/photos/`. This directory is ignored by Git and its contents are not distributed with this repository; do not force-add photos. Keep original larger images outside `public/`, for example in the ignored `.local/photo-originals/` directory, with a separate private backup. Everything under `public/` can be served to visitors.

Before adding an image, verify permission to display it on the deployed website. Review visible people, documents, screens, and embedded metadata for private information. Record its source, creator, license or permission, and any attribution requirements. See [asset terms](ASSET-LICENSE.md).

Organise photos by physical proximity and recognisable campus complexes, rather than strictly by faculty. Store each image under `public/assets/photos/<group>/classrooms/` or `public/assets/photos/<group>/general/`, preserving its classroom/general classification when reorganising it.

| Campus group | Building codes |
| --- | --- |
| `engineering` | ENA, ENB, ENC, END, ENE, ENF, ENG |
| `technology` | CCIT, ICT, EEL (also spelled EEEL in filenames) |
| `sciences` | BI, ES, MS, SA, SB, SS, ST, TRB |
| `craigie` | CHC, CHD, CHE, CHF, CHG |
| `arts` | AB, RT, RC |
| `education` | EDC, EDT |
| `business` | SH, MTH |
| `macewan` | MH, MSC |
| `taylor` | TI, TFDL |
| `hunters` | HNSC, MT |
| `kinesiology` | KNA, KNB, OO |
| `admins` | AD, CC, PF, MFH |

Keep residence photos and Dining Centre (`DC`) under `residencies/general/` (for example, `CR-CrowsnestHall-CFH.webp`). Keep `outdoors/` as the existing miscellaneous outdoor collection. These mappings also apply to future photos of building codes that currently have no images in the game. Keep unlisted building codes separate until their placement is agreed. Folder organisation alone does not register new photos in the game.

Start every photo filename with its correct map building code. Off-main-campus photos live in `non-main campus/` and follow the same rule. `SS` and `ST` in `sciences/` and `weekly-images/` mean Social Sciences and Science Theatres; other reused or unknown codes need an explicit answer before registration. Outdoor answers retain their original buildings and scoring coordinates.

Put Weekly-only photos in `weekly-images/`. All other registered photos are available for Daily (one per day) and random Play. Do not copy Weekly images into other folders: catalog generation rejects identical content across the two pools.

After adding or moving photos, regenerate the registrations without accessing a database:

```bash
node scripts/generate-photo-seed.js
```

The generator uses the canonical map names and coordinates in `server/data/campus-buildings.json` and writes `server/db/seed.sql`. Registered photo IDs are pinned in `server/data/photo-ids.json`; update the corresponding path there when moving or renaming an existing photo, preserving its ID. Restarting the server or running `npm run db:init` applies the catalog and pool migration without replacing photo rows, accounts, scores, custom photos, or existing dated challenge assignments. Previously assigned challenges stay fixed; the pool rules apply to newly assigned challenges.

## Repository hygiene and licensing

Keep credentials in local environment files or your deployment provider's secret settings. Commit only placeholder values in `.env.example`. Never commit user databases, database exports, SQLite WAL/SHM/journal sidecars, session data, login/reset links, private keys, or logs. Test fixtures must contain synthetic data. Dependencies, generated test output, local deployment settings, and `.local/` are ignored.

The photo catalog, seed SQL, and tests include answer mappings. Public source access therefore exposes those answers; hiding filenames or disabling browser interactions does not keep them secret.

Source code is licensed under [ISC](LICENSE). Images, fonts, maps, logos, and other assets have separate terms described in [ASSET-LICENSE.md](ASSET-LICENSE.md). The code license does not grant permission to reuse those assets.
