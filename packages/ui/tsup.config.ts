import { defineConfig } from "tsup";

// Preserve the client boundary when these bundles are imported by Next.js.
export default defineConfig({ banner: { js: '"use client";' } });
