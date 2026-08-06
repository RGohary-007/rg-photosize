import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Trash2, Download, Loader2, Wand2, Images } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Controls, type OriginalsMode } from "@/components/converter/Controls";
import { SaveAllDialog } from "@/components/converter/SaveAllDialog";
import {
  convertImage,
  formatBytes,
  renameFile,
  EXT,
  MIME,
  type OutputFormat,
} from "@/lib/convert";
import { createZip } from "@/lib/zip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhotoSize — Convert & Resize Photos to JPEG, HEIC, PNG" },
      {
        name: "description",
        content:
          "Convert and resize photos from your library to JPEG, HEIC, PNG or WebP, keep EXIF metadata, and save them individually or as a zip.",
      },
      { property: "og:title", content: "PhotoSize — Convert & Resize Photos" },
      {
        property: "og:description",
        content:
          "Resize and convert your photo library to JPEG, HEIC, PNG or WebP with optional metadata preservation.",
      },
    ],
  }),
  component: Index,
});

type Item = {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  converted?: {
    name: string;
    blob: Blob;
    bytes: Uint8Array<ArrayBufferLike>;
    size: number;
    width: number;
    height: number;
    format: OutputFormat;
    metadataCopied: boolean;
    previewUrl: string;
  };
  isConvertedItem?: boolean;
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState(40);
  const [scale, setScale] = useState(40);
  const [preserveMetadata, setPreserveMetadata] = useState(false);
  const [originals, setOriginals] = useState<OriginalsMode>("keep");
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const readyToSave = useMemo(
    () =>
      items
        .filter((i) => i.converted)
        .map((i) => ({ name: i.converted!.name, blob: i.converted!.blob, bytes: i.converted!.bytes })),
    [items],
  );

  const totals = useMemo(() => {
    const withResult = items.filter((i) => i.converted);
    const before = withResult.reduce((s, i) => s + i.size, 0);
    const after = withResult.reduce((s, i) => s + i.converted!.size, 0);
    return { count: withResult.length, before, after };
  }, [items]);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Item[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        name: f.name,
        size: f.size,
        previewUrl: URL.createObjectURL(f),
      }));
    if (!next.length) {
      toast.error("Those files aren't images.");
      return;
    }
    setItems((prev) => [...prev, ...next]);
  }

  function handleFormat(f: OutputFormat) {
    setFormat(f);
    if (f !== "jpeg" && preserveMetadata) {
      setPreserveMetadata(false);
      toast.info("Metadata can only be written into JPEG, so it was turned off.");
    }
  }

  function handleMetadata(v: boolean) {
    setPreserveMetadata(v);
    if (v && format !== "jpeg") {
      setFormat("jpeg");
      toast.info("Output format switched to JPEG so metadata can be preserved.");
    }
  }

  async function convertAll() {
    if (!items.length) return;
    setBusy(true);
    let fallbacks = 0;
    let metadataMisses = 0;
    try {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const r = await convertImage(item.file, {
              format,
              quality,
              scale,
              preserveMetadata,
            });
            if (r.fellBackToJpeg) fallbacks++;
            if (preserveMetadata && !r.metadataCopied) metadataMisses++;
            return { item, r };
          } catch (error) {
            toast.error(`${item.name}: ${(error as Error).message}`);
            return { item, r: null };
          }
        }),
      );

      setItems((prev) => {
        const map = new Map(results.map((x) => [x.item.id, x.r]));
        const out: Item[] = [];
        for (const item of prev) {
          const r = map.get(item.id);
          if (!r) {
            out.push(item);
            continue;
          }
          const name = renameFile(item.name, r.format);
          const convertedFile = new File([r.blob], name, { type: MIME[r.format] });
          if (originals === "replace") {
            URL.revokeObjectURL(item.previewUrl);
            out.push({
              id: item.id,
              file: convertedFile,
              name,
              size: r.blob.size,
              previewUrl: URL.createObjectURL(r.blob),
              isConvertedItem: true,
              converted: {
                name,
                blob: r.blob,
                bytes: r.bytes,
                size: r.blob.size,
                width: r.width,
                height: r.height,
                format: r.format,
                metadataCopied: r.metadataCopied,
                previewUrl: "",
              },
            });
          } else {
            if (item.converted?.previewUrl) URL.revokeObjectURL(item.converted.previewUrl);
            out.push({
              ...item,
              converted: {
                name,
                blob: r.blob,
                bytes: r.bytes,
                size: r.blob.size,
                width: r.width,
                height: r.height,
                format: r.format,
                metadataCopied: r.metadataCopied,
                previewUrl: URL.createObjectURL(r.blob),
              },
            });
          }
        }
        return out;
      });

      if (fallbacks) {
        toast.warning(
          `${fallbacks} photo${fallbacks === 1 ? "" : "s"} could not be encoded as ${format.toUpperCase()} on this device, so JPEG was used instead.`,
        );
      } else {
        toast.success("Conversion finished.");
      }
      if (metadataMisses) {
        toast.info(
          `${metadataMisses} file${metadataMisses === 1 ? " had" : "s had"} no EXIF metadata to copy.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function uniqueNames<T extends { name: string }>(files: T[]) {
    const seen = new Map<string, number>();
    return files.map((f) => {
      const count = (seen.get(f.name) ?? 0) + 1;
      seen.set(f.name, count);
      if (count === 1) return { ...f, name: f.name };
      const dot = f.name.lastIndexOf(".");
      return { ...f, name: `${f.name.slice(0, dot)} (${count})${f.name.slice(dot)}` };
    });
  }

  async function saveZip() {
    setSaveOpen(false);
    const zip = await createZip(uniqueNames(readyToSave).map((f) => ({ name: f.name, data: f.bytes })));
    download(zip, `converted-photos-${EXT[format]}.zip`);
    toast.success("Zip archive saved.");
  }

  function saveIndividual() {
    setSaveOpen(false);
    uniqueNames(readyToSave).forEach((f, i) => setTimeout(() => download(f.blob, f.name), i * 250));
    toast.success(`Saving ${readyToSave.length} file${readyToSave.length === 1 ? "" : "s"}.`);
  }

  function remove(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.converted?.previewUrl) URL.revokeObjectURL(item.converted.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-ios">
            <Images className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">PhotoSize</h1>
            <p className="text-xs text-muted-foreground">
              Resize and convert photos from your library
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border bg-card px-6 py-10 transition-colors hover:border-primary hover:bg-accent/40"
          >
            <ImagePlus className="size-7 text-primary" />
            <span className="text-sm font-semibold">Choose photos</span>
            <span className="text-xs text-muted-foreground">
              Pick straight from your photo library — everything stays on your device
            </span>
          </button>

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-ios"
                >
                  <img
                    src={item.converted?.previewUrl || item.previewUrl}
                    alt={item.name}
                    loading="lazy"
                    className="size-16 shrink-0 rounded-xl bg-secondary object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatBytes(item.size)}
                      {item.converted && !item.isConvertedItem && (
                        <>
                          {" → "}
                          <span
                            className={cn(
                              "font-semibold",
                              item.converted.size < item.size ? "text-success" : "text-warning",
                            )}
                          >
                            {formatBytes(item.converted.size)}
                          </span>
                        </>
                      )}
                      {item.converted && (
                        <>
                          {" · "}
                          {item.converted.width}×{item.converted.height}
                        </>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.converted && (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {item.converted.format.toUpperCase()}
                        </Badge>
                      )}
                      {item.isConvertedItem && (
                        <Badge className="rounded-full bg-primary text-[10px] text-primary-foreground">
                          replaced original
                        </Badge>
                      )}
                      {item.converted?.metadataCopied && (
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          metadata kept
                        </Badge>
                      )}
                    </div>
                  </div>
                  {item.converted && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Save ${item.converted.name}`}
                      onClick={() => download(item.converted!.blob, item.converted!.name)}
                    >
                      <Download className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </article>
              ))}
            </div>
          )}

          {totals.count > 0 && (
            <p className="text-xs text-muted-foreground">
              {totals.count} converted · {formatBytes(totals.before)} → {formatBytes(totals.after)} (
              {totals.after <= totals.before
                ? `${Math.round((1 - totals.after / Math.max(1, totals.before)) * 100)}% smaller`
                : `${Math.round((totals.after / Math.max(1, totals.before) - 1) * 100)}% larger`}
              )
            </p>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-ios lg:sticky lg:top-6">
          <Controls
            format={format}
            quality={quality}
            scale={scale}
            preserveMetadata={preserveMetadata}
            originals={originals}
            onFormat={handleFormat}
            onQuality={setQuality}
            onScale={setScale}
            onPreserveMetadata={handleMetadata}
            onOriginals={setOriginals}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl gap-2 px-5 py-3">
          <Button
            className="h-11 flex-1 rounded-2xl text-sm font-semibold"
            disabled={!items.length || busy}
            onClick={convertAll}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Convert {items.length ? `${items.length} photo${items.length === 1 ? "" : "s"}` : ""}
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-2xl text-sm font-semibold"
            disabled={!readyToSave.length}
            onClick={() => setSaveOpen(true)}
          >
            <Download className="size-4" />
            Save all
          </Button>
        </div>
      </div>

      <SaveAllDialog
        open={saveOpen}
        count={readyToSave.length}
        onOpenChange={setSaveOpen}
        onIndividual={saveIndividual}
        onZip={saveZip}
      />
    </main>
  );
}
