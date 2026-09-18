import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader as Loader2 } from "lucide-react";

import { getGooglePhotosConfig } from "@/lib/googlePhotos.functions";
import {
  loadGoogleIdentity,
  PHOTOS_SCOPE,
  type AuthorizeOutcome,
} from "@/lib/googleIdentity";

export const Route = createFileRoute("/google-photos-auth")({
  head: () => ({
    title: "Connect Google Photos — PhotoSize",
    meta: [{ name: "robots", content: "noindex" }],
  }),
  component: GooglePhotosAuthPage,
});

/**
 * Runs Google Identity Services from a top-level window. GIS cannot run inside
 * the Lovable preview iframe (accounts.google.com sets X-Frame-Options: DENY),
 * so the converter opens this route in a popup, the token is obtained here, and
 * the result is posted back to the opener.
 */
function postOutcome(outcome: AuthorizeOutcome) {
  const opener = window.opener;
  if (!opener || opener === window) return;
  try {
    opener.postMessage(
      { type: "photosize:google-photos-auth", outcome },
      window.location.origin,
    );
  } catch {
    /* ignore — opener may be gone */
  }
}

function GooglePhotosAuthPage() {
  const settled = useRef(false);
  const [status, setStatus] = useState<"loading" | "no-opener">("loading");

  useEffect(() => {
    let cancelled = false;
    const opener = window.opener;
    if (!opener || opener === window) {
      setStatus("no-opener");
      return;
    }

    (async () => {
      const config = await getGooglePhotosConfig();
      if (cancelled) return;
      if (!config.configured || !config.clientId) {
        postOutcome({ kind: "error", message: "Google Photos is not configured yet." });
        window.close();
        return;
      }

      try {
        await loadGoogleIdentity();
      } catch (error) {
        if (cancelled) return;
        postOutcome({
          kind: "error",
          message: error instanceof Error ? error.message : "Could not reach Google.",
        });
        window.close();
        return;
      }
      if (cancelled) return;

      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) {
        postOutcome({ kind: "error", message: "Google sign-in could not start. Please try again." });
        window.close();
        return;
      }

      const finish = (outcome: AuthorizeOutcome) => {
        if (settled.current) return;
        settled.current = true;
        postOutcome(outcome);
        setTimeout(() => window.close(), 50);
      };

      const client = oauth2.initTokenClient({
        client_id: config.clientId,
        scope: PHOTOS_SCOPE,
        callback: (response) => {
          if (response.access_token) {
            finish({
              kind: "token",
              token: response.access_token,
              expiresIn: Number(response.expires_in ?? 3600),
            });
            return;
          }
          const error = response.error ?? "";
          if (error === "access_denied") {
            finish({
              kind: "denied",
              message:
                "Google Photos access was not granted. Allow the photo picker permission to continue.",
            });
            return;
          }
          if (
            error.includes("interaction_required") ||
            error === "popup_closed_by_user" ||
            error === "cancelled"
          ) {
            finish({ kind: "cancelled" });
            return;
          }
          finish({
            kind: "error",
            message: response.error_description || error || "Google did not return access.",
          });
        },
        error_callback: (error) => {
          const type = error?.type ?? "";
          if (type === "popup_closed" || type === "popup_failed_to_open") {
            finish({ kind: "cancelled" });
            return;
          }
          finish({
            kind: "error",
            message: error?.message || "Google sign-in failed. Please try again.",
          });
        },
      });

      client.requestAccessToken({ prompt: "" });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "no-opener") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        This page opens automatically when connecting Google Photos. Close it and use the converter.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <p className="font-medium text-foreground">Opening Google sign-in…</p>
      <p className="text-xs">If nothing appears, allow popups for this site, then try again from the converter.</p>
    </div>
  );
}
