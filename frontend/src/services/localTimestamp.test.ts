import assert from "node:assert/strict";
import test from "node:test";
import { localIsoTimestamp } from "./logSchema";

/**
 * Every learning event is stamped with this, and both the streak and the mastery engines read
 * a *date* off the front of it. Two properties matter: it must name the learner's own calendar
 * day, and it must still describe the same instant.
 *
 * The host's real timezone is irrelevant to these — `atOffset` supplies a Date whose local
 * getters answer for a chosen offset, so the cases are deterministic anywhere.
 */
const atOffset = (isoUtc: string, offsetMinutesEastOfUtc: number): Date => {
  const shifted = new Date(new Date(isoUtc).getTime() + offsetMinutesEastOfUtc * 60_000);
  return {
    getFullYear: () => shifted.getUTCFullYear(),
    getMonth: () => shifted.getUTCMonth(),
    getDate: () => shifted.getUTCDate(),
    getHours: () => shifted.getUTCHours(),
    getMinutes: () => shifted.getUTCMinutes(),
    getSeconds: () => shifted.getUTCSeconds(),
    getMilliseconds: () => shifted.getUTCMilliseconds(),
    // The platform reports minutes *behind* UTC, so east of Greenwich is negative.
    getTimezoneOffset: () => -offsetMinutesEastOfUtc,
  } as unknown as Date;
};

test("the timestamp carries an offset instead of collapsing to Z", () => {
  const stamp = localIsoTimestamp(atOffset("2026-07-27T12:00:00.000Z", 7 * 60));
  assert.match(stamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  assert.doesNotMatch(stamp, /Z$/);
});

test("the date names the learner's day, not Greenwich's", () => {
  // 23:30 UTC on the 27th is 06:30 on the 28th in Bangkok — the case that credited a
  // morning practice to the previous day and left the streak looking broken.
  const stamp = localIsoTimestamp(atOffset("2026-07-27T23:30:00.000Z", 7 * 60));
  assert.equal(stamp.slice(0, 10), "2026-07-28");
  assert.equal(new Date("2026-07-27T23:30:00.000Z").toISOString().slice(0, 10), "2026-07-27");
});

test("west of Greenwich reads the other way", () => {
  // 03:00 UTC on the 28th is 22:00 on the 27th in New York.
  const stamp = localIsoTimestamp(atOffset("2026-07-28T03:00:00.000Z", -5 * 60));
  assert.equal(stamp.slice(0, 10), "2026-07-27");
  assert.match(stamp, /-05:00$/);
});

test("the instant survives the change of frame", () => {
  const instant = "2026-07-27T23:30:00.000Z";
  for (const offset of [7 * 60, -5 * 60, 0, 330, -210]) {
    const stamp = localIsoTimestamp(atOffset(instant, offset));
    assert.equal(
      new Date(stamp).getTime(),
      new Date(instant).getTime(),
      `offset ${offset} did not round-trip: ${stamp}`,
    );
  }
});

test("half-hour offsets are formatted, not truncated", () => {
  assert.match(localIsoTimestamp(atOffset("2026-07-27T12:00:00.000Z", 330)), /\+05:30$/);
  assert.match(localIsoTimestamp(atOffset("2026-07-27T12:00:00.000Z", -210)), /-03:30$/);
});

test("UTC reads as +00:00 rather than a negative zero", () => {
  assert.match(localIsoTimestamp(atOffset("2026-07-27T12:00:00.000Z", 0)), /\+00:00$/);
});
