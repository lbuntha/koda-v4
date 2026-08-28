import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(root, "src", "skills");
const target = path.join(root, "server", "app", "skill_defaults.json");

const skills = [];
for (const entry of await fs.readdir(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestPath = path.join(skillsDir, entry.name, "manifest.json");
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.id !== entry.name) {
      throw new Error(`manifest id "${manifest.id}" does not match folder "${entry.name}"`);
    }
    const lessonsPath = path.join(skillsDir, entry.name, "lessons.json");
    const lessonFile = JSON.parse(await fs.readFile(lessonsPath, "utf8"));
    skills.push({ ...manifest, lessons: Array.isArray(lessonFile.lessons) ? lessonFile.lessons : [] });
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
}

skills.sort((a, b) => a.id.localeCompare(b.id));
await fs.writeFile(target, `${JSON.stringify(skills, null, 2)}\n`);
console.log(`Wrote ${skills.length} skill registrations to ${path.relative(root, target)}`);
