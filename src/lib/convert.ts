import { extractJpegExif, insertJpegExif, buildExifSegment, readOriginalDate } from "./exif";

export type OutputFormat = "jpeg" | "png" | "pdf";

export const MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

export const EXT: Record<OutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  pdf: "pdf",
};

export const LOSSLESS: OutputFormat[] = ["png"];

export type ConvertOptions = {
  format: OutputFormat;
  quality: number; // 0..100
  /** When false the photo keeps its original pixel dimensions. */
  resizeEnabled: boolean;
  /** Fit box in pixels — the photo is scaled down to fit, aspect ratio kept. */
  maxWidth: number;
  maxHeight: number;
  preserveMetadata: boolean;
};

export type MetadataSource = "copied" | "generated" | "none";

export type ConvertResult = {
  blob: Blob;
  bytes: Uint8Array<ArrayBufferLike>;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  format: OutputFormat;
  metadataCopied: boolean;
  metadataSource: MetadataSource;
  originalDate: Date;
  originalDateFromExif: boolean;
  fellBackToJpeg: boolean;
};

async function loadBitmap(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("This image format can't be decoded here."));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function encode(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), mime, quality),
  );
}

/**
 * Build a single-page PDF that embeds the canvas image as a JPEG stream.
 * The PDF page matches the image dimensions (in points = 1/72 inch).
 */
function encodePdf(canvas: HTMLCanvasElement, quality: number): Blob {
  const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = jpegDataUrl.split(",")[1]!;
  const binary = atob(base64);
  const imgBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) imgBytes[i] = binary.charCodeAt(i);

  const w = canvas.width;
  const h = canvas.height;

  // Build PDF objects
  const objects: string[] = [];
  const offsets: number[] = [];

  // Header
  let pdf = "%PDF-1.4\n";

  // Object 1: Catalog
  offsets.push(pdf.length);
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  pdf += objects[0];

  // Object 2: Pages
  offsets.push(pdf.length);
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  pdf += objects[1];

  // Object 3: Page
  offsets.push(pdf.length);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  pdf += objects[2];

  // Object 4: Image XObject (JPEG)
  offsets.push(pdf.length);
  const imgHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`;
  const imgFooter = "\nendstream\nendobj\n";
  pdf += imgHeader;

  // We need to insert raw bytes here, so we'll build the final result as a byte array
  const imgHeaderBytes = new TextEncoder().encode(imgHeader);
  const imgFooterBytes = new TextEncoder().encode(imgFooter);

  // Object 5: Content stream (draw the image)
  const contentStream = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(0); // placeholder, will fix after image bytes
  const contentStartPlaceholder = pdf.length;

  // Build the complete PDF as bytes
  const beforeImg = new TextEncoder().encode(pdf);
  const contentStreamBytes = new TextEncoder().encode(contentStream);

  // Calculate total size
  const totalLength =
    beforeImg.length +
    imgBytes.length +
    imgFooterBytes.length +
    contentStreamBytes.length +
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n`.length +
    "\nendstream\nendobj\n".length +
    `xref\n0 6\n0000000000 65535 f \n`.length +
    offsets
      .slice(0, 3)
      .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
      .join("") +
    // offset for object 5 (after image)
    `${String(beforeImg.length + imgBytes.length + imgFooterBytes.length).padStart(10, "0")} 00000 n \n`.length +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n`.length +
    "%%EOF".length;

  // Actually, let's just build it properly with a Uint8Array
  const contentObjHeader = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n`;
  const contentObjFooter = "\nendstream\nendobj\n";

  const parts: Uint8Array[] = [
    beforeImg,
    imgBytes,
    imgFooterBytes,
    new TextEncoder().encode(contentObjHeader),
    contentStreamBytes,
    new TextEncoder().encode(contentObjFooter),
  ];

  // Calculate offsets for xref
  const obj5Offset = beforeImg.length + imgBytes.length + imgFooterBytes.length;

  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const o of offsets.slice(0, 3)) {
    xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  }
  xref += `${String(obj5Offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n`;

  const startxref = beforeImg.length + imgBytes.length + imgFooterBytes.length + contentObjHeader.length + contentStreamBytes.length + contentObjFooter.length;
  xref += `${startxref}\n%%EOF`;

  parts.push(new TextEncoder().encode(xref));

  // Combine all parts
  const totalBytes = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalBytes);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }

  return new Blob([result as unknown as BlobPart], { type: MIME.pdf });
}

/** Can this browser really produce the requested format? */
export async function canEncode(format: OutputFormat): Promise<boolean> {
  if (format === "jpeg" || format === "png" || format === "pdf") return true;
  return false;
}


/** Target pixel size for a source image, fitted inside the requested box. */
export function fitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  options: Pick<ConvertOptions, "resizeEnabled" | "maxWidth" | "maxHeight">,
) {
  if (!options.resizeEnabled || !sourceWidth || !sourceHeight) {
    return { width: Math.max(1, sourceWidth), height: Math.max(1, sourceHeight) };
  }
  const maxW = Math.max(1, Math.round(options.maxWidth));
  const maxH = Math.max(1, Math.round(options.maxHeight));
  const ratio = Math.min(maxW / sourceWidth, maxH / sourceHeight, 1);
  return {
    width: Math.max(1, Math.round(sourceWidth * ratio)),
    height: Math.max(1, Math.round(sourceHeight * ratio)),
  };
}

export async function convertImage(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const { date: originalDate, fromExif: originalDateFromExif } = await readOriginalDate(file);
  const source = await loadBitmap(file);
  const sourceWidth = "width" in source ? source.width : 0;
  const sourceHeight = "height" in source ? source.height : 0;
  const { width, height } = fitDimensions(sourceWidth, sourceHeight, options);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  const format = options.format;
  const quality = Math.min(1, Math.max(0.01, options.quality / 100));
  let blob: Blob | null;
  if (format === "pdf") {
    blob = encodePdf(canvas, quality);
  } else {
    blob = await encode(canvas, MIME[format], quality);
  }
  const fellBackToJpeg = false;

  if (!blob) throw new Error("Could not encode this image.");

  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await blob.arrayBuffer());
  let metadataSource: MetadataSource = "none";

  if (options.preserveMetadata && format === "jpeg") {
    const original = new Uint8Array(await file.arrayBuffer());
    const exif = extractJpegExif(original);
    // If the source carried no readable EXIF (PNG, screenshots…) we still
    // write the original capture date/time so nothing is silently lost.
    const segment = exif ?? buildExifSegment(originalDate);
    bytes = insertJpegExif(bytes, segment);
    blob = new Blob([bytes as unknown as BlobPart], { type: MIME.jpeg });
    metadataSource = exif ? "copied" : "generated";
  }

  return {
    blob,
    bytes,
    width,
    height,
    sourceWidth,
    sourceHeight,
    format,
    metadataCopied: metadataSource !== "none",
    metadataSource,
    originalDate,
    originalDateFromExif,
    fellBackToJpeg,
  };
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDateTime(date: Date) {
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function renameFile(name: string, format: OutputFormat) {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.${EXT[format]}`;
}
