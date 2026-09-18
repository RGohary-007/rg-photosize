import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type CheckStatus = "ok" | "warn" | "fail";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

interface HealthReport {
  status: CheckStatus;
  checkedAt: string;
  checks: Check[];
}

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Status – PhotoSize" },
      {
        name: "description",
        content:
          "Live status page for PhotoSize: confirms the site is up and reports publishing or Google Photos connection problems.",
      },
      { property: "og:title", content: "Status – PhotoSize" },
      {
        property: "og:description",
        content: "Check whether PhotoSize is up and whether Google Photos importing is working.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HealthPage,
});

const ICONS: Record<CheckStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const TONE: Record<CheckStatus, string> = {
  ok: "text-primary",
  warn: "text-amber-500",
  fail: "text-destructive",
};

function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/health", { cache: "no-store" });
      const data = (await res.json()) as HealthReport;
      setReport(data);
    } catch {
      setReport(null);
      setError(
        "The site did not answer. The latest version may not have finished publishing, or publishing failed — try publishing again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const headline =
    error || !report
      ? "Something is wrong"
      : report.status === "ok"
        ? "Everything is working"
        : report.status === "warn"
          ? "Working, with warnings"
          : "Something is wrong";

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Status</h1>
      <p className="mt-2 text-muted-foreground">
        A quick check that the site opens and that photo importing from Google Photos can work.
      </p>

      <div className="mt-8 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              (() => {
                const status: CheckStatus = error || !report ? "fail" : report.status;
                const Icon = ICONS[status];
                return <Icon className={`size-5 ${TONE[status]}`} aria-hidden />;
              })()
            )}
            <div>
              <p className="font-medium">{loading ? "Checking…" : headline}</p>
              {report && !loading ? (
                <p className="text-sm text-muted-foreground">
                  Last checked {new Date(report.checkedAt).toLocaleTimeString()}
                </p>
              ) : null}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void run()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Check again
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
        ) : null}

        {report ? (
          <ul className="mt-5 space-y-3">
            {report.checks.map((check) => {
              const Icon = ICONS[check.status];
              return (
                <li key={check.id} className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[check.status]}`} aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-sm text-muted-foreground">{check.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
