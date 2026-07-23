import test from "node:test";
import assert from "node:assert/strict";
import { isSafeSvgMarkup, sanitizeSvgMarkup } from "./svgSafety";

test("accepts ordinary SVG markup", () => {
  const markup = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>';
  assert.equal(isSafeSvgMarkup(markup), true);
  assert.equal(sanitizeSvgMarkup(markup), markup);
});

test("rejects executable SVG content", () => {
  assert.equal(isSafeSvgMarkup("<svg><script>alert(1)</script></svg>"), false);
  assert.equal(isSafeSvgMarkup('<svg><path onload="alert(1)" /></svg>'), false);
  assert.equal(sanitizeSvgMarkup('<svg><a href="javascript:alert(1)" /></svg>'), "");
});
