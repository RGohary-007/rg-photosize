import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert as AlertCircle, Loader as Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PhotoSize Photo Converter" },
      {
        name: "description",
        content:
          "Sign in to PhotoSize with Google to resize and convert your photos.",
      },
      { property: "og:title", content: "Sign in — PhotoSize" },
      {
        property: "og:description",
        content: "Sign in to PhotoSize with Google to resize and convert your photos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

const CANCEL_HINTS = [
  "access_denied",
  "cancel",
  "closed",
  "dismiss",
  "popup",
  "abort",
  "user_denied",
];

function looksCancelled(raw: string) {
  const text = raw.toLowerCase();
  return CANCEL_HINTS.some((hint) => text.includes(hint));
}

function AuthPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/convert", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: "/convert", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // Google can send the outcome back in the URL when the full-page flow returns.
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search + "&" + window.location.hash.replace(/^#/, ""),
    );
    const err = params.get("error") ?? params.get("error_description");
    if (!err) return;
    if (looksCancelled(err)) {
      setStatus({ kind: "cancelled" });
    } else {
      setStatus({ kind: "error", message: err });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function signInWithGoogle() {
    setStatus({ kind: "busy" });
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        const message =
          typeof result.error === "string"
            ? result.error
            : (result.error as { message?: string }).message ?? "Google sign-in failed.";
        if (looksCancelled(message)) {
          setStatus({ kind: "cancelled" });
          toast.info("Google sign-in was cancelled.");
        } else {
          setStatus({ kind: "error", message });
          toast.error("Google sign-in did not work. Please try again.");
        }
        return;
      }

      if (result.redirected) return;

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus({ kind: "cancelled" });
        return;
      }
      void navigate({ to: "/convert", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed.";
      if (looksCancelled(message)) {
        setStatus({ kind: "cancelled" });
      } else {
        setStatus({ kind: "error", message });
        toast.error("Google sign-in did not work. Please try again.");
      }
    }
  }

  const busy = status.kind === "busy";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Continue with Google to open the photo converter. Your photos are converted on
          your own device and are never uploaded.
        </p>
      </div>

      {status.kind === "cancelled" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">Sign-in was cancelled.</span> The Google window
            was closed before finishing. Tap the button to try again.
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">Google sign-in didn’t work.</p>
            <p className="mt-0.5 text-muted-foreground">
              Please try again. If it keeps failing, check that pop-ups are allowed for this
              site.
            </p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{status.message}</p>
          </div>
        </div>
      )}

      <Button
        type="button"
        className="w-full rounded-2xl"
        disabled={busy}
        onClick={() => void signInWithGoogle()}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy
          ? "Opening Google…"
          : status.kind === "idle"
            ? "Continue with Google"
            : "Try Google again"}
      </Button>

      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => void navigate({ to: "/" })}
      >
        Back to the home page
      </button>
    </main>
  );
}
