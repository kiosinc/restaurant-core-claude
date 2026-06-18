/**
 * Image derivative-size contract for the P29 downsample pipeline.
 *
 * `IMAGE_SIZES` is the canonical set of square derivative widths (= heights)
 * produced from each source image. `appendSizeToGsl` derives the sibling
 * Google Storage Locator (gsl) for a given size, living in the same folder
 * as the source with a `{name}_{W}x{H}.{ext}` filename.
 */

export const IMAGE_SIZES = [200, 400, 800, 1280] as const;

export type ImageSize = typeof IMAGE_SIZES[number];

/**
 * Produces the same-folder sibling locator for a square derivative of `gsl`
 * at the given `size`, e.g. `gs://b/foo/bar.jpg` + 400 → `gs://b/foo/bar_400x400.jpg`.
 *
 * - The scheme, bucket, and folders are preserved verbatim (split at the last `/`).
 * - The size suffix is inserted before the extension (split at the last `.` in
 *   the filename); multi-dot filenames keep all but the final dot as the base.
 * - A filename with no extension gets the suffix appended with no extension.
 * - A leading dot (e.g. `.gitkeep`) is NOT treated as an extension.
 * - Pure function, no I/O. Does NOT require a `gs://` prefix.
 *
 * @throws {TypeError} if `gsl` is not a non-empty, non-whitespace-only string.
 */
export function appendSizeToGsl(gsl: string, size: ImageSize): string {
  if (typeof gsl !== 'string' || gsl.trim() === '') {
    throw new TypeError('appendSizeToGsl: gsl must be a non-empty string');
  }

  const suffix = `_${size}x${size}`;

  const lastSlash = gsl.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : gsl.slice(0, lastSlash + 1);
  const filename = lastSlash === -1 ? gsl : gsl.slice(lastSlash + 1);

  const lastDot = filename.lastIndexOf('.');
  // A leading dot (lastDot === 0) is part of the name, not an extension.
  if (lastDot <= 0) {
    return `${dir}${filename}${suffix}`;
  }

  const base = filename.slice(0, lastDot);
  const ext = filename.slice(lastDot); // includes the dot
  return `${dir}${base}${suffix}${ext}`;
}
