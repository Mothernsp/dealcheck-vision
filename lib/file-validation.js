// Server-side validation for uploaded deal-jacket files.
//
// The browser <input accept="..."> is a hint, not a control: a client can POST
// any bytes with any Content-Type. So we (1) cap size and count, (2) verify the
// real file type from its magic bytes rather than trusting `file.type`, and
// (3) sanitize the filename before it becomes part of a storage path.

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const MAX_FILES = 30; // per upload request
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB per upload request

// MIME types we actually process (PDF + the scan image formats).
export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
]);

// Detect the true content type from the leading bytes. Returns a MIME string
// from ALLOWED_MIME, or null if the bytes don't match a format we accept.
export function sniffMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const b = buffer;

  // PDF: "%PDF"
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return 'application/pdf';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg';
  }
  // TIFF: little-endian "II*\0" or big-endian "MM\0*"
  if (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)
  ) {
    return 'image/tiff';
  }
  return null;
}

// Strip any directory components and dangerous characters so a hostile
// `file.name` like "../../evil.pdf" can never escape the deal's storage prefix.
// Keeps a readable basename for later display; the upload route still prefixes
// a UUID so collisions are impossible.
export function sanitizeFilename(name) {
  const base = String(name || 'file')
    .replace(/\\/g, '/') // normalize Windows separators
    .split('/')
    .pop() // drop any path, including ".."
    .replace(/[\x00-\x1f\x7f]/g, '') // control chars
    .replace(/[^a-zA-Z0-9._ -]/g, '_') // anything exotic -> underscore
    .replace(/^\.+/, '') // no leading dots (hidden/".." remnants)
    .trim();
  const cleaned = base.slice(0, 120);
  return cleaned || 'file';
}

// Validate one already-buffered file. Returns { ok: true, mime, safeName }
// or { ok: false, reason } describing the first problem found.
export function validateFile(originalName, buffer) {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: 'empty file' };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `file exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit`,
    };
  }
  const mime = sniffMime(buffer);
  if (!mime) {
    return { ok: false, reason: 'unsupported or unrecognized file type' };
  }
  return { ok: true, mime, safeName: sanitizeFilename(originalName) };
}
