import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
          "Sign in to PhotoSize with Google to sync your conversion history across devices.",
      },
      { property: "og:title", content: "Sign in — PhotoSize" },
      {
        property: "og:description",
        content: "Sign in to PhotoSize with Google to sync your conversion history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Could not sign in with Google. Please try again.");
        return;
      }
      if (result.redirected) return;
      void navigate({ to: "/" });
    } catch {
      toast.error("Could not sign in with Google. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Continue with Google to sync your conversion history across devices.
          Converting photos from this device never needs an account.
        </p>
      </div>

      <Button
        type="button"
        className="w-full rounded-2xl"
        disabled={busy}
        onClick={() => void signInWithGoogle()}
      >
        {busy ? "Opening Google…" : "Continue with Google"}
      </Button>

      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => void navigate({ to: "/" })}
      >
        Back to the converter
      </button>
    </main>
  );
}
