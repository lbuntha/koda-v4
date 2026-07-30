import assert from "node:assert/strict";
import test from "node:test";
import { apiFileUrl, isApiConfigured } from "./client";

/**
 * These run with VITE_API_URL unset, so the API is not configured and every path is passed
 * through. That is the contract that matters here: `apiFileUrl` must never rewrite artwork it
 * does not own, and must never produce a broken URL when there is no API to join against.
 */
test("frontend and authored artwork is never pointed at the API", () => {
  assert.equal(apiFileUrl("/assets/owl-mascot.svg"), "/assets/owl-mascot.svg");
  assert.equal(apiFileUrl("https://cdn.example.com/star.svg"), "https://cdn.example.com/star.svg");
  assert.equal(apiFileUrl("http://example.com/a.png"), "http://example.com/a.png");
});

test("absent artwork stays absent rather than becoming a bad URL", () => {
  assert.equal(apiFileUrl(null), null);
  assert.equal(apiFileUrl(undefined), undefined);
  assert.equal(apiFileUrl(""), "");
});

test("release artwork is left relative when no API base is configured", () => {
  assert.equal(isApiConfigured(), false);
  assert.equal(apiFileUrl("/learning/assets/rel-1/star"), "/learning/assets/rel-1/star");
});
