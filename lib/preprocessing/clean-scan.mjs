// Image preprocessing & legibility scoring for scanned documents (Phase 2).
//
// These operate on RASTER IMAGES only. PDFs are sent to Claude natively (no
// rasterization step in this pipeline), so callers must skip PDFs — use
// isPreprocessableImage(mime) to decide. Originals in Supabase Storage are never
// touched; preprocessing only transforms the in-memory copy sent to the API.

import sharp from 'sharp';

// MIME types sharp can decode for preprocessing. PDFs are intentionally excluded.
const PREPROCESSABLE = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
]);

export function isPreprocessableImage(mimeType) {
  return PREPROCESSABLE.has(mimeType);
}

// Clean up a scanned page for Vision: grayscale → contrast normalize → light
// denoise → re-encode JPEG q90. Returns a new Buffer; input is unchanged.
// (Deskew is deliberately NOT done here — it needs OpenCV/Hough and adds heavy
// build complexity. v2 TODO.)
export async function cleanScan(bytes) {
  return sharp(bytes)
    .greyscale()
    .normalize()
    .median(1)
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Legibility score = variance of the Laplacian (a standard focus measure).
// Higher = sharper/more legible; blurry low-contrast scans score low.
//
// Computed on a grayscale copy resized to a fixed working size so scores are
// comparable across source resolutions. The 3x3 Laplacian is applied in float
// (not via sharp.convolve, whose uint8 clamping would distort the variance).
export async function sharpnessScore(bytes) {
  const WORK = 1024;
  const { data, info } = await sharp(bytes)
    .greyscale()
    .resize(WORK, WORK, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      // Laplacian kernel [[0,1,0],[1,-4,1],[0,1,0]]
      const lap = -4 * data[i] + data[i - 1] + data[i + 1] + data[i - width] + data[i + width];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}
