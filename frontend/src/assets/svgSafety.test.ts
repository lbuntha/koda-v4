import test from "node:test";
import assert from "node:assert/strict";
import { isSafeSvgMarkup, normalizeSvgDocumentMarkup, sanitizeSvgMarkup } from "./svgSafety";

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

test("adds the SVG namespace so library artwork renders inside an <img>", () => {
  const normalized = normalizeSvgDocumentMarkup(
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" /></svg>',
  );
  assert.equal(
    normalized,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" /></svg>',
  );
});

test("keeps an existing namespace and declares xlink only when it is used", () => {
  const already = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>';
  assert.equal(normalizeSvgDocumentMarkup(already), already);
  assert.match(
    normalizeSvgDocumentMarkup('<svg viewBox="0 0 8 8"><use xlink:href="#star" /></svg>'),
    /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/,
  );
  assert.doesNotMatch(normalizeSvgDocumentMarkup('<svg viewBox="0 0 8 8"></svg>'), /xlink/);
});

test("hyphenates JSX-style presentation attributes but not real camelCase SVG ones", () => {
  const normalized = normalizeSvgDocumentMarkup(
    '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">'
    + '<linearGradient gradientUnits="userSpaceOnUse"><stop stopColor="#fff" stopOpacity=".5" /></linearGradient>'
    + '<path strokeWidth="3" strokeLinecap="round" fillOpacity=".8" textAnchor="middle" />'
    + "</svg>",
  );
  assert.match(normalized, /stroke-width="3" stroke-linecap="round" fill-opacity=".8" text-anchor="middle"/);
  assert.match(normalized, /stop-color="#fff" stop-opacity=".5"/);
  assert.match(normalized, /viewBox="0 0 24 24"/);
  assert.match(normalized, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(normalized, /gradientUnits="userSpaceOnUse"/);
});

test("leaves markup that is not an SVG document untouched", () => {
  assert.equal(normalizeSvgDocumentMarkup("  not markup "), "not markup");
  assert.equal(normalizeSvgDocumentMarkup("<svg unterminated"), "<svg unterminated");
});
