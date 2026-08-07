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
    insertAt = 4 + (((jpeg[4] ?? 0) << 8) | (jpeg[5] ?? 0));
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

/* ------------------------------------------------------------------ *
 * Reading the original capture date/time out of an EXIF APP1 segment  *
 * ------------------------------------------------------------------ */

function exifStringToDate(value: string): Date | null {
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Pull DateTimeOriginal (falling back to DateTime) out of an APP1 EXIF segment. */
export function readExifDate(segment: Uint8Array): Date | null {
  // segment: FF E1 len len 'E' 'x' 'i' 'f' 00 00 <tiff...>
  const tiffStart = 10;
  if (segment.length < tiffStart + 8) return null;
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  const le = segment[tiffStart] === 0x49;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  if (u16(tiffStart + 2) !== 0x2a) return null;

  const readAscii = (offset: number, count: number) => {
    const bytes = segment.subarray(tiffStart + offset, tiffStart + offset + count);
    return String.fromCharCode(...bytes).replace(/\0.*$/, "");
  };

  const scan = (ifdOffset: number): { dateTime?: string; original?: string; exifIfd?: number } => {
    const out: { dateTime?: string; original?: string; exifIfd?: number } = {};
    const base = tiffStart + ifdOffset;
    if (base + 2 > segment.length) return out;
    const count = u16(base);
    for (let i = 0; i < count; i++) {
      const entry = base + 2 + i * 12;
      if (entry + 12 > segment.length) break;
      const tag = u16(entry);
      const valueCount = u32(entry + 4);
      const valueOffset = u32(entry + 8);
      if (tag === 0x0132) out.dateTime = readAscii(valueOffset, Math.min(valueCount, 32));
      if (tag === 0x9003) out.original = readAscii(valueOffset, Math.min(valueCount, 32));
      if (tag === 0x8769) out.exifIfd = valueOffset;
    }
    return out;
  };

  const ifd0 = scan(u32(tiffStart + 4));
  const exif = ifd0.exifIfd ? scan(ifd0.exifIfd) : {};
  const raw = exif.original ?? ifd0.original ?? ifd0.dateTime;
  return raw ? exifStringToDate(raw) : null;
}

/* ------------------------------------------------------------------ *
 * Building a minimal EXIF segment when the source has none (HEIC/PNG) *
 * ------------------------------------------------------------------ */

function exifDateString(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}:${p(date.getMonth() + 1)}:${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/**
 * Minimal little-endian EXIF APP1 segment carrying DateTime + DateTimeOriginal,
 * so the converted photo keeps the original date even when the source file
 * (HEIC, PNG, WebP…) carried no readable EXIF we could copy.
 */
export function buildExifSegment(date: Date): Uint8Array {
  const stamp = exifDateString(date); // 19 chars + NUL = 20 bytes
  const stampBytes = new Uint8Array(20);
  for (let i = 0; i < 19; i++) stampBytes[i] = stamp.charCodeAt(i);

  const IFD0 = 8;
  const EXIF_IFD = 38; // 8 + (2 + 2*12 + 4)
  const STAMP = 56; // 38 + (2 + 12 + 4)
  const tiffLength = STAMP + 20;

  const tiff = new Uint8Array(tiffLength);
  const view = new DataView(tiff.buffer);
  const w16 = (o: number, v: number) => view.setUint16(o, v, true);
  const w32 = (o: number, v: number) => view.setUint32(o, v, true);

  tiff[0] = 0x49;
  tiff[1] = 0x49;
  w16(2, 0x2a);
  w32(4, IFD0);

  // IFD0: DateTime (ASCII 20) + pointer to Exif IFD
  w16(IFD0, 2);
  w16(IFD0 + 2, 0x0132);
  w16(IFD0 + 4, 2);
  w32(IFD0 + 6, 20);
  w32(IFD0 + 10, STAMP);
  w16(IFD0 + 14, 0x8769);
  w16(IFD0 + 16, 4);
  w32(IFD0 + 18, 1);
  w32(IFD0 + 22, EXIF_IFD);
  w32(IFD0 + 26, 0); // no IFD1

  // Exif IFD: DateTimeOriginal
  w16(EXIF_IFD, 1);
  w16(EXIF_IFD + 2, 0x9003);
  w16(EXIF_IFD + 4, 2);
  w32(EXIF_IFD + 6, 20);
  w32(EXIF_IFD + 10, STAMP);
  w32(EXIF_IFD + 14, 0);

  tiff.set(stampBytes, STAMP);

  const header = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const length = 2 + header.length + tiff.length;
  const out = new Uint8Array(2 + length);
  out[0] = 0xff;
  out[1] = 0xe1;
  out[2] = (length >> 8) & 0xff;
  out[3] = length & 0xff;
  out.set(header, 4);
  out.set(tiff, 4 + header.length);
  return out;
}

/** Best-effort original capture date for any image file. */
export async function readOriginalDate(file: File): Promise<{ date: Date; fromExif: boolean }> {
  try {
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    const segment = extractJpegExif(head);
    if (segment) {
      const date = readExifDate(segment);
      if (date) return { date, fromExif: true };
    }
  } catch {
    /* ignore and fall back to the file timestamp */
  }
  return { date: new Date(file.lastModified || Date.now()), fromExif: false };
}
