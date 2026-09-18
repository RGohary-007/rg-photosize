import { createFileRoute } from "@tanstack/react-router";

type CheckStatus = "ok" | "warn" | "fail";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

async function reachable(url: string, label: string, id: string): Promise<Check> {
  try {
    const res = await fetch(url, { method: "GET" });
    // Any HTTP answer (even 401/404) proves the service is reachable from the server.
    return {
      id,
      label,
      status: res.status >= 500 ? "fail" : "ok",
      detail:
        res.status >= 500
          ? `${label} answered with a server error (${res.status}).`
          : `${label} is reachable (HTTP ${res.status}).`,
    };
  } catch (error) {
    return {
      id,
      label,
      status: "fail",
      detail: `Could not reach ${label}: ${error instanceof Error ? error.message : "unknown network error"}`,
    };
  }
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks: Check[] = [];

        checks.push({
          id: "site",
          label: "Site",
          status: "ok",
          detail: "The app server responded, so pages are being served.",
        });

        const supabaseReady = Boolean(
          process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"],
        );
        checks.push({
          id: "deployment",
          label: "Deployment settings",
          status: supabaseReady ? "ok" : "fail",
          detail: supabaseReady
            ? "Sign-in settings are present in this deployment."
            : "Sign-in settings are missing from this deployment, so signing in will fail. Publish again.",
        });

        const clientId =
          process.env["GOOGLE_OAUTH_CLIENT_ID"] ?? process.env["GOOGLE_PHOTOS_CLIENT_ID"] ?? null;
        checks.push({
          id: "google-photos-config",
          label: "Google Photos setup",
          status: clientId ? "ok" : "fail",
          detail: clientId
            ? "The Google Photos connection is set up for this deployment."
            : "The Google Photos connection is not set up in this deployment, so importing from Google Photos will not start.",
        });

        const [identity, picker] = await Promise.all([
          reachable("https://accounts.google.com/.well-known/openid-configuration", "Google sign-in", "google-identity"),
          reachable("https://photospicker.googleapis.com/v1/sessions", "Google Photos service", "google-photos-api"),
        ]);
        checks.push(identity, picker);

        const status: CheckStatus = checks.some((c) => c.status === "fail")
          ? "fail"
          : checks.some((c) => c.status === "warn")
            ? "warn"
            : "ok";

        return new Response(
          JSON.stringify({ status, checkedAt: new Date().toISOString(), checks }, null, 2),
          {
            status: status === "fail" ? 503 : 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
