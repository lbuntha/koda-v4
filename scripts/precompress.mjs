/**
 * Writes a brotli and a gzip copy beside every compressible file in dist/.
 *
 * Runs after `vite build`. The bundled server sends the smallest copy the
 * browser accepts (see `serveCompressed` in server.ts); nothing in front of it
 * on Cloud Run compresses, so without these the 3.4 MB entry chunk crossed the
 * wire at full size — 0.6 MB as brotli. Done once here at maximum quality
 * rather than per request, where brotli at that quality is far too slow.
 *
 * After the build on purpose: the service worker's precache list is written
 * during `vite build`, so these copies never enter it — the worker fetches the
 * plain URL and the encoding is invisible to it.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

const DIST = path.resolve("dist");
// Audio, images and fonts are compressed already; another pass only costs CPU.
const COMPRESSIBLE = /\.(?:js|mjs|css|html|svg|json|webmanifest|txt)$/;
// Below this a compressed copy saves less than its own headers.
const MIN_BYTES = 1024;

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

let raw = 0;
let br = 0;
let count = 0;
for await (const file of files(DIST)) {
  if (!COMPRESSIBLE.test(file)) continue;
  const body = await readFile(file);
  if (body.length < MIN_BYTES) continue;
  const brotli = brotliCompressSync(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
    },
  });
  await writeFile(`${file}.br`, brotli);
  await writeFile(`${file}.gz`, gzipSync(body, { level: 9 }));
  raw += body.length;
  br += brotli.length;
  count += 1;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`precompress: ${count} files, ${mb(raw)} MB → ${mb(br)} MB as brotli`);
