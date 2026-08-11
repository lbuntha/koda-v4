/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What Koda says, as opposed to what the screen shows.
 *
 * These are the cases where the two differ. A speaker cannot skip a character it
 * does not understand — it announces it — so anything decorative on screen
 * becomes a word in the middle of an instruction a child is trying to follow.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { toSpeech, VOICE } from "./kodaVoice";

describe("the spoken form of a line", () => {
  test("markdown emphasis is not read out", () => {
    // "**18**" was being announced as "star star eighteen star star".
    assert.equal(toSpeech("You counted **18** apples!"), "You counted 18 apples!");
  });

  test("emoji are dropped, not announced", () => {
    // "🎉" is read as "party popper" — mid-sentence, in the child's way.
    assert.equal(toSpeech("Great job! 🎉"), "Great job!");
    assert.equal(toSpeech("🎉 How many in total?"), "How many in total?");
  });

  test("a multi-codepoint emoji goes entirely, leaving no fragments", () => {
    // Skin tones and ZWJ sequences drop whole rather than leaving stray marks.
    assert.equal(toSpeech("Nice work 👍🏽 keep going"), "Nice work keep going");
    assert.equal(toSpeech("Family 👨‍👩‍👧 counted"), "Family counted");
  });

  test("an arrow becomes a word, so the numbers do not run together", () => {
    // Count Back's countdown reads "8 to 7 to 6" rather than "876".
    assert.equal(toSpeech("8 → 7 → 6"), "8 to 7 to 6");
  });

  test("a dash becomes a pause", () => {
    assert.equal(
      toSpeech("Tap each apple — the number did not change"),
      "Tap each apple, the number did not change",
    );
  });

  test("ordinary text is left exactly alone", () => {
    const plain = "Start at 8 and tap the last apple to count backward!";
    assert.equal(toSpeech(plain), plain);
  });

  test("there is one voice, and it is slower and higher than default", () => {
    // A child following an instruction needs the gap between words more than
    // they need it delivered quickly.
    assert.ok(VOICE.rate < 1, "speech should be slower than default");
    assert.ok(VOICE.pitch > 1, "speech should be higher than default");
    assert.equal(VOICE.lang, "en-US", "an unset lang lets the OS pick the phonetics");
  });
});
