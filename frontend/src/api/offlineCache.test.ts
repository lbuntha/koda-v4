/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The rules that decide whether a learner opening Koda with no network gets their plan
 * back or gets nothing. Each of these is a way the cache could hand new code an old shape,
 * or hand a child a plan from a week they have already finished.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import {
  accountKey,
  clearAllOfflineCache,
  courseKey,
  readCache,
  writeCache,
} from "./offlineCache";

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  (globalThis as any).localStorage = fakeLocalStorage();
});

describe("the plan a learner falls back on", () => {
  test("survives a round trip", () => {
    writeCache(courseKey("kid-1"), { queue: [{ skillId: "count-to-10" }] });
    assert.deepEqual(readCache<any>(courseKey("kid-1"))?.data.queue[0].skillId, "count-to-10");
  });

  test("is kept per learner, so a sibling never opens the wrong one", () => {
    writeCache(courseKey("kid-1"), { queue: ["a"] });
    writeCache(courseKey("kid-2"), { queue: ["b"] });
    assert.deepEqual(readCache<any>(courseKey("kid-1"))?.data.queue, ["a"]);
    assert.deepEqual(readCache<any>(courseKey("kid-2"))?.data.queue, ["b"]);
  });

  test("carries when it was read, so the UI can say how old it is", () => {
    const savedAt = Date.UTC(2026, 7, 2);
    writeCache(courseKey("kid-1"), { queue: [] }, savedAt);
    assert.equal(readCache<any>(courseKey("kid-1"), savedAt + 1000)?.savedAt, savedAt);
  });

  test("expires after a week away rather than resuming a stale day", () => {
    const savedAt = Date.now();
    writeCache(courseKey("kid-1"), { queue: [] }, savedAt);
    assert.ok(readCache(courseKey("kid-1"), savedAt + 6 * DAY_MS));
    assert.equal(readCache(courseKey("kid-1"), savedAt + 8 * DAY_MS), null);
  });

  test("is dropped when it was written by an older schema", () => {
    localStorage.setItem(
      courseKey("kid-1"),
      JSON.stringify({ version: 1, savedAt: Date.now(), data: { queue: [] } }),
    );
    assert.equal(readCache(courseKey("kid-1")), null);
    // and the unusable entry does not linger
    assert.equal(localStorage.getItem(courseKey("kid-1")), null);
  });

  test("a corrupt entry reads as absent instead of throwing on boot", () => {
    localStorage.setItem(courseKey("kid-1"), "{not json");
    assert.equal(readCache(courseKey("kid-1")), null);
  });

  test("signing out leaves nothing behind for the next person", () => {
    writeCache(accountKey(), { id: "kid-1" });
    writeCache(courseKey("kid-1"), { queue: [] });
    localStorage.setItem("koda_access_token", "keep-me");

    clearAllOfflineCache();

    assert.equal(readCache(accountKey()), null);
    assert.equal(readCache(courseKey("kid-1")), null);
    // Only the offline copies are the cache's business.
    assert.equal(localStorage.getItem("koda_access_token"), "keep-me");
  });
});
