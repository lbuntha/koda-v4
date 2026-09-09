import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { skill } from ".";
import courseJson from "../../curriculum/course.json";
import { lessonIcons } from "../../components/ui/lessonIcons";

/**
 * The whole-skill audit: the checks that only mean something once all sixty-
 * eight lessons and twelve engines exist.
 *
 * Everything here is about the skill as a *unit* — that its manifest describes
 * what it actually contains, that every asset it names is on disk, that every
 * lesson prints, and that nothing is declared twice or left dangling. The
 * per-engine suites prove the engines work; this proves the skill is whole.
 */

const root = join(__dirname);
const lessons = skill.lessons as unknown as {
  id: string;
  activity: string;
  conceptKey?: string;
  requires?: string[];
  icon?: string;
  iconName?: string;
  iconTone?: string;
  standards?: string[];
  params: { level: number; question: Record<string, unknown> };
}[];

/* -------------------------------------------------------------------------- */
/* The manifest describes what is here                                         */
/* -------------------------------------------------------------------------- */

describe("the manifest matches the skill it belongs to", () => {
  it("teaches exactly the concepts its lessons carry", () => {
    const taught = new Set(lessons.map((l) => l.conceptKey).filter(Boolean));
    const declared = new Set(skill.manifest.teaches ?? []);
    for (const key of taught) {
      expect(declared.has(key!), `${key} is taught but not declared`).toBe(true);
    }
    for (const key of declared) {
      expect(taught.has(key), `${key} is declared but no lesson teaches it`).toBe(true);
    }
  });

  it("declares nothing twice", () => {
    const teaches = skill.manifest.teaches ?? [];
    expect(new Set(teaches).size).toBe(teaches.length);
    const featureIds = skill.features.map((f) => f.id);
    expect(new Set(featureIds).size).toBe(featureIds.length);
    const keys = skill.settingsSchema.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every setting in the schema a stored default, and no orphans", () => {
    const stored = new Set(Object.keys(skill.settings));
    for (const field of skill.settingsSchema) {
      expect(stored.has(field.key), `${field.key} has no default`).toBe(true);
    }
    for (const key of stored) {
      expect(
        skill.settingsSchema.some((f) => f.key === key),
        `${key} has a default but no control`,
      ).toBe(true);
    }
  });

  /*
   * Published, as of Phase 17.
   *
   * The last act of the build and the only change in this skill that reaches a
   * child who is not a developer (§15 decision 8), so it stays pinned here: a
   * skill that slipped back to draft would vanish from the Learn page for
   * everyone, and nothing else in the suite would notice.
   */
  it("is published", () => {
    expect(skill.manifest.status).toBe("published");
  });
});

/* -------------------------------------------------------------------------- */
/* Every asset it names                                                        */
/* -------------------------------------------------------------------------- */

