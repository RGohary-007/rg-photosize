// This platform config owns the full TanStack production pipeline, including
// Cloudflare bundling, environment injection, and React/TanStack deduplication.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
