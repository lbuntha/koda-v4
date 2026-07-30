import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mayPersistRemotely } from "./persistenceGuard";

describe("saving requires a successful load first", () => {
  test("a normal session may save", () => {
    assert.equal(mayPersistRemotely({ hydrated: true, hydrationFailed: false }), true);
  });

  test("a session whose load failed may not — this is the data-loss guard", () => {
    assert.equal(mayPersistRemotely({ hydrated: true, hydrationFailed: true }), false);
  });

  test("nothing may save before the first load completes", () => {
    assert.equal(mayPersistRemotely({ hydrated: false, hydrationFailed: false }), false);
  });
});
