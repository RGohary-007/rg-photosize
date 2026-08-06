import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`What is ${title}?`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl text-sm leading-relaxed">
        <p className="mb-1.5 font-semibold">{title}</p>
        <div className="space-y-2 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function RecommendedTick({ percent, label = "Recommended" }: { percent: number; label?: string }) {
  return (
    <div className="pointer-events-none relative h-5">
      <div
        className="absolute -translate-x-1/2 text-center"
        style={{ left: `${percent}%` }}
      >
        <div className="mx-auto h-2 w-px bg-primary/60" />
        <span className="mt-0.5 block text-[10px] font-medium tracking-wide whitespace-nowrap text-primary">
          {label} {percent}%
        </span>
      </div>
    </div>
  );
}
