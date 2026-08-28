import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src", "assets", "svg");
const target = path.join(root, "server", "app", "art_defaults.json");

const assets = [];
for (const entry of await fs.readdir(source, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".svg")) {
    assets.push({
      id: entry.name.slice(0, -4),
      category: "uncategorised",
      markup: (await fs.readFile(path.join(source, entry.name), "utf8")).trim(),
    });
  }
  if (!entry.isDirectory()) continue;
  for (const name of (await fs.readdir(path.join(source, entry.name))).filter((name) => name.endsWith(".svg"))) {
    assets.push({
      id: name.slice(0, -4),
      category: entry.name,
      markup: (await fs.readFile(path.join(source, entry.name, name), "utf8")).trim(),
    });
  }
}

/*
 * A skill's own art, from `src/skills/<id>/assets`.
 *
 * Seeded alongside the app's collection so an operator can retouch a skill's
 * drawings on the Art page like any other artwork. Ids are namespaced
 * `skillId-name` by `assets/svg/skillArt.ts`; this must agree with it, or the
 * record an operator edits is not the one the skill draws.
 *
 * The skill still ships its own copy, so this seed is a starting point rather
 * than the source of truth: an edit here overrides the skill's art, and a
 * deletion only removes the override.
 */
const skillsRoot = path.join(root, "src", "skills");
for (const entry of await fs.readdir(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(skillsRoot, entry.name, "assets");
  let names;
  try {
    names = (await fs.readdir(dir)).filter((name) => name.endsWith(".svg"));
  } catch {
    continue; // A skill with no art of its own is the normal case.
  }
  for (const name of names) {
    assets.push({
      id: `${entry.name}-${name.slice(0, -4)}`,
      category: entry.name,
      markup: (await fs.readFile(path.join(dir, name), "utf8")).trim(),
    });
  }
}

assets.sort((a, b) => a.id.localeCompare(b.id));
await fs.writeFile(target, `${JSON.stringify(assets, null, 2)}\n`);
console.log(`Wrote ${assets.length} art assets to ${path.relative(root, target)}`);
