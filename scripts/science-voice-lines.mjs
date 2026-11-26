#!/usr/bin/env node
/**
 * Rebuild Wonder Lab's voice script from its words.
 *
 *   node scripts/science-voice-lines.mjs          rewrite src/skills/science/voice.json
 *   node scripts/science-voice-lines.mjs --check  exit 1 if it is out of date
 *
 * Grade 1 is for children who cannot read yet, so every line the speaker
 * button can say is recorded: each question, each answer, each reason and each
 * correction, in English (Khmer lines use live speech). The lines come from
 * locales/en.json and the lesson prompts from lessons.json, so rewording a
 * question and running this keeps the recorder's list exact. Then record with
 * `npm run voice:science` (OpenAI).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "src/skills/science");
const en = JSON.parse(readFileSync(join(dir, "locales/en.json"), "utf8"));
const { lessons } = JSON.parse(readFileSync(join(dir, "lessons.json"), "utf8"));

const ordered = new Set();
const add = (line) => { if (typeof line === "string" && line.trim()) ordered.add(line); };
const values = (obj) => Object.values(obj ?? {});

export function scienceLines() {
  ordered.clear();
  add(en.pick.wrong);
  for (const [set, items] of Object.entries(en.pick)) {
    if (set === "wrong") continue;
    for (const item of values(items)) {
      add(item.ask);
      values(item.c).forEach(add);
      add(item.why);
      values(item.no).forEach(add);
    }
  }
  for (const set of values(en.sort)) {
    add(set.ask);
    add(set.rule);
    values(set.bin).forEach(add);
    values(set.item).forEach(add);
    values(set.why).forEach(add);
  }
  add(en.order.wrong);
  for (const [set, seqs] of Object.entries(en.order)) {
    if (set === "wrong") continue;
    for (const seq of values(seqs)) {
      add(seq.ask);
      values(seq.step).forEach(add);
      add(seq.why);
    }
  }
  const prompts = [...new Set(lessons.map((l) => l.params?.play?.audioPrompt).filter(Boolean))];
  return { prompts, phrases: [...ordered].filter((p) => !prompts.includes(p)) };
}

const file = join(dir, "voice.json");
const current = JSON.parse(readFileSync(file, "utf8"));
const { prompts, phrases } = scienceLines();
const next = { ...current, prompts, phrases };
const text = `${JSON.stringify(next, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(file, "utf8") !== text) {
    console.error("science voice.json is out of date: run node scripts/science-voice-lines.mjs");
    process.exit(1);
  }
  console.log(`science voice.json is current: ${prompts.length} prompts, ${phrases.length} phrases`);
} else {
  writeFileSync(file, text);
  console.log(`science voice.json: ${prompts.length} prompts, ${phrases.length} phrases`);
}
