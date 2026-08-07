import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes, type OutputFormat } from "@/lib/convert";
import { cn } from "@/lib/utils";

export type FormatStat = {
  format: OutputFormat;
  count: number;
  before: number;
  after: number;
};

export type Summary = {
  count: number;
  failed: number;
  before: number;
  after: number;
  byFormat: FormatStat[];
};

function changeLabel(before: number, after: number) {
  if (!before) return "—";
  const delta = (after - before) / before;
  const pct = Math.abs(Math.round(delta * 100));
  if (pct === 0) return "no change";
  return delta < 0 ? `${pct}% smaller` : `${pct}% larger`;
}

export function ConversionSummary({
  open,
  summary,
  onOpenChange,
  onSaveAll,
}: {
  open: boolean;
  summary: Summary;
  onOpenChange: (v: boolean) => void;
  onSaveAll: () => void;
}) {
  const smaller = summary.after <= summary.before;
  const diff = Math.abs(summary.before - summary.after);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conversion summary</DialogTitle>
          <DialogDescription>
            {summary.count} photo{summary.count === 1 ? "" : "s"} converted
            {summary.failed ? ` · ${summary.failed} failed` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-secondary/60 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Original</p>
                <p className="text-lg font-semibold tabular-nums">{formatBytes(summary.before)}</p>
              </div>
              <span className="pb-1 text-muted-foreground">→</span>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Converted</p>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    smaller ? "text-success" : "text-warning",
                  )}
                >
                  {formatBytes(summary.after)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {smaller ? "Saved" : "Added"} {formatBytes(diff)} ·{" "}
              {changeLabel(summary.before, summary.after)} overall
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              By format
            </p>
            {summary.byFormat.map((s) => (
              <div
                key={s.format}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {s.format.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {s.count} photo{s.count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs tabular-nums">
                    {formatBytes(s.before)} → {formatBytes(s.after)}
                  </p>
                  <p
                    className={cn(
                      "text-[11px] font-medium",
                      s.after <= s.before ? "text-success" : "text-warning",
                    )}
                  >
                    {changeLabel(s.before, s.after)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="rounded-2xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {summary.count > 0 && (
            <Button className="rounded-2xl" onClick={onSaveAll}>
              Save all
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
