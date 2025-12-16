# ucalgary-guessr
A Guessr game based on the University of Calgary — try to guess the location of a photo!

---

## Features

- 📍 Pan-and-zoom campus map using Leaflet
- 🖼️ Randomised 5-image game pulled from a SQLite database
- 🧮 Server-side scoring based on pixel distance between the player’s guess and the true location
- 📊 Running total score with “round complete” summary and restart
- 💻 Simple Node/Express backend + vanilla JS frontend (no framework)

---

## Tech stack

- **Frontend:** HTML, CSS, JavaScript, [Leaflet](https://leafletjs.com/)
- **Backend:** Node.js, Express
- **Database:** SQLite (via `better-sqlite3`)

---

## Getting started

### 1. Prerequisites

- Node.js (latest version recommended)
- npm (comes with Node)

### 2. Install dependencies

From the project root:

```bash
npm install
````

### 3. Initialise the SQLite database

This creates `server/db/dev.db` and seeds it with some sample photos + coordinates:

```bash
npm run db:init
```

Note: **If you change `schema.sql` or `seed.sql`, run the above command again to rebuild the dev DB.**

### 4. Run the dev server

```bash
npm run dev
```

Then open:

> [http://localhost:3000](http://localhost:3000)

You should see the game, with a campus photo on the left and the campus map on the right.

---

## How the game works

1. A round consists of 5 random photos pulled from the `photos` table.
2. For each photo:

   * Click on the campus map to place your guess.
   * Hit **Make guess**.
   * The backend scores your guess based on pixel distance to the stored answer.
3. After the 5th photo you get:

   * A “round complete” message.
   * Your final total score.
   * A **Restart** button to play a new random round.

---

## Repo structure
```
public/                            # Front-end static assets served by the app
  index.html                       # Main HTML page that renders the game shell

  assets/                          # All static images used by the frontend
    logos/
      logo.png                     # UCTC logo shown in the top-right header
    maps/
      ucalgary-campus.png          # Campus map image used as the Leaflet overlay
    photos/                        # Photos used in the game
      (...)
  css/
    styles.css                     # Global styles for layout, cards, buttons, map widget, etc.

  js/
    api.js                         # Small client API layer for calling the backend (rounds, guesses)
    gameState.js                   # Central game state: current round/image, scores, used-image tracking
    main.js                        # App entrypoint: wires events, orchestrates rounds, guesses, and UI
    map.js                         # Leaflet map setup + markers + lines + hover-resize handling
    ui.js                          # DOM helpers: updating titles, score panel, buttons, and scene image

server/                            # Backend (Node/Express) that serves the API + static files
  server.js                        # Express app bootstrap: mounts routes, serves /public, starts server

  config/
    db.js                          # Database configuration/connection (SQLite) shared by the server

  db/
    dev.db                         # Local SQLite database used in development (not checked into prod)
    init.js                        # Script to create and seed dev.db from schema.sql + seed.sql
    schema.sql                     # SQL schema definitions (tables for photos, rounds, etc.)
    seed.sql                       # Seed data for the photos table (image paths, ids, coordinates)

  models/
    photosModel.js                 # Data-access helpers for the photos table (random photo selection, etc.)

  routes/
    rounds.js                      # API endpoints for rounds: fetch random round, submit guess, return score

  utils/
    scoring.js                     # Scoring logic: distance calculations and points awarded per guess
```

---

## Adding or changing photos

1. **Add the image file** to:

   ```text
   public/assets/photos/
   ```

2. **Add a row to `server/db/seed.sql`:**

   ```sql
   INSERT OR IGNORE INTO photos (image_id, image_path, answer_x, answer_y) VALUES
     ('new-spot-01', '/assets/photos/new-spot-01.jpg',  X_COORD, Y_COORD);
   ```

   * `image_id`: a unique string slug used by the API.
   * `image_path`: relative path under `public/`.
   * `answer_x`, `answer_y`: the correct location in **map pixel coordinates**
     (x = horizontal / “lng”, y = vertical / “lat”, based on the map image).

3. Re-run:

   ```bash
   npm run db:init
   ```

4. Restart the dev server and the new photo will be part of the random pool.

---

## TODOs

* Improve CSS so site looks prettier
* Admin UI for adding/editing photo locations without touching SQL
