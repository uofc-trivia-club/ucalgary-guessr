# Managing game photos

The game serves WebP images from `public/assets/photos/`. This directory is ignored by Git, and the photo collection is not distributed with this repository. Do not force-add photos.

Keep original, larger images outside `public/`, for example in the ignored `.local/photo-originals/` directory, with a separate private backup. Everything under `public/` can be served to visitors.

## Before adding a photo

- Verify permission to display it on the deployed website.
- Review visible people, documents, screens, and embedded metadata for private information.
- Record its source, creator, license or permission, and any attribution requirements. See [asset terms](../ASSET-LICENSE.md).

## Folder layout

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

Keep residence photos and Dining Centre (`DC`) under `residencies/general/` (for example, `CR-CrowsnestHall-CFH.webp`). Keep `outdoors/` as the miscellaneous outdoor collection. These mappings also apply to future photos of building codes that currently have no images in the game. Keep unlisted building codes separate until their placement is agreed. Folder organisation alone does not register new photos in the game.

## Naming

Start every photo filename with its correct map building code. Off-main-campus photos live in `non-main campus/` and follow the same rule. `SS` and `ST` in `sciences/` and `weekly-images/` mean Social Sciences and Science Theatres; other reused or unknown codes need an explicit answer before registration. Outdoor answers retain their original buildings and scoring coordinates.

## Weekly photos

Put Weekly-only photos in `weekly-images/`. All other registered photos are available for Daily (one per day) and random Play. Do not copy Weekly images into other folders: catalog generation rejects identical content across the two pools.

## Registering photos

After adding or moving photos, regenerate the registrations without accessing a database:

```bash
node scripts/generate-photo-seed.js
```

The generator uses the canonical map names and coordinates in `server/data/campus-buildings.json` and writes `server/db/seed.sql`. Registered photo IDs are pinned in `server/data/photo-ids.json`; update the corresponding path there when moving or renaming an existing photo, preserving its ID.

Restarting the server or running `npm run db:init` applies the catalog and pool migration without replacing photo rows, accounts, scores, custom photos, or existing dated challenge assignments. Previously assigned challenges stay fixed; the pool rules apply to newly assigned challenges.
