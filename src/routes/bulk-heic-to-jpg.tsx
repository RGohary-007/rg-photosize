import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Images, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

const URL = "https://rg-photosize.lovable.app/bulk-heic-to-jpg";
const TITLE = "Bulk HEIC to JPG Converter — Convert iPhone Photos";
const DESCRIPTION =
  "Convert HEIC photos to JPG in bulk, right in your browser. Batch-resize iPhone images, keep EXIF camera data and capture dates, and download everything as a zip.";

const faqs = [
  {
    q: "How do I convert many HEIC files to JPG at once?",
    a: "Add or drag in all of your HEIC photos, choose JPEG as the output format, then convert. Every photo is processed in one batch and you can download them individually or as a single zip file.",
  },
  {
    q: "Are my photos uploaded to a server?",
    a: "No. Conversion happens in your browser using your own device, so your HEIC photos never leave your computer or phone.",
  },
  {
    q: "Does bulk conversion keep camera metadata?",
    a: "Yes. With Preserve metadata enabled, the JPG output keeps EXIF data such as camera model, lens, ISO and the original capture date and time.",
  },
  {
    q: "Can I resize while converting HEIC to JPG?",
    a: "Yes. Turn on resize and set a maximum width and height; each photo is fitted inside that box while keeping its aspect ratio.",
  },
];

export const Route = createFileRoute("/bulk-heic-to-jpg")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Bulk HEIC to JPG Converter" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://rg-photosize.lovable.app/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Bulk HEIC to JPG",
              item: URL,
            },
          ],
        }),
      },
    ],
  }),
  component: BulkHeicToJpg,
});

function BulkHeicToJpg() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Bulk HEIC to JPG</span>
      </nav>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Bulk HEIC to JPG converter
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Turn a whole folder of iPhone HEIC photos into universally readable JPG files
          without uploading anything. Batch convert, optionally resize, keep your camera
          metadata and original capture dates, then save every photo at once or as a zip.
        </p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link to="/">
              Start converting
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="mt-12" aria-labelledby="why">
        <h2 id="why" className="text-xl font-semibold text-foreground">
          Why convert HEIC to JPG
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          HEIC is Apple's default photo format. It saves space on your iPhone, but many
          Windows apps, older photo editors, web upload forms and printing services still
          reject it. JPG works everywhere, which makes it the safest format for sharing,
          archiving and submitting photos.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Images,
              t: "Whole batches at once",
              d: "Drop in dozens of HEIC files and convert them in a single pass.",
            },
            {
              icon: ShieldCheck,
              t: "Metadata preserved",
              d: "Camera, lens, ISO and the original date and time are written into each JPG.",
            },
            {
              icon: Zap,
              t: "Private and offline",
              d: "Everything runs in your browser — no uploads, no accounts required.",
            },
            {
              icon: FileDown,
              t: "One zip download",
              d: "Save each JPG separately or bundle the whole batch into one zip.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card p-4">
              <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {t}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="text-xl font-semibold text-foreground">
          How bulk HEIC to JPG conversion works
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          {[
            "Open the converter and add or drag in all of your HEIC photos.",
            "Pick JPEG as the output format and set a quality level.",
            "Optionally turn on resize and set a maximum width and height.",
            "Keep Preserve metadata on so camera details and capture dates travel with each file.",
            "Convert, then save the photos individually or download them as one zip.",
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="faq">
        <h2 id="faq" className="text-xl font-semibold text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-4 space-y-5">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-sm font-medium text-foreground">{f.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Ready to convert your HEIC photos?
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          No sign-up needed for device photos — add your files and convert.
        </p>
        <Button asChild className="mt-4">
          <Link to="/">Open the converter</Link>
        </Button>
      </div>
    </main>
  );
}
