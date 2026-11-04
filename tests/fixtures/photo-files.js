import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../public/assets/photos/", import.meta.url));

// Game photos are not distributed with the public repository. Tests that need
// the real photo collection skip when it has not been added locally.
export const hasPhotos = fs.existsSync(root);
export const missingPhotosReason = "public/assets/photos is not present (photos are not distributed with this repository)";

export function photoFiles(directory = root) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? photoFiles(full)
      : /\.(jpe?g|png|webp)$/i.test(entry.name) ? [path.relative(root, full).replaceAll("\\", "/")] : [];
  });
}

// Stand-in image used when a photo is not available locally.
export const placeholderPhoto = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">` +
  `<rect width="1600" height="1200" fill="#6b7280"/>` +
  `<text x="800" y="600" fill="#f9fafb" font-family="sans-serif" font-size="64" text-anchor="middle">Photo not included</text></svg>`;

// Playwright route.fulfill options for a photo, falling back to the placeholder.
export function photoResponse(file) {
  const full = path.join(root, file);
  return fs.existsSync(full)
    ? { path: full, contentType: "image/webp" }
    : { body: placeholderPhoto, contentType: "image/svg+xml" };
}