describe("every file the skill points at is on disk", () => {
  it("has the thumbnail its manifest names", () => {
    const name = (skill.manifest as { thumbnail?: string }).thumbnail;
    expect(name, "no thumbnail declared").toBeTruthy();
    const file = join(root, "..", "..", "assets", "svg", "thumbnail", `${name}.svg`);
    expect(existsSync(file), `${name}.svg is named but missing`).toBe(true);
    const svg = readFileSync(file, "utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
  });

  it("registers every countable it draws with", () => {
    expect(skill.assets?.length ?? 0).toBeGreaterThan(0);
    for (const id of skill.assets ?? []) {
      // `skillArtId` namespaces with a hyphen: "multiplication-apple".
      expect(id.startsWith("multiplication-"), `${id} is not this skill's own`).toBe(true);
    }
  });

  /*
   * No yellow, anywhere.
   *
   * The one colour family this project does not use: it is hard to read on
   * both grounds, and a skill that reaches for it once tends to reach for it
   * again. Checked by hue on the colours themselves rather than by looking for
   * the word — the first version of this failed on the comment in the artwork
   * that says there is no yellow in it.
   */
  it("keeps amber and yellow out of its artwork", () => {
    const hueOf = (hex: string): { hue: number; sat: number; light: number } => {
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const light = (max + min) / 2;
      if (max === min) return { hue: 0, sat: 0, light };
      const span = max - min;
      const sat = light > 0.5 ? span / (2 - max - min) : span / (max + min);
      const hue = 60 * (
        max === r ? ((g - b) / span + (g < b ? 6 : 0))
          : max === g ? (b - r) / span + 2
            : (r - g) / span + 4
      );
      return { hue, sat, light };
    };

    const files = ["multiplication-quest.svg"].map((name) =>
      join(root, "..", "..", "assets", "svg", "thumbnail", name));
    for (const id of skill.assets ?? []) {
      files.push(join(root, "assets", `${id.replace("multiplication-", "")}.svg`));
    }

    for (const file of files) {
      const svg = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
      for (const hex of svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
        const { hue, sat, light } = hueOf(hex);
        const yellowish = hue >= 40 && hue <= 70 && sat > 0.3 && light > 0.25 && light < 0.85;
        expect(yellowish, `${file.split("/").pop()} uses ${hex}, which is amber`).toBe(false);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Controls are the right shape for what is in them                            */
/* -------------------------------------------------------------------------- */

/**
 * A sentence never goes in a square.
 *
 * `themeSystem.button(…, "choice")` is a fixed 56px box with `p-0` — right for
 * a single digit, and wrong for anything with a space in it. "No, one is
 * different" spilled out of it on all four sides and collided with the button
 * beside it, and "Cut after row 3" did the same on the array. Neither showed up
 * in a test, because every driver in this skill presses by accessible name and
 * a label reads the same whether or not its box can hold it.
 *
 * Scanned in the source rather than measured in a DOM: jsdom does no layout, so
 * the only place this is visible is the markup that chooses the shape.
 */
describe("a worded button is not shaped like a number tile", () => {
  it("puts nothing longer than a digit or an operator in a choice tile", () => {
    const dir = join(root, "activities");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, file), "utf8");
      const tiles = src.matchAll(
        /className=\{themeSystem\.button\("[a-z]+", "choice"\)\}\s*>\s*([^<]{0,120}?)\s*<\/button>/g,
      );
      for (const tile of tiles) {
        const body = tile[1].split(/\s+/).join(" ").trim();
        // An interpolated value, a single glyph, or nothing at all is fine.
        const fits = /^(\{[^}]*\}|[-−+→←⌫×]|)$/.test(body);
        expect(fits, `${file}: a choice tile holds "${body}" — use WORD_CHOICE`).toBe(true);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Every lesson is complete                                                    */
/* -------------------------------------------------------------------------- */

describe("every lesson carries what the Learn page needs", () => {
  it("has all sixty-eight, numbered once each", () => {
    expect(lessons).toHaveLength(68);
    const levels = lessons.map((l) => l.params.level).sort((a, b) => a - b);
    expect(levels).toEqual(Array.from({ length: 68 }, (_, i) => i + 1));
    expect(new Set(lessons.map((l) => l.id)).size).toBe(68);
  });

  it("gives every one an icon, a tone and a standard", () => {
    const tones = new Set(["cyan", "indigo", "purple", "pink", "emerald"]);
    for (const lesson of lessons) {
      expect(lesson.icon, `${lesson.id} has no icon`).toBeTruthy();
      /*
       * The name has to resolve, not merely exist.
       *
       * `resolveLessonIcon` falls back to a question mark for anything it does
       * not know, so nine lessons shipped with `plus`, `grid`, `rotate` and the
       * like and drew a "?" in the Skill Manager. Asserting the field was
       * non-empty said nothing about that — the registry is the only thing that
       * decides whether a name is real.
       */
      expect(
        Object.keys(lessonIcons),
        `${lesson.id} names "${lesson.iconName}", which is not a registered icon`,
      ).toContain(lesson.iconName);
      // Amber is the sixth available tone and the one this project avoids.
      expect(tones.has(lesson.iconTone ?? ""), `${lesson.id} uses ${lesson.iconTone}`).toBe(true);
      expect(lesson.standards?.length, `${lesson.id} cites no standard`).toBeGreaterThan(0);
      for (const standard of lesson.standards ?? []) {
        expect(standard, `${lesson.id} cites "${standard}"`).toMatch(/^CCSS\./);
      }
    }
  });

  it("routes every one to an engine that exists", () => {
    for (const lesson of lessons) {
      const engine = lesson.activity.split("/")[1];
      expect(skill.activities[engine], `${lesson.id} names ${lesson.activity}`).toBeTruthy();
      expect(lesson.activity.startsWith("multiplication/")).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The worksheet path                                                          */
/* -------------------------------------------------------------------------- */

describe("every lesson can be printed, or honestly declines to be", () => {
  /*
   * Driven through the worksheet's own entry point, mixed modes included.
   *
   * `printed` returning `null` is a legitimate answer — a pattern hunt across a
   * chart the sheet does not carry cannot be written down without becoming a
   * different question — but a lesson where *every* question declines is a
   * lesson that silently prints nothing.
   */
  it("prints something for every lesson that can be printed at all", () => {
    for (const lesson of lessons) {
      const activity = skill.activities[lesson.activity.split("/")[1]];
      const sheet = activity.worksheet!;
      const seen = new Set<string>();
      const memory = { current: null };
      let printable = 0;
      for (let i = 0; i < 12; i += 1) {
        const question = sheet.build!(lesson.params as never, i, seen, memory);
        const printed = sheet.printed!(question as never);
        if (!printed) continue;
        printable += 1;
        // Self-contained: a sheet has no screen to refer back to.
        expect(printed.text.length, `${lesson.id} printed an empty question`).toBeGreaterThan(10);
        expect(String(printed.answer).length, `${lesson.id} printed no answer`).toBeGreaterThan(0);
        const method = sheet.method!(question as never);
        if (method) expect(method.length).toBeGreaterThan(1);
      }
      const declines = lesson.id.includes("patterns-in-the-table");
      if (declines) expect(printable).toBe(0);
      else expect(printable, `${lesson.id} prints nothing at all`).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Course placement                                                            */
/* -------------------------------------------------------------------------- */

describe("the course holds the skill exactly once, in order", () => {
  const refs = (courseJson.units as { id: string; lessons: string[] }[]).flatMap((u) => u.lessons);
  const mine = refs.filter((ref) => ref.startsWith("multiplication/"));

  it("places all sixty-eight, once each", () => {
    expect(mine).toHaveLength(68);
    expect(new Set(mine).size).toBe(68);
    const defined = new Set(lessons.map((l) => l.id));
    for (const ref of mine) {
      expect(defined.has(ref.split("/")[1]), `${ref} is placed but not defined`).toBe(true);
    }
  });

  it("lists them in the order the skill numbers them", () => {
    const levelOf = (id: string) => lessons.find((l) => l.id === id)!.params.level;
    const levels = mine.map((ref) => levelOf(ref.split("/")[1]));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[0]).toBe(1);
    expect(levels.at(-1)).toBe(68);
  });

  it("keeps teaching and practice in separate units", () => {
    const practice = new Set(
      lessons.filter((l) => l.params.question.practice).map((l) => l.id),
    );
    for (const unit of courseJson.units as { id: string; lessons: string[] }[]) {
      const ours = unit.lessons.filter((ref) => ref.startsWith("multiplication/"));
      if (ours.length === 0) continue;
      const kinds = new Set(ours.map((ref) => practice.has(ref.split("/")[1])));
      expect(kinds.size, `${unit.id} mixes teaching and practice`).toBe(1);
    }
  });

  it("sits as one unbroken block at the end of the course", () => {
    const first = refs.findIndex((ref) => ref.startsWith("multiplication/"));
    expect(first).toBeGreaterThan(0);
    expect(refs.slice(first).every((ref) => ref.startsWith("multiplication/"))).toBe(true);
  });
});
