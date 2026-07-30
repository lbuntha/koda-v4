/**
 * The guardian stash, which is what lets a parent hand the tablet to a child and get their
 * own session back afterwards.
 *
 * Found by driving the real UI: tapping a child's profile twice replaced the stashed parent
 * tokens with the child's, so the parent could never be restored — they were signed out with
 * no indication why. Nothing in the type system or the suite could see it, because both calls
 * are individually correct.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { tokenStore } from "./client";

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

const PARENT = { access: "parent-access", refresh: "parent-refresh" };
const CHILD = { access: "child-access", refresh: "child-refresh" };

beforeEach(() => {
  (globalThis as any).localStorage = fakeLocalStorage();
});

/** What `startChildPlay` does: set the adult aside, then activate the child. */
function playAs(child: { access: string; refresh: string }) {
  tokenStore.stashGuardian();
  tokenStore.set(child.access, child.refresh);
}

describe("handing the tablet to a child and getting it back", () => {
  test("the parent's session returns when play ends", () => {
    tokenStore.set(PARENT.access, PARENT.refresh);
    playAs(CHILD);
    assert.equal(tokenStore.access, CHILD.access);

    tokenStore.restoreGuardian();
    assert.equal(tokenStore.access, PARENT.access);
    assert.equal(tokenStore.refresh, PARENT.refresh);
  });

  test("tapping a profile twice does not cost the parent their session", () => {
    tokenStore.set(PARENT.access, PARENT.refresh);
    playAs(CHILD);
    playAs(CHILD); // the double tap

    tokenStore.restoreGuardian();
    assert.equal(tokenStore.access, PARENT.access);
  });

  test("switching to a sibling mid-play still returns to the parent, not the first child", () => {
    const sibling = { access: "sibling-access", refresh: "sibling-refresh" };
    tokenStore.set(PARENT.access, PARENT.refresh);
    playAs(CHILD);
    playAs(sibling);

    assert.equal(tokenStore.access, sibling.access);
    tokenStore.restoreGuardian();
    assert.equal(tokenStore.access, PARENT.access);
  });

  test("restoring clears the stash, so the next play stashes the adult afresh", () => {
    tokenStore.set(PARENT.access, PARENT.refresh);
    playAs(CHILD);
    tokenStore.restoreGuardian();
    assert.equal(tokenStore.hasGuardianStash(), false);

    // A later sign-in as a different adult must be the one stashed next time.
    tokenStore.set("other-parent-access", "other-parent-refresh");
    playAs(CHILD);
    tokenStore.restoreGuardian();
    assert.equal(tokenStore.access, "other-parent-access");
  });

  test("restoring when nothing was stashed leaves the session alone", () => {
    tokenStore.set(PARENT.access, PARENT.refresh);
    tokenStore.restoreGuardian();
    assert.equal(tokenStore.access, PARENT.access);
  });

  test("a signed-out browser stashes nothing", () => {
    tokenStore.stashGuardian();
    assert.equal(tokenStore.hasGuardianStash(), false);
  });
});
