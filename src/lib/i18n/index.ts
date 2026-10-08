/**
 * The words on screen, in whichever language the family picked.
 *
 * Nothing here names a language. Every catalog in `./locales/*.json` is found
 * at build time and describes itself in a `$meta` block — its own name, the
 * name an English speaker would look for, its writing direction — so adding a
 * language is adding one file. The picker in Settings, `<html lang>`, and the
 * fallback chain all read the list this module builds from those files.
 *
 * Eager, not lazy: the catalogs are small, and a language whose chunk failed to
 * download on patchy wifi would leave a child staring at raw keys. Bundled means
 * precached, and precached means it works offline.
 *
 * A key missing from the chosen language falls back to that catalog's
 * `$meta.fallback`, then to English, then to the key itself — so a half-done
 * translation ships as a mixed page rather than a broken one.
 */

import { Fragment, createElement, useSyncExternalStore, type ReactNode } from "react";
import { PreferencesAPI } from "../preferences";

/** What a catalog says about itself. */
export interface LanguageMeta {
  /** BCP 47 code — the file name, and what `<html lang>` gets. */
  code: string;
  /** In its own script: what a speaker of it looks for in a list. */
  name: string;
  /** In English: what a helper setting up the device looks for. */
  englishName: string;
  dir: "ltr" | "rtl";
  /** Where a missing key is looked up next. English when not given. */
  fallback: string;
}

/** A catalog as written: nested groups, strings, and plural sets. */
type CatalogTree = { [key: string]: string | CatalogTree };

/** CLDR plural categories — an object holding only these is one message. */
const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);
type PluralSet = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Message = string | PluralSet;

export const BASE_LANGUAGE = "en";

const languages = new Map<string, LanguageMeta>();
const catalogs = new Map<string, Map<string, Message>>();
/**
 * Corrections made in the Translations page, over the bundled catalogs.
 *
 * Kept apart from `catalogs` rather than merged into them, so the editor can
 * show what the app ships with beside the correction, and resetting a line is
 * deleting a row rather than remembering what used to be there.
 */
const overrides = new Map<string, Map<string, Message>>();

export type { Message as CatalogMessage };

const isPluralSet = (value: CatalogTree): boolean => {
  const keys = Object.keys(value);
  return keys.includes("other") && keys.every((k) => PLURAL_KEYS.has(k));
};

/** `{ home: { title: "…" } }` → `"home.title" → "…"`. */
const flatten = (tree: CatalogTree, prefix: string, into: Map<string, Message>) => {
  for (const [key, value] of Object.entries(tree)) {
    if (key === "$meta") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") into.set(path, value);
    else if (isPluralSet(value)) into.set(path, value as PluralSet);
    else flatten(value, path, into);
  }
};

const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

/**
 * Add words for a language, from anywhere.
 *
 * The bundled catalogs arrive through here, and so can a skill's own strings or
 * a catalog fetched later — merged key by key, so a module can own its corner
 * of a language without editing the shared file. A code nobody has described
 * yet becomes a language the moment its `$meta` arrives.
 */
export function registerMessages(code: string, tree: CatalogTree & { $meta?: Partial<LanguageMeta> }): void {
  const meta = tree.$meta as Partial<LanguageMeta> | undefined;
  if (meta?.name) {
    languages.set(code, {
      code,
      name: meta.name,
      englishName: meta.englishName ?? meta.name,
      dir: meta.dir === "rtl" ? "rtl" : "ltr",
      fallback: meta.fallback ?? BASE_LANGUAGE,
    });
  }
  const into = catalogs.get(code) ?? new Map<string, Message>();
  flatten(tree, "", into);
  catalogs.set(code, into);
  notify();
}

const bundled = import.meta.glob<CatalogTree>("./locales/*.json", { eager: true, import: "default" });
for (const [path, tree] of Object.entries(bundled)) {
  const code = path.match(/([^/]+)\.json$/)![1];
  registerMessages(code, tree);
}

/**
 * Replace the whole correction layer — what the server sent, or the copy
 * this device kept from last time.
 */
export function setOverrides(tree: Record<string, Record<string, Message>>): void {
  overrides.clear();
  for (const [code, messages] of Object.entries(tree)) {
    overrides.set(code, new Map(Object.entries(messages)));
  }
  notify();
}

/** One language's corrections, by key. For the editor. */
export function overrideMessages(code: string): ReadonlyMap<string, Message> {
  return overrides.get(code) ?? new Map();
}

/** Every language with a described catalog, the base language first. */
export function availableLanguages(): LanguageMeta[] {
  return [...languages.values()].sort((a, b) =>
    a.code === BASE_LANGUAGE ? -1 : b.code === BASE_LANGUAGE ? 1 : a.englishName.localeCompare(b.englishName),
  );
}

/**
 * The best described language for a list of BCP 47 tags, or null.
 *
 * Exact first, then by primary subtag — `km-KH` finds `km`.
 */
export function matchLanguage(tags: readonly string[]): string | null {
  for (const tag of tags) {
    if (languages.has(tag)) return tag;
    const primary = tag.toLowerCase().split("-")[0];
    if (languages.has(primary)) return primary;
  }
  return null;
}

/**
 * The language in force.
 *
 * The family's choice when it is one this build can show; otherwise the
 * device's own language, if there is a catalog for it; otherwise English. A
 * choice this build does not know — made on a newer device — is *kept* in the
 * preferences, not overwritten, so it takes effect the day the catalog lands.
 */
