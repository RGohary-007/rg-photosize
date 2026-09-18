import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Images, ShieldCheck, Camera, FileArchive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://rg-photosize.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhotoSize — Convert & Resize Photos: JPEG, PNG, WebP" },
      {
        name: "description",
        content:
          "Convert and resize photos to JPEG, PNG or WebP in your browser, keep the camera metadata, and save them individually or as a zip.",
      },
      { property: "og:title", content: "PhotoSize — Convert & Resize Photos" },
      {
        property: "og:description",
        content:
          "Resize and convert your photos to JPEG, PNG or WebP with optional metadata preservation.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/` },
      {
        property: "og:image",
        content:
          "https://images.pexels.com/photos/30591531/pexels-photo-30591531.jpeg?auto=compress&cs=tinysrgb&w=1200",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PhotoSize — Convert & Resize Photos" },
      {
        name: "twitter:description",
        content:
          "Resize and convert your photos to JPEG, PNG or WebP with optional metadata preservation.",
      },
      {
        name: "twitter:image",
        content:
          "https://images.pexels.com/photos/30591531/pexels-photo-30591531.jpeg?auto=compress&cs=tinysrgb&w=1200",
      },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "PhotoSize",
          url: `${BASE_URL}/`,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any modern web browser",
          description:
            "Convert and resize photos to JPEG, PNG or WebP in the browser while keeping camera metadata.",
        }),
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Camera,
    title: "Camera details kept",
    body: "The original capture date, camera and lens information travels into the converted JPEG.",
  },
  {
    icon: Images,
    title: "Batches up to 500 photos",
    body: "Pick a whole album, choose the size you want in pixels, and convert everything in one go.",
  },
  {
    icon: FileArchive,
    title: "Save one by one or as a zip",
    body: "Large batches download as a single zip file so nothing gets blocked or lost.",
  },
  {
    icon: ShieldCheck,
    title: "Photos stay on your device",
    body: "Converting happens right in your browser — your photos are never uploaded anywhere.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-ios">
            <Images className="size-5" />
          </div>
          <p className="text-lg font-semibold tracking-tight">PhotoSize</p>
          <div className="ml-auto">
            <Button
              size="sm"
              className="rounded-2xl"
              onClick={() =>
                void navigate({ to: signedIn ? "/convert" : "/auth" })
              }
            >
              {signedIn ? "Open the converter" : "Sign in with Google"}
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-14 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Resize and convert your photos — JPEG, PNG and WebP
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Choose the exact pixel size you need, keep the original camera date and details,
          and save your photos individually or as one zip file. Sign in with Google to start.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            className="h-11 rounded-2xl px-6 text-sm font-semibold"
            onClick={() =>
              void navigate({ to: signedIn ? "/convert" : "/auth" })
            }
          >
            {signedIn ? "Open the converter" : "Continue with Google"}
          </Button>
          <Link
            to="/bulk-heic-to-jpg"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Bulk HEIC to JPG converter
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-3xl border border-border bg-card p-5 shadow-ios"
            >
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
