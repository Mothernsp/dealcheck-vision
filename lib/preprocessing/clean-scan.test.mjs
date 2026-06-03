// Phase 2.2 acceptance: a clearly illegible (blurred) scan must score below a
// clean one, so a threshold between them rejects the bad scan and passes the
// good one. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { sharpnessScore, cleanScan, isPreprocessableImage } from './clean-scan.mjs';

// A high-frequency checkerboard stands in for crisp text edges.
async function checkerboard(size = 256, cell = 4) {
  const data = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? 255 : 0;
    }
  }
  return sharp(data, { raw: { width: size, height: size, channels: 1 } }).png().toBuffer();
}

test('a clean scan scores higher than a blurred (illegible) one', async () => {
  const clean = await checkerboard();
  const blurred = await sharp(clean).blur(8).png().toBuffer();

  const cleanScore = await sharpnessScore(clean);
  const blurredScore = await sharpnessScore(blurred);

  assert.ok(
    cleanScore > blurredScore,
    `expected clean (${cleanScore.toFixed(0)}) > blurred (${blurredScore.toFixed(0)})`
  );

  // There exists a threshold that rejects the blurred scan and passes the clean
  // one — the gate's core requirement.
  const threshold = (cleanScore + blurredScore) / 2;
  assert.ok(blurredScore < threshold, 'blurred should fail the gate');
  assert.ok(cleanScore >= threshold, 'clean should pass the gate');
});

test('cleanScan returns JPEG bytes', async () => {
  const out = await cleanScan(await checkerboard(64));
  assert.equal(out[0], 0xff, 'JPEG SOI byte 0');
  assert.equal(out[1], 0xd8, 'JPEG SOI byte 1');
});

test('isPreprocessableImage excludes PDFs', () => {
  assert.ok(isPreprocessableImage('image/jpeg'));
  assert.ok(isPreprocessableImage('image/png'));
  assert.ok(!isPreprocessableImage('application/pdf'));
});
