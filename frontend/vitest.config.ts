import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * DOM-level component tests only (`*.test.tsx`).
 *
 * Pure-logic `*.test.ts` files keep running on `tsx --test` (node:test) — see the
 * "test:unit" script. Splitting by extension means neither runner tries to collect
 * the other's files, and `npm test` runs both.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.tsx"],
  },
});
