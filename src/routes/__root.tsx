import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PhotoSize — Resize & convert photos" },
      {
        name: "description",
        content:
          "PhotoSize resizes and converts photos to JPEG, HEIC, PNG or WebP right in your browser, with camera metadata kept.",
      },
      { name: "author", content: "PhotoSize" },
      { property: "og:site_name", content: "PhotoSize" },
      { property: "og:title", content: "PhotoSize — Resize & convert photos" },
      {
        property: "og:description",
        content: "Resize and convert photos in your browser — JPEG, HEIC, PNG and WebP.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "https://images.pexels.com/photos/30591531/pexels-photo-30591531.jpeg?auto=compress&cs=tinysrgb&w=1200",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PhotoSize — Resize & convert photos" },
      {
        name: "twitter:description",
        content: "Resize and convert photos in your browser — JPEG, HEIC, PNG and WebP.",
      },
      {
        name: "twitter:image",
        content: "https://images.pexels.com/photos/30591531/pexels-photo-30591531.jpeg?auto=compress&cs=tinysrgb&w=1200",
      },
      {
        name: "google-site-verification",
        content: "wer_wUvqTRspKphIPWcV0b1vdb7QtxWdbVlORHMFhXU",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "PhotoSize",
              url: "https://rg-photosize.lovable.app",
              description:
                "PhotoSize is a browser-based photo converter that resizes photos and converts them to JPEG, HEIC, PNG or WebP while keeping camera metadata.",
            },
            {
              "@type": "WebSite",
              name: "PhotoSize",
              url: "https://rg-photosize.lovable.app",
              description:
                "Resize and convert photos to JPEG, HEIC, PNG or WebP directly in the browser.",
            },
          ],
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
