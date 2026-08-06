import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileArchive, Download } from "lucide-react";

export function SaveAllDialog({
  open,
  count,
  onOpenChange,
  onIndividual,
  onZip,
}: {
  open: boolean;
  count: number;
  onOpenChange: (v: boolean) => void;
  onIndividual: () => void;
  onZip: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save {count} converted photo{count === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>How would you like them saved?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 rounded-2xl py-3 text-left"
            onClick={onIndividual}
          >
            <Download className="size-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold">Individual files</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Saves each photo separately to your device.
              </span>
            </span>
          </Button>
          <Button
            className="h-auto justify-start gap-3 rounded-2xl py-3 text-left"
            onClick={onZip}
          >
            <FileArchive className="size-5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">One .zip archive</span>
              <span className="block text-xs font-normal opacity-80">
                Bundles everything into a single download.
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
