import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_LANGUAGE, availableLanguages, catalogMessages, type CatalogMessage } from "../../../lib/i18n";

/**
 * A skill's translations, checked the way the app's own catalogs are.
 *
 *   describeSkillLocales("counting", {
 *     complete: ["km"],                         // languages that must have every line
 *     source: { dir: "src/skills/counting", helper: "tc" },
 *   });
 *
 * Import the skill before calling this, so its catalogs are registered.
 */
export function describeSkillLocales(
  skillId: string,
  options: { complete?: string[]; source?: { dir: string; helper: string } } = {},
): void {
  const prefix = `skills.${skillId}.`;
  const own = (code: string) =>
    new Map([...catalogMessages(code)].filter(([key]) => key.startsWith(prefix)));

  const placeholders = (message: CatalogMessage | undefined): string =>
    [...new Set([...(typeof message === "string" ? message : Object.values(message ?? {}).join(" ")).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
      .sort()
      .join();

  describe(`${skillId} translations`, () => {
    const base = own(BASE_LANGUAGE);
    const others = availableLanguages()
      .map((l) => l.code)
      .filter((code) => code !== BASE_LANGUAGE && own(code).size > 0);

    it("has an English catalog", () => {
      expect(base.size).toBeGreaterThan(0);
    });

    it.each(others.map((code) => [code]))("%s has no line English lacks", (code) => {
      expect([...own(code).keys()].filter((key) => !base.has(key))).toEqual([]);
    });

    it.each(others.map((code) => [code]))("%s fills the same blanks as English", (code) => {
      const mismatched = [...own(code)]
        .filter(([key, message]) => placeholders(message) !== placeholders(base.get(key)))
        .map(([key]) => key);
      expect(mismatched).toEqual([]);
    });

    it.each((options.complete ?? []).map((code) => [code]))("%s translates every line", (code) => {
      const theirs = own(code);
      expect([...base.keys()].filter((key) => !theirs.has(key))).toEqual([]);
    });

    if (options.source) {
      const { dir, helper } = options.source;
      it(`never asks ${helper}() for a line English does not have`, () => {
        const used = new Set<string>();
        const walk = (path: string) => {
          for (const entry of readdirSync(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
              const text = readFileSync(full, "utf8");
              for (const m of text.matchAll(new RegExp(`\\b${helper}\\(\\s*"([\\w.]+)"`, "g"))) used.add(m[1]);
            }
          }
        };
        walk(join(process.cwd(), dir));
        expect([...used].filter((key) => !base.has(prefix + key))).toEqual([]);
      });
    }
  });
}
