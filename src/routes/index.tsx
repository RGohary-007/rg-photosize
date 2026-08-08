import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ImagePlus,
  Trash2,
  Download,
  Loader2,
  Wand2,
  Images,
  AlertCircle,
  ListX,
  BarChart3,
  ChevronDown,
  Cloud,
  Apple,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Controls, type OriginalsMode } from "@/components/converter/Controls";
import { SaveAllDialog } from "@/components/converter/SaveAllDialog";
import { ConversionSummary, type Summary } from "@/components/converter/SummaryDialog";
import {
  convertImage,
  canEncode,
  formatBytes,
  formatDateTime,
  renameFile,
  EXT,
  MIME,
  type MetadataSource,
  type OutputFormat,
} from "@/lib/convert";
import { readOriginalDate } from "@/lib/exif";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  originalDate?: Date;
  originalDateFromExif?: boolean;
  error?: string;
  converted?: {
    name: string;
    blob: Blob;
    bytes: Uint8Array<ArrayBufferLike>;
    size: number;
    width: number;
    height: number;
    format: OutputFormat;
    metadataCopied: boolean;
    metadataSource: MetadataSource;
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

const EMPTY_SUMMARY: Summary = { count: 0, failed: 0, before: 0, after: 0, byFormat: [] };

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState(40);
  const [resizeEnabled, setResizeEnabled] = useState(true);
  const [maxWidth, setMaxWidth] = useState(1280);
  const [maxHeight, setMaxHeight] = useState(1280);
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [originals, setOriginals] = useState<OriginalsMode>("keep");
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [heicSupported, setHeicSupported] = useState(true);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    void canEncode("heic").then((ok) => {
      if (alive) setHeicSupported(ok);
    });
    return () => {
      alive = false;
    };
  }, []);


  const readyToSave = useMemo(
    () =>
      items
        .filter((i) => i.converted && !i.error)
        .map((i) => ({ name: i.converted!.name, blob: i.converted!.blob, bytes: i.converted!.bytes })),
    [items],
  );

  function buildSummary(
    done: { before: number; after: number; format: OutputFormat }[],
    failed: number,
  ): Summary {
    const before = done.reduce((s, d) => s + d.before, 0);
    const after = done.reduce((s, d) => s + d.after, 0);
    const map = new Map<OutputFormat, { count: number; before: number; after: number }>();
    for (const d of done) {
      const acc = map.get(d.format) ?? { count: 0, before: 0, after: 0 };
      acc.count += 1;
      acc.before += d.before;
      acc.after += d.after;
      map.set(d.format, acc);
    }
    return {
      count: done.length,
      failed,
      before,
      after,
      byFormat: [...map.entries()].map(([f, v]) => ({ format: f, ...v })),
    };
  }


  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
    );
    if (!accepted.length) {
      toast.error("Those files aren't images.");
      return;
    }
    const next: Item[] = await Promise.all(
      accepted.map(async (f) => {
        const { date, fromExif } = await readOriginalDate(f);
        return {
          id: crypto.randomUUID(),
          file: f,
          name: f.name,
          size: f.size,
          previewUrl: URL.createObjectURL(f),
          originalDate: date,
          originalDateFromExif: fromExif,
        };
      }),
    );
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

  function clearAll() {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.converted?.previewUrl) URL.revokeObjectURL(item.converted.previewUrl);
      }
      return [];
    });
    setSummary(EMPTY_SUMMARY);
    setSummaryOpen(false);
    toast.success("List cleared.");
  }

  async function convertAll() {
    if (!items.length) return;
    setBusy(true);
    let fallbacks = 0;
    let failed = 0;
    let generatedMetadata = 0;
    try {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const r = await convertImage(item.file, {
              format,
              quality,
              resizeEnabled,
              maxWidth,
              maxHeight,
              preserveMetadata,
            });
            if (r.fellBackToJpeg) fallbacks++;
            if (r.metadataSource === "generated") generatedMetadata++;
            return { item, r, error: null as string | null };
          } catch (error) {
            failed++;
            return { item, r: null, error: (error as Error).message };
          }
        }),
      );

      setItems((prev) => {
        const map = new Map(results.map((x) => [x.item.id, x]));
        const out: Item[] = [];
        for (const item of prev) {
          const result = map.get(item.id);
          if (!result) {
            out.push(item);
            continue;
          }
          if (!result.r) {
            if (item.converted?.previewUrl) URL.revokeObjectURL(item.converted.previewUrl);
            const { converted: _drop, ...rest } = item;
            out.push({ ...rest, error: result.error ?? "Conversion failed." });
            continue;
          }
          const r = result.r;
          const name = renameFile(item.name, r.format);
          const convertedFile = new File([r.blob], name, { type: MIME[r.format] });
          if (originals === "replace") {
            URL.revokeObjectURL(item.previewUrl);
            out.push({
              id: item.id,
              file: convertedFile,
              name,
              size: item.size,
              previewUrl: URL.createObjectURL(r.blob),
              originalDate: r.originalDate,
              originalDateFromExif: r.originalDateFromExif,
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
                metadataSource: r.metadataSource,
                previewUrl: "",
              },
            });
          } else {
            if (item.converted?.previewUrl) URL.revokeObjectURL(item.converted.previewUrl);
            const { error: _previousError, ...base } = item;
            out.push({
              ...base,

              originalDate: r.originalDate,
              originalDateFromExif: r.originalDateFromExif,
              converted: {
                name,
                blob: r.blob,
                bytes: r.bytes,
                size: r.blob.size,
                width: r.width,
                height: r.height,
                format: r.format,
                metadataCopied: r.metadataCopied,
                metadataSource: r.metadataSource,
                previewUrl: URL.createObjectURL(r.blob),
              },
            });
          }
        }
        return out;
      });

      const built = buildSummary(
        results
          .filter((x) => x.r)
          .map((x) => ({ before: x.item.size, after: x.r!.blob.size, format: x.r!.format })),
        failed,
      );
      setSummary(built);
      if (built.count > 0) setSummaryOpen(true);

      if (failed) {
        toast.error(
          `${failed} photo${failed === 1 ? "" : "s"} could not be converted — they stay in the list without a save button.`,
        );
      }
      if (fallbacks) {
        toast.warning(
          `${fallbacks} photo${fallbacks === 1 ? "" : "s"} could not be encoded as ${format.toUpperCase()} on this device, so JPEG was used instead.`,
        );
      } else if (!failed) {
        toast.success("Conversion finished.");
      }
      if (generatedMetadata) {
        toast.info(
          `${generatedMetadata} photo${generatedMetadata === 1 ? "" : "s"} had no camera data, so the original date and time was written instead.`,
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

  function comingSoon(service: string) {
    toast.info(
      `${service} isn't connected to this app yet — pick the photos from your device for now.`,
    );
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
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="rounded-3xl border-2 border-dashed border-border bg-card px-6 py-8 text-center">
            <ImagePlus className="mx-auto size-7 text-primary" />
            <p className="mt-2 text-sm font-semibold">Choose photos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick straight from your photo library — everything stays on your device
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button className="rounded-2xl" onClick={() => inputRef.current?.click()}>
                Photo library
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-2xl">
                    Other sources
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64 rounded-2xl">
                  <DropdownMenuLabel>Where are the photos?</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
                    <Images className="size-4" />
                    This device
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => comingSoon("Google Photos")}>
                    <Cloud className="size-4" />
                    Google Photos / Drive
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => comingSoon("iCloud Photos")}>
                    <Apple className="size-4" />
                    iCloud Photos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {items.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {items.length} photo{items.length === 1 ? "" : "s"} in the list
                </p>
                <div className="flex gap-2">
                  {summary.count > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => setSummaryOpen(true)}
                    >
                      <BarChart3 className="size-4" />
                      Summary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl text-destructive hover:text-destructive"
                    onClick={clearAll}
                  >
                    <ListX className="size-4" />
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-ios",
                      item.error ? "border-destructive/50" : "border-border",
                    )}
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
                        {item.converted && (
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
                      {item.originalDate && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Original date: {formatDateTime(item.originalDate)}
                          {item.originalDateFromExif ? "" : " (file date)"}
                        </p>
                      )}
                      {item.error && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertCircle className="size-3.5" />
                          {item.error}
                        </p>
                      )}
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
                        {item.converted?.metadataSource === "copied" && (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            metadata kept
                          </Badge>
                        )}
                        {item.converted?.metadataSource === "generated" && (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            date &amp; time written
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.converted && !item.error && (
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
            </>
          )}

          {summary.count > 0 && (
            <p className="text-xs text-muted-foreground">
              {summary.count} converted · {formatBytes(summary.before)} → {formatBytes(summary.after)} (
              {summary.after <= summary.before
                ? `${Math.round((1 - summary.after / Math.max(1, summary.before)) * 100)}% smaller`
                : `${Math.round((summary.after / Math.max(1, summary.before) - 1) * 100)}% larger`}
              )
            </p>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-ios lg:sticky lg:top-6">
          <Controls
            format={format}
            quality={quality}
            resizeEnabled={resizeEnabled}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
            preserveMetadata={preserveMetadata}
            originals={originals}
            heicSupported={heicSupported}

            onFormat={handleFormat}
            onQuality={setQuality}
            onResizeEnabled={setResizeEnabled}
            onMaxWidth={setMaxWidth}
            onMaxHeight={setMaxHeight}
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
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Convert {items.length ? `${items.length} photo${items.length === 1 ? "" : "s"}` : ""}
          </Button>
          {readyToSave.length > 0 && (
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-2xl text-sm font-semibold"
              onClick={() => setSaveOpen(true)}
            >
              <Download className="size-4" />
              Save all
            </Button>
          )}
        </div>
      </div>

      <ConversionSummary
        open={summaryOpen}
        summary={summary}
        onOpenChange={setSummaryOpen}
        onSaveAll={() => {
          setSummaryOpen(false);
          setSaveOpen(true);
        }}
      />

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
