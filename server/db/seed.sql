-- server/db/seed.sql

INSERT OR IGNORE INTO photos (image_id, image_path, answer_x, answer_y) VALUES
  ('atrium-01', '/assets/photos/atrium-admin.jpeg', 824,  306),
  ('eeel-01',  '/assets/photos/EEEL-facing-ES.jpg',  758, 491),
  ('mh-01', '/assets/photos/MH-south.jpg', 637,  270),
  ('tfdl-01',  '/assets/photos/tfdl-floor-2.jpg',  692, 263),
  ('terminal-01',  '/assets/photos/31st-terminal.jpg',  678, 547);
