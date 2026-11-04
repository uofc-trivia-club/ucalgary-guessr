-- server/db/seed.sql
-- Geographic answers for all bundled campus photos.
--
-- Building-aware answers use the building name shown by the authorised ArcGIS map.
-- If the ArcGIS layer uses a different spelling, update answer_building_name to match it.
-- answer_building_latitude/longitude are the canonical scoring anchors for the building;
-- these centres match the campus polygon-centroid snapshot in server/data.
-- Photos without a building answer continue to use ordinary point-distance scoring.
--
-- Daily challenges do not need to be pre-seeded. On the first request for a date,
-- dailyModel.js assigns one photo deterministically and stores that assignment in
-- daily_challenges. If you want to curate a particular date manually, insert that
-- date/image pair into daily_challenges before the first request for that day.

INSERT OR IGNORE INTO photos (
  image_id,
  image_path,
  answer_latitude,
  answer_longitude,
  answer_building_name,
  answer_building_latitude,
  answer_building_longitude
) VALUES
  ('atrium-01', '/assets/photos/atrium-admin.jpeg',  51.078170, -114.127150, 'Administration',                         51.07818792, -114.12710165),
  ('eeel-01', '/assets/photos/EEEL-facing-ES.jpg',   51.081080, -114.129440, 'Energy Environment Experiential Learning', 51.08107265, -114.12946261),
  ('mh-01', '/assets/photos/MH-south.jpg',           51.078570, -114.130450, 'MacEwan Hall',                            51.07859427, -114.13046071),
  ('tfdl-01', '/assets/photos/tfdl-floor-2.jpg',      51.077430, -114.129970, 'Taylor Family Digital Library',           51.07745172, -114.12989818),
  ('terminal-01', '/assets/photos/31st-terminal.jpg', 51.081731, -114.129957, 'Energy Environment Experiential Learning', 51.08107265, -114.12946261),
  ('bi-01', '/assets/photos/BI.jpg', 51.07993429, -114.12560990, 'Biological Sciences', 51.07993429, -114.12560990),
  ('cr-01', '/assets/photos/CrowsnestHall.jpg', 51.07917770, -114.13493205, 'Crowsnest Hall', 51.07917770, -114.13493205),
  ('eeel-02', '/assets/photos/EEEL.jpg', 51.08107265, -114.12946261, 'Energy Environment Experiential Learning', 51.08107265, -114.12946261),
  ('ena-01', '/assets/photos/ENA.jpg', 51.08029647, -114.13142676, 'Engineering Block A', 51.08029647, -114.13142676),
  ('enc-01', '/assets/photos/ENC.jpg', 51.08084054, -114.13189756, 'Engineering Block C', 51.08084054, -114.13189756),
  ('ene-01', '/assets/photos/ENE.jpeg', 51.07994458, -114.13249381, 'Engineering Block E', 51.07994458, -114.13249381),
  ('edc-01', '/assets/photos/Education.jpeg', 51.07672112, -114.12655150, 'Education Classroom Block', 51.07672112, -114.12655150),
  ('kna-01', '/assets/photos/KNB-rocks.jpg', 51.07795659, -114.13374001, 'Kinesiology Block B', 51.07795659, -114.13374001),
  ('kna-02', '/assets/photos/KNA (2).jpg', 51.07712939, -114.13296332, 'Kinesiology Block A', 51.07712939, -114.13296332),
  ('knb-01', '/assets/photos/KNB.jpg', 51.07795659, -114.13374001, 'Kinesiology Block B', 51.07795659, -114.13374001),
  ('knb-02', '/assets/photos/KNA-cafe.jpg', 51.07712939, -114.13296332, 'Kinesiology Block A', 51.07712939, -114.13296332),
  ('mfh-01', '/assets/photos/MFH 160.jpg', 51.07706237, -114.12832517, 'Murray Fraser Hall', 51.07706237, -114.12832517),
  ('mt-01', '/assets/photos/MT.jpg', 51.07747931, -114.12886686, 'MacKimmie Tower', 51.07747931, -114.12886686),
  ('mth-01', '/assets/photos/MathisonHall.jpeg', 51.07677619, -114.12469203, 'Mathison Hall', 51.07677619, -114.12469203),
  ('rc-01', '/assets/photos/RC.jpg', 51.07638246, -114.13149132, 'Rozsa Centre', 51.07638246, -114.13149132),
  ('sb-01', '/assets/photos/SB.jpg', 51.07938608, -114.12944130, 'Science B', 51.07938608, -114.12944130),
  ('ss-01', '/assets/photos/SS.jpg', 51.07913269, -114.12695816, 'Social Sciences', 51.07913269, -114.12695816),
  ('tfdl-02', '/assets/photos/TFDL.jpg', 51.07745172, -114.12989818, 'Taylor Family Digital Library', 51.07745172, -114.12989818),
  ('ti-01', '/assets/photos/TaylorInstitute.jpeg', 51.07911839, -114.13122994, 'Taylor Institute for Teaching and Learning', 51.07911839, -114.13122994),
  ('mh-02', '/assets/photos/mac-hall.jpg', 51.07859427, -114.13046071, 'MacEwan Hall', 51.07859427, -114.13046071),
  ('sa-01', '/assets/photos/scienceA.jpeg', 51.07913657, -114.12818583, 'Science A', 51.07913657, -114.12818583),
  ('st-01', '/assets/photos/st-140.jpg', 51.07962186, -114.12716548, 'Science Theatres', 51.07962186, -114.12716548);
