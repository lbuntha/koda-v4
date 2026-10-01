import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../sync", () => ({ SyncEngine: { recordDoc: () => {} } }));

import {
  BASE_LANGUAGE,
  availableLanguages,
  catalogMessages,
  currentLanguage,
  matchLanguage,
  registerMessages,
  translate,
} from "./index";
import { PreferencesAPI } from "../preferences";

afterEach(() => {
  PreferencesAPI.update({ language: null });
});

/** `{name}` placeholders in a message, plural sets included. */
const placeholders = (message: unknown): string[] => {
  const text = typeof message === "string" ? message : Object.values(message as object).join(" ");
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
};

describe("the catalogs", () => {
  const base = catalogMessages(BASE_LANGUAGE);
  const others = availableLanguages().filter((l) => l.code !== BASE_LANGUAGE);

  it("describe themselves, with English first", () => {
    const codes = availableLanguages().map((l) => l.code);
    expect(codes[0]).toBe("en");
    expect(codes).toContain("km");
    expect(availableLanguages().find((l) => l.code === "km")?.name).toBe("ខ្មែរ");
  });

  it.each(others.map((l) => [l.code]))("%s has no key English lacks", (code) => {
    const stray = [...catalogMessages(code).keys()].filter((key) => !base.has(key));
    expect(stray).toEqual([]);
  });

  it.each(others.map((l) => [l.code]))("%s fills the same blanks as English", (code) => {
    const mismatched = [...catalogMessages(code)]
      .filter(([key, message]) => placeholders(message).join() !== placeholders(base.get(key)).join())
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  // Khmer is a shipped language, not a work in progress: a gap here would show
  // a Khmer reader an English word. A new catalog can start partial — the
  // fallback covers it — and join this list once it is done.
  it.each([["km"]])("%s translates every key", (code) => {
    const missing = [...base.keys()].filter((key) => !catalogMessages(code).has(key));
    expect(missing).toEqual([]);
  });
});

describe("the source", () => {
  /** Every literal key passed to t / translate / tNodes anywhere in src. */
  const usedKeys = (): string[] => {
    const keys = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const text = readFileSync(path, "utf8");
          for (const m of text.matchAll(/\b(?:t|translate|tNodes)\(\s*"([a-zA-Z][\w.-]*\.[\w.-]+)"/g)) keys.add(m[1]);
        }
      }
    };
    walk(join(__dirname, "../.."));
    return [...keys];
  };

  it("never asks for a key English does not have", () => {
    const base = catalogMessages(BASE_LANGUAGE);
    expect(usedKeys().filter((key) => !base.has(key))).toEqual([]);
  });
});

describe("translate", () => {
  it("fills blanks and picks plural forms", () => {
    expect(translate("home.xpToLevel", { xp: 40, level: 3 }, "en")).toBe("40 XP to level 3");
    expect(translate("streak.days", { count: 1 }, "en")).toBe("1 day");
    expect(translate("streak.days", { count: 4 }, "en")).toBe("4 days");
  });

  it("speaks Khmer when asked", () => {
    expect(translate("settings.title", undefined, "km")).toBe("ការកំណត់");
    expect(translate("streak.days", { count: 4 }, "km")).toBe("4 ថ្ងៃ");
  });

  it("falls back to English, then to the key", () => {
    registerMessages("zz", { $meta: { name: "Zed" }, settings: { title: "Zettings" } } as never);
    expect(translate("settings.title", undefined, "zz")).toBe("Zettings");
    expect(translate("home.today", undefined, "zz")).toBe("Today");
    expect(translate("no.such.key", undefined, "zz")).toBe("no.such.key");
  });
});

describe("the language in force", () => {
  it("follows the family's choice", () => {
    PreferencesAPI.update({ language: "km" });
    expect(currentLanguage()).toBe("km");
    expect(translate("nav.home")).toBe("ទំព័រដើម");
  });

  it("uses English for a choice this build has no catalog for — without forgetting it", () => {
    PreferencesAPI.update({ language: "pt-BR" });
    expect(currentLanguage()).toBe("en");
    expect(PreferencesAPI.current().language).toBe("pt-BR");
  });

  it("matches a device's regional tag to its language", () => {
    expect(matchLanguage(["km-KH"])).toBe("km");
    expect(matchLanguage(["fr-FR", "en-GB"])).toBe("en");
    expect(matchLanguage(["fr-FR"])).toBeNull();
  });
});
