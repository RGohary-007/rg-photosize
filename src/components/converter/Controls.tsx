import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

type Props = {
  format: OutputFormat;
  quality: number;
  scale: number;
  preserveMetadata: boolean;
  originals: OriginalsMode;
  onFormat: (f: OutputFormat) => void;
  onQuality: (q: number) => void;
  onScale: (s: number) => void;
  onPreserveMetadata: (v: boolean) => void;
  onOriginals: (m: OriginalsMode) => void;
};

export function Controls({
  format,
  quality,
  scale,
  preserveMetadata,
  originals,
  onFormat,
  onQuality,
  onScale,
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Resize</Label>
          <span className="text-sm font-medium tabular-nums text-primary">{scale}%</span>
        </div>
        <Slider
          aria-label="Resize percentage"
          value={[scale]}
          min={5}
          max={100}
          step={5}
          onValueChange={(v) => onScale(v[0] ?? scale)}
        />
        <RecommendedTick percent={40} />
      </section>

      {lossless ? (
        <section
          data-testid="lossless-note"
          className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed"
        >
          <p className="font-semibold text-foreground">
            {format === "png" ? "PNG is lossless" : "WebP here is saved lossless"} — no quality
            slider needed.
          </p>
          <p className="mt-1 text-muted-foreground">
            Every pixel is kept exactly as it is, so for a normal photo this usually does
            <strong className="text-foreground"> not shrink the file — it often makes it larger</strong>{" "}
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
              Turning this on switches the output format to JPEG.
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
