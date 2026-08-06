// Copy the EXIF (APP1) block from a source JPEG into a freshly encoded JPEG.
// JPEG is the only container we can reliably round-trip metadata into in the browser.

export function extractJpegExif(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xda) break; // start of scan
    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (marker === 0xe1) {
      const segment = bytes.subarray(i, i + 2 + length);
      const tag = String.fromCharCode(...segment.subarray(4, 8));
      if (tag === "Exif") return segment;
    }
    i += 2 + length;
  }
  return null;
}

export function insertJpegExif(jpeg: Uint8Array, exifSegment: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  // Skip an existing APP0/APP1 header block so we don't duplicate metadata.
  let insertAt = 2;
  if (jpeg[2] === 0xff && ((jpeg[3] ?? 0) === 0xe0 || (jpeg[3] ?? 0) === 0xe1)) {
    insertAt = 4 + (((jpeg[4] ?? 0) << 8) | (jpeg[5] ?? 0)) - 2;
  }
  const out = new Uint8Array(jpeg.length + exifSegment.length);
  out.set(jpeg.subarray(0, insertAt), 0);
  out.set(exifSegment, insertAt);
  out.set(jpeg.subarray(insertAt), insertAt + exifSegment.length);
  return out;
}

export async function hasReadableExif(file: File): Promise<boolean> {
  if (!/jpe?g/i.test(file.type)) return false;
  const head = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
  return extractJpegExif(head) !== null;
}
