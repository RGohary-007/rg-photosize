import { extractJpegExif, insertJpegExif } from "./exif";

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
  scale: number; // 0..100 percent of original dimensions
  preserveMetadata: boolean;
};

export type ConvertResult = {
  blob: Blob;
  bytes: Uint8Array;
  width: number;
  height: number;
  format: OutputFormat;
  metadataCopied: boolean;
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

export async function convertImage(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const source = await loadBitmap(file);
  const sourceWidth = "width" in source ? source.width : 0;
  const sourceHeight = "height" in source ? source.height : 0;
  const width = Math.max(1, Math.round((sourceWidth * options.scale) / 100));
  const height = Math.max(1, Math.round((sourceHeight * options.scale) / 100));

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

  let bytes = new Uint8Array(await blob.arrayBuffer());
  let metadataCopied = false;

  if (options.preserveMetadata && format === "jpeg") {
    const original = new Uint8Array(await file.arrayBuffer());
    const exif = extractJpegExif(original);
    if (exif) {
      bytes = insertJpegExif(bytes, exif);
      blob = new Blob([bytes as unknown as BlobPart], { type: MIME.jpeg });
      metadataCopied = true;
    }
  }

  return { blob, bytes, width, height, format, metadataCopied, fellBackToJpeg };
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function renameFile(name: string, format: OutputFormat) {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.${EXT[format]}`;
}
