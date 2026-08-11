/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The casting contract, which is now the thing other components build on.
 *
 * What is worth pinning here is not that the functions run — it is that the two
 * ends agree. A panel writes with `writeGuideCast` and a canvas reads with
 * `guidePropsFor`, and every failure this module exists to prevent is silent:
 * the panel keeps saving, the board keeps drawing the built-in cast, and nothing
 * anywhere says why. So the round trip is the test.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { guidePropsFor, readGuideCast, readLegacyActor, writeGuideCast, clearLegacyActor } from "./casting";

test("what the panel writes is what the canvas reads", () => {
  const config = writeGuideCast({}, "waiting", "Sleepy Bear");
  assert.deepEqual(guidePropsFor({ config }).guideCast, { waiting: "Sleepy Bear" });
});

test("a second moment joins the first rather than replacing it", () => {
  let config: Record<string, unknown> = writeGuideCast({}, "talking", "Panda");
  config = { ...config, ...writeGuideCast(config, "celebrating", "shape-happy") };
  assert.deepEqual(readGuideCast(config), { talking: "Panda", celebrating: "shape-happy" });
});

test("a moment set back to Auto is removed, not stored empty", () => {
  const cast = writeGuideCast({ mascotStyles: { talking: "Panda", waiting: "Sleepy Bear" } }, "waiting", "");
  assert.deepEqual(cast.mascotStyles, { talking: "Panda" });
});

test("the last moment leaving takes the whole key with it", () => {
  /*
    `undefined` rather than `{}`. An empty object is a slide that says "I was
    cast about, and the answer is nobody" — which reads as a real choice to
    anything downstream, and survives a round trip through JSON as one.
  */
  const cast = writeGuideCast({ mascotStyles: { talking: "Panda" } }, "talking", "");
  assert.equal(cast.mascotStyles, undefined);
});

test("a slide nobody cast about hands the canvas nothing", () => {
  const props = guidePropsFor({ config: {}, technique: "count" });
  assert.equal(props.guideCast, undefined);
  assert.equal(props.guideStyle, undefined);
  assert.equal(props.guideComponent, "count");
});

test("reading an uncast slide still gives something to index", () => {
  // The panel indexes this per role to fill five selects; `undefined` there
  // would mean five guards for a case that is the normal state of a new slide.
  assert.deepEqual(readGuideCast(undefined), {});
});

test("a legacy slide-wide actor is still handed to the canvas", () => {
  // Authored before casting was per-moment. It keeps its character.
  const props = guidePropsFor({ config: { mascotStyle: "BotTalking" } });
  assert.equal(props.guideStyle, "BotTalking");
});

test("an empty legacy actor is not an actor", () => {
  // A cleared select writes "", and "" must not read back as a character the
  // panel then offers to clear — an empty row nobody can dismiss.
  assert.equal(readLegacyActor({ mascotStyle: "" }), undefined);
  assert.equal(readLegacyActor({}), undefined);
});

test("clearing the legacy actor leaves the per-moment cast alone", () => {
  const config = { mascotStyle: "BotTalking", mascotStyles: { talking: "Panda" } };
  const next = { ...config, ...clearLegacyActor() };
  assert.equal(readLegacyActor(next), undefined);
  assert.deepEqual(readGuideCast(next), { talking: "Panda" });
});
