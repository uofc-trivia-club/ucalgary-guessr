# ucalgary-guessr
A Guessr game based on the University of Calgary — try to guess the location of a photo!

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
      31st-terminal.jpg
      atrium-admin.jpeg
      EEEL-facing-ES.jpg
      MH-south.jpg          
      tfdl-floor-2.jpg      

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