import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { InfoTip, RecommendedTick } from "./InfoTip";
import { LOSSLESS, type OutputFormat } from "@/lib/convert";
import { cn } from "@/lib/utils";

export type OriginalsMode = "keep" | "replace";

const FORMATS: { value: OutputFormat; label: string; use: string }[] = [
  {
    value: "jpeg",
    label: "JPEG",
    use: "Everyday photos, sharing and printing. Works everywhere and gives the smallest files for camera shots.",
  },
  {
    value: "heic",
    label: "HEIC",
    use: "Apple's own photo format. Roughly half the size of JPEG at the same quality — ideal to keep inside iPhone, iPad and Mac.",
  },
  {
    value: "png",
    label: "PNG",
    use: "Screenshots, logos and graphics with sharp edges or transparency.",
  },
  {
    value: "webp",
    label: "WebP",
    use: "Websites and app assets. Excellent quality per kilobyte for modern browsers.",
  },
];

const SIZE_PRESETS: { label: string; width: number; height: number; hint: string }[] = [
  { label: "640 px", width: 640, height: 640, hint: "Thumbnails" },
  { label: "1280 px", width: 1280, height: 1280, hint: "Sharing" },
  { label: "1920 px", width: 1920, height: 1920, hint: "Full HD" },
  { label: "2560 px", width: 2560, height: 2560, hint: "Large print" },
];

type Props = {
  format: OutputFormat;
  quality: number;
  resizeEnabled: boolean;
  maxWidth: number;
  maxHeight: number;
  preserveMetadata: boolean;
  originals: OriginalsMode;
  onFormat: (f: OutputFormat) => void;
  onQuality: (q: number) => void;
  onResizeEnabled: (v: boolean) => void;
  onMaxWidth: (v: number) => void;
  onMaxHeight: (v: number) => void;
  onPreserveMetadata: (v: boolean) => void;
  onOriginals: (m: OriginalsMode) => void;
};

export function Controls({
  format,
  quality,
  resizeEnabled,
  maxWidth,
  maxHeight,
  preserveMetadata,
  originals,
  onFormat,
  onQuality,
  onResizeEnabled,
  onMaxWidth,
  onMaxHeight,
  onPreserveMetadata,
  onOriginals,
}: Props) {
  const lossless = LOSSLESS.includes(format);
  const active = FORMATS.find((f) => f.value === format)!;

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Output format</Label>
          {preserveMetadata && (
            <span className="text-xs text-muted-foreground">Locked to JPEG by metadata</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={format === f.value}
              onClick={() => onFormat(f.value)}
              className={cn(
                "rounded-xl px-2 py-2 text-sm font-medium transition-all",
                format === f.value
                  ? "bg-card text-foreground shadow-ios"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{active.use}</p>
      </section>

      <section className="space-y-3" data-testid="resize-section">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="resize" className="text-sm font-semibold">
              Resize
            </Label>
            <InfoTip title="resizing">
              <p>
                Photos are scaled down to fit inside the width and height you set, and the original
                shape is always kept — nothing is cropped or stretched.
              </p>
              <p>Photos already smaller than the box are left at their own size.</p>
            </InfoTip>
          </div>
          <Switch id="resize" checked={resizeEnabled} onCheckedChange={onResizeEnabled} />
        </div>

        {resizeEnabled ? (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="max-width" className="text-xs text-muted-foreground">
                  Max width (px)
                </Label>
                <Input
                  id="max-width"
                  type="number"
                  min={16}
                  max={12000}
                  inputMode="numeric"
                  className="rounded-xl"
                  value={maxWidth}
                  onChange={(e) => onMaxWidth(Number(e.target.value))}
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">×</span>
              <div className="flex-1 space-y-1">
                <Label htmlFor="max-height" className="text-xs text-muted-foreground">
                  Max height (px)
                </Label>
                <Input
                  id="max-height"
                  type="number"
                  min={16}
                  max={12000}
                  inputMode="numeric"
                  className="rounded-xl"
                  value={maxHeight}
                  onChange={(e) => onMaxHeight(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {SIZE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant={maxWidth === p.width && maxHeight === p.height ? "default" : "outline"}
                  className="h-auto flex-col gap-0 rounded-xl px-1 py-1.5"
                  onClick={() => {
                    onMaxWidth(p.width);
                    onMaxHeight(p.height);
                  }}
                >
                  <span className="text-xs font-semibold">{p.label}</span>
                  <span className="text-[10px] font-normal opacity-70">{p.hint}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
            Resizing is off — every photo keeps its original pixel dimensions and only the format and
            quality change.
          </p>
        )}
      </section>

      {lossless ? (
        <section
          data-testid="lossless-note"
          className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed"
        >
          <p className="font-semibold text-foreground">
            {format === "png" ? "PNG is lossless" : "WebP here is saved lossless"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Every pixel is kept exactly as it is,
            <br />
            so for a normal photo this usually does{" "}
            <strong className="text-foreground">not shrink the file— it often makes it larger</strong>
            &nbsp;
            <br />
            than the original. Use it for graphics and screenshots, or resize above to actually save
            space.
          </p>
        </section>
      ) : (
        <section className="space-y-3" data-testid="quality-section">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Quality</Label>
            <span className="text-sm font-medium tabular-nums text-primary">{quality}%</span>
          </div>
          <Slider
            aria-label="Quality percentage"
            value={[quality]}
            min={5}
            max={100}
            step={5}
            onValueChange={(v) => onQuality(v[0] ?? quality)}
          />
          <RecommendedTick percent={40} />
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="metadata" className="text-sm font-semibold">
                Preserve metadata
              </Label>
              <InfoTip title="What is metadata?">
                <p>
                  Metadata (EXIF) is the invisible information your camera stores inside a photo:
                  date and time, camera and lens, shutter speed and ISO, orientation and often the
                  GPS location.
                </p>
                <p>
                  Keeping it means albums stay sorted by date. Removing it strips the location before
                  you share a photo.
                </p>
              </InfoTip>
              <Badge className="rounded-full bg-accent text-accent-foreground hover:bg-accent">
                Recommended
              </Badge>
            </div>
            <p className="text-xs font-bold tracking-wide uppercase text-foreground">
              JPEG OUTPUT ONLY
            </p>
            <p className="text-xs text-muted-foreground">
              Turning this on switches the output format to JPEG. The original date and time is
              always written, even when the source photo carries no camera data.
            </p>
          </div>
          <Switch
            id="metadata"
            checked={preserveMetadata}
            onCheckedChange={onPreserveMetadata}
          />
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-sm font-semibold">What should happen to the originals?</Label>
        <RadioGroup
          value={originals}
          onValueChange={(v) => onOriginals(v as OriginalsMode)}
          className="gap-2"
        >
          {[
            {
              value: "keep",
              title: "Keep originals in the list",
              hint: "The converted copy is added next to the original.",
            },
            {
              value: "replace",
              title: "Replace originals with the converted",
              hint: "The original disappears from the list and only the converted photo stays.",
            },
          ].map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                originals === o.value
                  ? "border-primary bg-accent/60"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <RadioGroupItem value={o.value} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </section>
    </div>
  );
}
