import { extractJpegExif, insertJpegExif, buildExifSegment, readOriginalDate } from "./exif";

export type OutputFormat = "jpeg" | "png" | "webp" | "heic";

export const MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export const EXT: Record<OutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  heic: "heic",
};

export const LOSSLESS: OutputFormat[] = ["png", "webp"];

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
 * Safari (and every iOS browser) cannot encode WebP through canvas — it silently
 * returns a PNG instead. We encode WebP with a WebAssembly encoder so the output
 * really is a .webp file on every device.
 */
async function encodeWebp(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    const { encode } = await import("@jsquash/webp");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const buffer = await encode(data, { lossless: 1, quality: 100 });
    return new Blob([buffer], { type: MIME.webp });
  } catch {
    return null;
  }
}

/** Can this browser really produce the requested format? */
export async function canEncode(format: OutputFormat): Promise<boolean> {
  if (format === "jpeg" || format === "png") return true;
  if (format === "webp") {
    try {
      await import("@jsquash/webp");
      return true;
    } catch {
      return false;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  const blob = await encode(canvas, MIME.heic, 0.8);
  return blob?.type === MIME.heic;
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

  let format = options.format;
  const quality = Math.min(1, Math.max(0.01, options.quality / 100));
  let blob = await encode(canvas, MIME[format], quality);
  let fellBackToJpeg = false;

  // Browsers silently fall back to PNG when they can't encode a format (HEIC/WebP).
  if (!blob || (blob.type !== MIME[format] && format !== "jpeg")) {
    if (format === "heic" || format === "webp") {
      blob = await encode(canvas, MIME.jpeg, quality);
      format = "jpeg";
      fellBackToJpeg = true;
    }
  }
  if (!blob) throw new Error("Could not encode this image.");

  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await blob.arrayBuffer());
  let metadataSource: MetadataSource = "none";

  if (options.preserveMetadata && format === "jpeg") {
    const original = new Uint8Array(await file.arrayBuffer());
    const exif = extractJpegExif(original);
    // If the source carried no readable EXIF (HEIC, PNG, screenshots…) we still
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
