/**
 * The failure that motivated this module: a studio session whose library GET failed kept its
 * empty thumbnail map, then saved it over the account's real library and said "Saved".
 */

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import {
  accountKey,
  readCache,
  THUMBNAILS_KEY,
  writeCache,
  writeJson,
} from "./libraryCache";

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

const LIBRARY = {
  assets: [{ id: "svg-apple", label: "Apple" }] as any,
  overrides: { "cherry": { assetId: "svg-apple" } } as any,
  deletedSystemAssetIds: ["kid-nav-home"],
  techniqueThumbnails: { count_on: "svg-apple", subitize: "svg-pear" },
  masteryGateAssets: { beginner: "svg-apple", developing: "svg-pear" },
};

beforeEach(() => {
  (globalThis as any).localStorage = fakeLocalStorage();
});

describe("the cache round-trips every part of the library", () => {
  test("thumbnails come back, not just assets and overrides", () => {
    writeCache("owner-1", LIBRARY);
    assert.deepEqual(readCache("owner-1"), LIBRARY);
  });

  test("an account only sees its own library", () => {
    writeCache("owner-1", LIBRARY);
    const other = readCache("owner-2");
    assert.deepEqual(other.assets, []);
    assert.deepEqual(other.techniqueThumbnails, {});
    assert.deepEqual(other.masteryGateAssets, {});
  });

  test("a missing cache reads as empty rather than throwing", () => {
    assert.deepEqual(readCache("never-seen"), {
      assets: [], overrides: {}, deletedSystemAssetIds: [], techniqueThumbnails: {}, masteryGateAssets: {},
    });
  });

  test("corrupt JSON reads as empty rather than throwing", () => {
    localStorage.setItem(accountKey(THUMBNAILS_KEY, "owner-1"), "{not json");
    assert.deepEqual(readCache("owner-1").techniqueThumbnails, {});
  });

  test("a store that refuses writes is reported, not thrown", () => {
    (globalThis as any).localStorage = {
      ...fakeLocalStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    assert.equal(writeJson("k", { a: 1 }), false);
  });
});
