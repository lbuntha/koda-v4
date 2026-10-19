// @vitest-environment node
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

/**
 * The Node server (`server.ts`) shares a few files with the web app (Rebus's brief
 * and prompt checks, for one). Anything it pulls in must run in Node: a browser-only
 * module (the sync client reads `import.meta.env`, which a CommonJS bundle does not
 * have) crashes the container at start, and Cloud Run then rolls the deploy back.
 * Tests of the web app never notice, so this builds the server the way the deploy
 * does and checks what it would load.
 */
describe("the Node server's bundle", () => {
  it("does not reach browser-only code", async () => {
    const result = await build({
      entryPoints: ["server.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      packages: "external",
      metafile: true,
      write: false,
      logLevel: "silent",
    });
    const files = Object.keys(result.metafile.inputs);
    const browserOnly = files.filter((f) => /^src\/lib\/(sync|preferences|i18n)\//.test(f) || /^src\/lib\/(sync|preferences)\.ts$/.test(f) || f.includes("src/components/") || f.includes("src/library/photos"));
    expect(browserOnly).toEqual([]);
  });

  it("does not use import.meta, which a CommonJS bundle cannot read", async () => {
    const result = await build({ entryPoints: ["server.ts"], bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent" });
    const code = result.outputFiles[0].text;
    expect(code).not.toMatch(/import_meta\.env/);
  });
});
