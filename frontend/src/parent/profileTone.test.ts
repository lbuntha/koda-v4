import test from "node:test";
import assert from "node:assert/strict";
import { PROFILE_TONES, PROFILE_TONE_CLASS, profileToneFor } from "./profileTone";

test("a child keeps the same tile colour every time", () => {
  const first = profileToneFor("6a64a2ffdde6178749776196");
  assert.equal(profileToneFor("6a64a2ffdde6178749776196"), first);
  assert.ok(PROFILE_TONES.includes(first));
});

test("different children get spread across the palette", () => {
  const ids = Array.from({ length: 40 }, (_, index) => `child-${index}`);
  const used = new Set(ids.map(profileToneFor));
  // Not a distribution proof — just that the hash is not collapsing onto one colour.
  assert.ok(used.size >= 4, `expected several tones, saw ${used.size}`);
});

test("degenerate seeds still return a usable tone", () => {
  assert.ok(PROFILE_TONES.includes(profileToneFor("")));
  assert.ok(PROFILE_TONES.includes(profileToneFor("🦊")));
});

test("every tone has tile classes", () => {
  PROFILE_TONES.forEach(tone => {
    assert.match(PROFILE_TONE_CLASS[tone], /^from-\[#[0-9A-F]{6}\] to-\[#[0-9A-F]{6}\] shadow-/);
  });
});
