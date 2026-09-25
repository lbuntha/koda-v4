/**
 * Builds the hand-test pages for Koda Library:
 *
 *   docs/koda-library-phase0-check.html  — the data layer (tiles, splitting, the eight checks, the deck)
 *   docs/letter-wheel-demo.html          — the letter ring, spelling the starter stories
 *
 *   node scripts/build-library-pages.mjs
 *
 * Each is one self-contained file that runs the real source, bundled — open it in
 * a browser, no server needed. Nothing in the app imports these.
 */
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = [
  { entry: "src/library/dev/checkEntry.ts", template: "src/library/dev/checkPage.html", out: "docs/koda-library-phase0-check.html", globalName: "KodaLibrary" },
  { entry: "src/components/wheel/dev/WheelDemo.tsx", template: "src/components/wheel/dev/wheelDemo.html", out: "docs/letter-wheel-demo.html" },
];

for (const page of PAGES) {
  const result = await build({
    entryPoints: [path.join(root, page.entry)],
    bundle: true, format: "iife", globalName: page.globalName, write: false, minify: true,
    platform: "browser", target: "es2022", jsx: "automatic", loader: { ".json": "json" },
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
  });
  const js = result.outputFiles[0].text.replace(/<\/script>/gi, "<\\/script>");
  const template = await fs.readFile(path.join(root, page.template), "utf8");
  await fs.writeFile(path.join(root, page.out), template.replace("/*BUNDLE*/", () => js));
  console.log(`Wrote ${page.out} (${Math.round((js.length + template.length) / 1024)} KB)`);
}
