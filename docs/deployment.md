# Configuration and deployment

## Database

Leave `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` empty to develop with local SQLite at `server/db/dev.db`, or set `GUESSR_DB_PATH` to a separate SQLite file. To use your own Turso database, set both values in `.env`:

```dotenv
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=paste-your-token-here
```

Keep these values on the server. Production requires a remote URL and token.

`npm run db:init` creates missing tables, applies additive migrations, and adds bundled photos. It preserves existing accounts, scores, and sessions and is safe to run again. Normal startup applies the same initialization, including for an empty Turso database. Initialization uses your configured database; it does not copy records from an existing local SQLite database to Turso.

## Email

Leave `EMAIL_MODE=console` for local development: login and password-reset links are printed in the server terminal. To send real email, use `EMAIL_MODE=smtp` and fill in the SMTP settings in `.env`. Set `APP_BASE_URL` to the address where the app is running so emailed links point to the right place.

## Deploying on Vercel

The root `app.js` exports the Express application for Vercel. Static files are served from `public/`. Set these server environment variables in **Vercel project → Settings → Environment Variables**, then deploy:

- `TURSO_DATABASE_URL`: your remote Turso database URL.
- `TURSO_AUTH_TOKEN`: your database token.
- `SESSION_SECRET`: a long random secret shared across all instances.
- `APP_BASE_URL`: your deployed HTTPS URL.
- `EMAIL_MODE`: `smtp`, with the SMTP settings, or explicitly `console` while testing email flows through server logs.

Accounts, scores, login tokens, and browser sessions all use Turso, so the app does not depend on a writable deployment filesystem. Use a separate Turso database for preview deployments if they should not share production data.

A deployment must include the photo collection under `public/assets/photos/`. Because this repository does not contain it, deploy from a copy that has the photos in place (see [Managing game photos](photos.md)).

## Repository hygiene

Keep credentials in local environment files or your deployment provider's secret settings. Commit only placeholder values in `.env.example`. Never commit user databases, database exports, SQLite WAL/SHM/journal sidecars, session data, login/reset links, private keys, or logs. Test fixtures must contain synthetic data.
