import test from "node:test";
import assert from "node:assert/strict";
import {
  oppositeThemeMode,
  parseThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  systemThemeMode,
} from "./appTheme";

test("only light and dark parse as a stored preference", () => {
  assert.equal(parseThemeMode("dark"), "dark");
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("DARK"), null);
  assert.equal(parseThemeMode(""), null);
  assert.equal(parseThemeMode(null), null);
  assert.equal(parseThemeMode(undefined), null);
});

test("toggling flips the mode", () => {
  assert.equal(oppositeThemeMode("light"), "dark");
  assert.equal(oppositeThemeMode("dark"), "light");
});

test("a stored choice wins over the OS, otherwise the OS decides", () => {
  assert.equal(resolveThemeMode("light", "dark"), "light");
  assert.equal(resolveThemeMode("dark", "light"), "dark");
  assert.equal(resolveThemeMode(null, "dark"), "dark");
  assert.equal(resolveThemeMode(null, "light"), "light");
});

test("theme reads degrade to light when there is no browser", () => {
  // Runs under node with no `window`: the helpers must not throw on the server or in tests.
  assert.equal(readStoredThemeMode(), null);
  assert.equal(systemThemeMode(), "light");
});