export function currentLanguage(): string {
  const chosen = PreferencesAPI.current().language;
  if (chosen && languages.has(chosen)) return chosen;
  const device = typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
  return matchLanguage(device) ?? BASE_LANGUAGE;
}

export function languageMeta(code = currentLanguage()): LanguageMeta | undefined {
  return languages.get(code);
}

/** The chain a key is looked up along: chosen, its fallbacks, English. */
const chainFor = (code: string): string[] => {
  const chain: string[] = [];
  let next: string | undefined = code;
  while (next && !chain.includes(next)) {
    chain.push(next);
    next = languages.get(next)?.fallback;
  }
  if (!chain.includes(BASE_LANGUAGE)) chain.push(BASE_LANGUAGE);
  return chain;
};

export type TranslateVars = Record<string, string | number>;

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

const cached = <T>(map: Map<string, T>, code: string, make: (code: string) => T): T => {
  let value = map.get(code);
  if (!value) {
    try {
      value = make(code);
    } catch {
      // An engine without data for this locale: English rules are a better
      // answer than an exception in the middle of a render.
      value = make(BASE_LANGUAGE);
    }
    map.set(code, value);
  }
  return value;
};

/** `1234` → `"1,234"`, in the language's own conventions. */
export function formatNumber(value: number, code = currentLanguage()): string {
  return cached(numberFormats, code, (c) => new Intl.NumberFormat(c)).format(value);
}

/** A date in the language's own words and order — "September 2026", "កញ្ញា 2026". */
export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  code = currentLanguage(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat(code, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(BASE_LANGUAGE, options).format(date);
  }
}

/**
 * One message, filled in.
 *
 * `{name}` is replaced from `vars`; a number is formatted for the language. A
 * plural set picks its form by `vars.count`. A key found nowhere comes back as
 * itself — visible in review, and never a crash.
 */
export function translate(key: string, vars?: TranslateVars, code = currentLanguage()): string {
  let message: Message | undefined;
  let from = code;
  for (const lang of chainFor(code)) {
    message = overrides.get(lang)?.get(key) ?? catalogs.get(lang)?.get(key);
    if (message !== undefined) {
      from = lang;
      break;
    }
  }
  if (message === undefined) return key;

  let text: string;
  if (typeof message === "string") {
    text = message;
  } else {
    const count = typeof vars?.count === "number" ? vars.count : 0;
    const rule = cached(pluralRules, from, (c) => new Intl.PluralRules(c)).select(count);
    text = message[rule] ?? message.other;
  }

  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value, from) : value;
  });
}

/** One catalog's own messages as bundled, flattened — no fallback, no corrections. */
export function catalogMessages(code: string): ReadonlyMap<string, Message> {
  return catalogs.get(code) ?? new Map();
}

/** Whether any catalog on the chain has this key — for optional overrides. */
export function hasMessage(key: string, code = currentLanguage()): boolean {
  return chainFor(code).some((lang) => overrides.get(lang)?.has(key) || catalogs.get(lang)?.has(key));
}

/** Change signal for `useSyncExternalStore`: catalogs *or* the choice moved. */
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const off = PreferencesAPI.subscribe(cb);
  return () => {
    listeners.delete(cb);
    off();
  };
};
const snapshot = () => `${version}:${currentLanguage()}`;

export type Translate = (key: string, vars?: TranslateVars) => string;

/**
 * A message with elements in it — `{email}` as a `<strong>`, say.
 *
 * The sentence stays one catalog entry, so a language that puts the address at
 * the end of the sentence can; splitting it into "before" and "after" strings
 * would bake English word order into every translation.
 */
export function translateNodes(
  key: string,
  nodes: Record<string, ReactNode>,
  vars?: TranslateVars,
  code = currentLanguage(),
): ReactNode {
  const text = translate(key, vars, code);
  const parts = text.split(/\{(\w+)\}/);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) =>
      i % 2 === 1 ? createElement(Fragment, { key: i }, part in nodes ? nodes[part] : `{${part}}`) : part,
    ),
  );
}

/**
 * `t` for a component, re-rendering it when the language changes.
 *
 * Every component that shows words calls this rather than importing
 * `translate`: that is what lets a switch in Settings repaint the whole app on
 * the spot, with no reload.
 */
export function useT(): {
  t: Translate;
  tNodes: (key: string, nodes: Record<string, ReactNode>, vars?: TranslateVars) => ReactNode;
  language: string;
  dir: "ltr" | "rtl";
} {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const language = currentLanguage();
  return {
    t: (key, vars) => translate(key, vars, language),
    tNodes: (key, nodes, vars) => translateNodes(key, nodes, vars, language),
    language,
    dir: languages.get(language)?.dir ?? "ltr",
  };
}

/**
 * Keep `<html lang dir>` true to the language on screen.
 *
 * `lang` is what picks the right font for a script and the right voice for a
 * screen reader; `dir` is the one switch a right-to-left catalog needs.
 */
export function syncDocumentLanguage(): () => void {
  const apply = () => {
    const code = currentLanguage();
    document.documentElement.lang = code;
    document.documentElement.dir = languages.get(code)?.dir ?? "ltr";
  };
  apply();
  return subscribe(apply);
}
