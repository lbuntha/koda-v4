/**
 * Record what each skill says, ahead of time.
 *
 * `koda.speech.say()` calls Gemini TTS per utterance. That is fine for a tutor
 * reply nobody can predict, and wrong for counting: a child taps a rocket and
 * waits on a network round trip before hearing "three", every tap. The words the
 * app says are overwhelmingly *authored* — numbers, lesson prompts, a handful of
 * fixed lines — so they can be recorded once and played from disk instantly.
 *
 * Each skill's lines land in that skill's own `audio/` folder, beside its
 * `assets/`, with a `manifest.json` mapping phrase to filename. A skill is then a
 * complete description of itself — what it teaches, what it draws with, and what
 * it says — and removing it takes its voice with it.
 *
 * At runtime the skill registers those clips from its own `index.ts`, and
 * `lib/voiceClips.ts` plays them. A miss falls through to live TTS, so an
 * unrecorded phrase is slower rather than silent and the app works with no
 * recordings at all.
 *
 * Incremental: a phrase whose file already exists is skipped, so re-running
 * after adding one lesson costs one API call, not a hundred and forty.
 *
 *   npm run voice:record -- --dry-run                  # list what it would do
 *   npm run voice:record -- --limit 5                  # record five, to hear it first
 *   npm run voice:record -- --skill counting           # one skill only
 *   npm run voice:record -- --folder correct,incorrect --force   # redo just the reactions
 *   GEMINI_API_KEY=... npm run voice:record            # record what is missing
 *   GEMINI_API_KEY=... npm run voice:record -- --force # re-record everything
 *   npm run voice:record -- --skill counting --import ./my-voice
 *
 * `--import` takes a folder holding an `index.json` of `{ "phrase": "file.wav" }`
 * plus the files it names, and installs them as that skill's clips. No API key,
 * no provider: anything that can produce an audio file can supply the voice,
 * which is the point — a cheaper voice, or a real person, beats a paid model per
 * phrase, and for a children's app a real person is usually the better product.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// The key belongs in `.env` beside the one the server already reads, so that
// recording is `npm run voice:record` rather than a secret typed into shell
// history. An explicit GEMINI_API_KEY in the environment still wins, for CI.
dotenv.config({ quiet: true });

const run = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, "src", "skills");

/**
 * The app's own pack, which is not a skill.
 *
 * Numbers, and praise that names no subject: lines every skill says the same
 * way. It lives outside `src/skills/` because it belongs to none of them, and
 * it is recorded like any of them — `--skill common`.
 */
const COMMON_ID = "common";
const commonRoot = path.join(root, "src", "voice", COMMON_ID);

/** Where one voice keeps its files. Beside its `assets/`, for the same reason. */
const voiceRoot = (id) => (id === COMMON_ID ? commonRoot : path.join(skillsRoot, id));
const audioDir = (id) => path.join(voiceRoot(id), "audio");

/** Phrases the common pack already covers, so no skill pays to record them twice. */
async function commonPhrases() {
  const manifest = (await readJson(path.join(audioDir(COMMON_ID), "manifest.json"))) ?? {};
  const declared = await phrasesFor(COMMON_ID);
  return new Set([...Object.keys(manifest), ...declared.map((p) => p.phrase)]);
}

/** Must match the server's voice, or a fallback mid-round changes who is speaking. */
const VOICE = process.env.KODA_VOICE || "Kore";
const MODEL = process.env.KODA_TTS_MODEL || "gemini-3.1-flash-tts-preview";
/** The same framing `server.ts` sends, so recorded and live lines match in tone. */
const DIRECTION = "Say warmly and clearly like a friendly math coach: ";

/** Gemini returns raw little-endian 16-bit mono PCM at this rate. */
const SAMPLE_RATE = 24000;

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

/** Read `--flag value`, or undefined when the flag is absent. */
const flag = (name) => {
  const at = args.indexOf(name);
  return at !== -1 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : undefined;
};

/**
 * Stop after this many recordings, across all skills.
 *
 * Because the sensible first run is a handful, not a hundred and forty: hear what
 * the voice sounds like in the app before paying to render the rest.
 */
const limit = Number(flag("--limit") ?? Infinity);

/** Folder of audio recorded elsewhere — see `--import` in the header. */
const importDir = flag("--import");

/** Record one skill rather than all of them. */
const onlySkill = flag("--skill");

/**
 * Restrict to certain folders — `--folder correct,incorrect`.
 *
 * The unit people actually want to redo is a *kind* of line, not the whole
 * collection: re-record the praise in a different voice, leave the hundred and
 * twenty numbers alone. Without this, `--force` is all-or-nothing and changing
 * one reaction means paying to render everything again.
 *
 * Folder names are the ones on disk: numbers, lessons, prompts, phrases, and a
 * reaction group's own name.
 */
const onlyFolders = new Set(
  (flag("--folder") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);

/* -------------------------------------------------------------------------- */
/* What to say                                                                 */
/* -------------------------------------------------------------------------- */

const readJson = async (file) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
};

/**
 * What one skill says.
 *
 * Two sources on purpose. Lesson copy is *collected*, so authoring a lesson never
 * means also remembering to edit a phrase list. Everything else is *declared* in
 * the skill's `voice.json`, because speech that lives in code has nowhere else to
 * be found.
 */
async function phrasesFor(skillId) {
  const phrases = new Set();
  /** phrase -> the voice it should be spoken in, when it is not the default. */
  const voices = new Map();
  /** phrase -> the folder it belongs in, so the collection can be browsed. */
  const folders = new Map();
  const dir = voiceRoot(skillId);

  const file = (phrase, folder) => {
    phrases.add(phrase);
    if (!folders.has(phrase)) folders.set(phrase, folder);
  };

  const declared = (await readJson(path.join(dir, "voice.json"))) ?? {};
  for (const word of declared.numberWords ?? []) file(word, "numbers");
  if (declared.numberRange) {
    const [lo, hi] = declared.numberRange;
    for (let n = lo; n <= hi; n++) file(String(n), "numbers");
  }
  /*
   * Two declared lists, because the folder is meant to say what a line *is*.
   *
   * `prompts` is what an activity says as the question — the thing a child is
   * being asked. `phrases` is everything else it says in passing. Both end up as
   * clips; filing them apart is what makes the folder browsable, which is the
   * whole reason the names are readable rather than hashes.
   */
  for (const phrase of declared.prompts ?? []) file(phrase, "prompts");
  for (const phrase of declared.phrases ?? []) file(phrase, "phrases");

  /*
   * Templates, expanded over their own values.
   *
   * A template may be a bare string — which uses the shared `subjects`, the
   * countable objects — or `{ text, values }` when it varies over something
   * else. That second form is what lets a prompt carrying a number be recorded:
   * "Make 19. Fill one frame with 10, then add more." is nine fixed sentences,
   * not one dynamic one, and nine clips is the difference between a child
   * hearing the app's voice and hearing whatever their browser ships with.
   *
   * Only worth doing where the range is small and known. A prompt interpolating
   * three values over hundreds of targets is not a list, and stays on live TTS.
   */
  for (const template of declared.templates ?? []) {
    const text = typeof template === "string" ? template : template.text;
    const values = typeof template === "string" ? declared.subjects ?? [] : template.values ?? [];
    for (const value of values) file(text.replaceAll("{value}", String(value)).replaceAll("{subject}", String(value)), "prompts");
  }

  /*
   * Reaction groups: several ways of saying the same thing, so praise does not
   * wear out. `voices` rotates across the phrases rather than multiplying them,
   * because one phrase per voice gives the same variety for a fraction of the
   * calls — and a clip is named by its phrase alone, so the same words in two
   * voices would collide on one filename anyway.
   */
  for (const [name, group] of Object.entries(declared.groups ?? {})) {
    const list = group.voices ?? [];
    (group.phrases ?? []).forEach((phrase, i) => {
      // The folder is the group's own name, so `correct/` holds the praise and
      // `incorrect/` the encouragement — browsable without reading the manifest.
      file(phrase, name);
      if (list.length > 0) voices.set(phrase, list[i % list.length]);
    });
  }

  const lessons = (await readJson(path.join(dir, "lessons.json")))?.lessons ?? [];
  for (const lesson of lessons) {
    const play = lesson?.params?.play;
    if (!play) continue;
    /*
     * `audioPrompt` only.
     *
     * `targetObjective` and `prompts.*` look like spoken copy and are not: the
     * activities build what they say in code, interpolating the target, so a
     * fixed recording of "Make 5 dots" could never match "Make 9 dots".
     * Collecting them cost thirteen clips that nothing on any screen plays.
     *
     * The lesson intro is different — `useSkillRound` speaks it verbatim when
     * the round opens, so it is worth recording. If a future activity does read
     * one of the others, add it to the skill's `voice.json` where the fact that
     * something says it is explicit.
     */
    if (play.audioPrompt) file(play.audioPrompt, "lessons");
  }

  // A phrase still holding a `{placeholder}` is a template, not a line. The app
  // substitutes a real value before speaking, so the recorded key could never
  // match — and the recording itself would be a voice reading "curly brace
  // target" aloud. Declared templates are expanded above, against `subjects`;
  // anything unexpanded here is lesson copy whose values are only known at
  // runtime, and it belongs on the live TTS path.
  return [...phrases]
    .filter((phrase) => phrase && !/\{[^}]+\}/.test(phrase))
    .sort()
    .map((phrase) => ({
      phrase,
      voice: voices.get(phrase) ?? VOICE,
      folder: folders.get(phrase) ?? "phrases",
    }));
}

/**
 * Every voice that has anything to say — the skills, and the common pack.
 *
 * A skill's list has the common lines taken out of it. The recorder works one
 * folder at a time and cannot see across them, so without this addition would
 * pay again for twenty-one number words the app can already say. `--force`
 * still records them, for a skill that wants a line in its own voice.
 */
async function speakingSkills() {
  const found = [];
  const shared = onlySkill === COMMON_ID || force ? new Set() : await commonPhrases();

  for (const entry of await fs.readdir(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (onlySkill && entry.name !== onlySkill) continue;
    const phrases = (await phrasesFor(entry.name)).filter((p) => !shared.has(p.phrase));
    if (phrases.length > 0) found.push({ skillId: entry.name, phrases });
  }

  if (!onlySkill || onlySkill === COMMON_ID) {
    const phrases = await phrasesFor(COMMON_ID);
    if (phrases.length > 0) found.push({ skillId: COMMON_ID, phrases });
  }
  return found;
}

/* -------------------------------------------------------------------------- */
/* Recording                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A readable filename for a phrase, inside a folder for its kind.
 *
 *   numbers/three.wav
 *   correct/yes-you-got-it.wav
 *   lessons/level-1-count-in-a-row-touch-each-item.wav
 *
 * These were content-addressed hashes, which made the folder impossible to work
 * with — you could not tell which clip was which without resolving the manifest
 * by hand, so a bad recording could not be found and replaced.
 *
 * The manifest is what protects against staleness now: it is rewritten from the
 * current phrases every run, so re-wording a lesson leaves the old file
 * unreferenced rather than being spoken. `--prune` deletes those.
 *
 * A short hash is appended only when two phrases slug to the same name, so the
 * common case stays readable and a collision still cannot overwrite a clip.
 */
const slug = (phrase) =>
  phrase
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "") || "clip";

/**
 * The extension a recorded clip will actually land with.
 *
 * `compress` encodes to m4a and only falls back to wav when neither encoder is
 * present, so naming the plan ".wav" advertised a file that was never written:
 * every skill on disk is m4a. Probed once, the same way `compress` picks, so a
 * dry run promises what a real run produces.
 */
let encoderExt;
async function outputExt() {
  if (encoderExt) return encoderExt;
  for (const cmd of ["afconvert", "ffmpeg"]) {
    try {
      await run("which", [cmd]);
      return (encoderExt = ".m4a");
    } catch {
      /* try the next encoder */
    }
  }
  return (encoderExt = ".wav");
}

/** The same clip, whatever it was encoded as. */
const sameClip = (rel) => rel.replace(/\.[^.]+$/, "");

const clipPath = (phrase, folder, taken, ext = ".wav") => {
  let name = slug(phrase);
  if (taken.has(`${folder}/${name}`)) {
    name = `${name}-${createHash("sha1").update(phrase).digest("hex").slice(0, 6)}`;
  }
  const rel = `${folder}/${name}${ext}`;
  taken.add(`${folder}/${name}`);
  return rel;
};

/**
 * Wrap raw PCM in a RIFF header.
 *
 * The server hands base64 PCM straight to an AudioContext, which can be told the
 * sample rate out of band. A file cannot be told anything, so it has to carry its
 * own header or a browser will refuse it.
 */
function wav(pcm, sampleRate = SAMPLE_RATE) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate: rate * channels * 2
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Shrink a recording to AAC, when the machine can.
 *
 * Gemini returns raw PCM and WAV is the only container that needs no external
 * tool — but WAV is 48 KB per second, and one skill's collection came to 22 MB.
 * The same speech as AAC is under 4 MB, which is the difference between audio
 * a service worker can reasonably cache and audio it cannot.
 *
 * `afconvert` ships with macOS; `ffmpeg` covers everyone else. With neither, the
 * WAV is kept — a larger file that works beats a missing one, and the collection
 * may hold a mix of formats without anything caring.
 */
async function compress(wav, outPath) {
  const m4a = outPath.replace(/\.wav$/i, ".m4a");
  const tmp = `${outPath}.tmp.wav`;
  await fs.writeFile(tmp, wav);
  for (const [cmd, args] of [
    ["afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", "-s", "3", tmp, m4a]],
    ["ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c:a", "aac", "-b:a", "48k", "-ac", "1", m4a]],
  ]) {
    try {
      await run(cmd, args);
      await fs.rm(tmp);
      return m4a;
    } catch {
      /* try the next encoder */
    }
  }
  await fs.rename(tmp, outPath);
  return outPath;
}

/**
 * A rate limit is a wait, not a failure.
 *
 * The free tier allows a handful of requests a minute, and this loop is
 * sequential with no pacing, so a run of sixty-four hits the limit within
 * seconds. Without a retry each 429 burned its phrase — the run "succeeded",
 * most lines were quietly left to live TTS, and the only way to find out was to
 * run it again and watch the missing count barely move.
 *
 * Depleted credits are a different answer to the same code and cannot be waited
 * out, so they stop the run rather than sleeping through five doublings first.
 */
const RETRIES = 5;
const isRateLimit = (error) => /429|RESOURCE_EXHAUSTED|rate limit/i.test(error?.message ?? "");
const isOutOfCredit = (error) => /credit|billing|prepayment/i.test(error?.message ?? "");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function record(ai, phrase, voice = VOICE) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await generate(ai, phrase, voice);
    } catch (error) {
      if (isOutOfCredit(error) || !isRateLimit(error) || attempt >= RETRIES) throw error;
      const pause = 2 ** attempt * 2000;
      console.log(`      rate limited, waiting ${pause / 1000}s`);
      await wait(pause);
    }
  }
}

async function generate(ai, phrase, voice = VOICE) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ parts: [{ text: `${DIRECTION}${phrase}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) throw new Error("no audio in response");
  return wav(Buffer.from(base64, "base64"));
}

/**
 * Install audio recorded outside this script, into one skill.
 *
 * Files are copied under the same readable name and into the same folder a
 * generated clip would get — `correct/nice-work.wav`, not a generic bucket — so
 * imported and generated clips are interchangeable and either can replace the
 * other. Format is whatever a browser will play; mp3 is worth preferring, since
 * these ship in the bundle at roughly a fifth the size of WAV.
 */
async function importClips(dir, skillId, manifest, folders) {
  const indexPath = path.join(dir, "index.json");
  const index = await readJson(indexPath);
  if (!index) throw new Error(`cannot read ${path.relative(root, indexPath)}`);

  const taken = new Set();
  let copied = 0;
  for (const [phrase, file] of Object.entries(index)) {
    const rel = clipPath(phrase, folders.get(phrase) ?? "imported", taken, path.extname(file) || ".wav");
    try {
      const target = path.join(audioDir(skillId), rel);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(dir, file), target);
      manifest[phrase] = rel;
      copied += 1;
      console.log(`  imported ${JSON.stringify(phrase)} <- ${file}`);
    } catch (error) {
      console.warn(`  SKIPPED ${JSON.stringify(phrase)}: ${error.message}`);
    }
  }
  return copied;
}

/* -------------------------------------------------------------------------- */

async function main() {
  const skills = await speakingSkills();
  if (skills.length === 0) {
    console.log(
      onlySkill ? `No skill "${onlySkill}" with anything to say.` : "No skill has anything to say.",
    );
    return;
  }

  if (importDir && !onlySkill) {
    console.error("--import needs --skill, so it knows whose voice it is.");
    process.exitCode = 1;
    return;
  }

  const total = skills.reduce((n, s) => n + s.phrases.length, 0);
  console.log(`voice — ${skills.length} skill(s), ${total} phrases`);

  let budget = limit;
  let ai = null;

  for (const { skillId, phrases: all } of skills) {
    const phrases = onlyFolders.size > 0 ? all.filter((p) => onlyFolders.has(p.folder)) : all;
    if (phrases.length === 0) {
      console.log(`\n${skillId}: nothing in ${[...onlyFolders].join(", ")}`);
      continue;
    }
    const dir = audioDir(skillId);
    await fs.mkdir(dir, { recursive: true });

    /** Every clip already on disk, as a path relative to `audio/`. */
    const existing = new Set(
      (await fs.readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []))
        .filter((e) => e.isFile() && e.name !== "manifest.json" && !e.name.startsWith("."))
        .map((e) => path.relative(dir, path.join(e.parentPath ?? e.path, e.name))),
    );

    const manifest = {};
    const todo = [];
    /** Slugs claimed this run, so two phrases cannot land on one filename. */
    const taken = new Set();

    // An earlier run or import may have used a different extension, so trust the
    // previous manifest for anything still on disk rather than re-recording it.
    const prior = (await readJson(path.join(dir, "manifest.json"))) ?? {};

    /*
     * A narrowed run must not drop everything it was not asked to look at, or
     * `--folder correct` would leave the app with only its praise recorded.
     *
     * Carried forward only if the phrase is *still a phrase* — checked against
     * the skill's full list, not merely against this run's scope. Keying on
     * scope alone preserved entries for copy that had since been reworded or
     * deleted, so a retired line stayed in the manifest and its clip was never
     * pruned: the app kept a recording of a sentence it no longer says.
     */
    if (onlyFolders.size > 0) {
      const stillReal = new Set(all.map((p) => p.phrase));
      const inScope = new Set(phrases.map((p) => p.phrase));
      for (const [phrase, name] of Object.entries(prior)) {
        if (stillReal.has(phrase) && !inScope.has(phrase) && existing.has(name)) {
          manifest[phrase] = name;
          taken.add(name.replace(/\.[^.]+$/, ""));
        }
      }
    }

    for (const { phrase, voice, folder } of phrases) {
      const kept = prior[phrase];
      if (!force && kept && existing.has(kept)) {
        /*
         * Already recorded — but perhaps filed somewhere it no longer belongs.
         *
         * A line that moves from `phrases` to `prompts` is the same audio; it
         * would be absurd to pay to say it again. Move the file and keep the
         * recording, so reorganising the collection costs nothing.
         */
        const wantedDir = folder;
        const currentDir = kept.split("/")[0];
        // `--dry-run` reports and touches nothing: a preview that quietly moved
        // files would leave the manifest pointing at paths that no longer exist,
        // which is exactly what it did the first time it ran.
        if (currentDir !== wantedDir && dryRun) {
          console.log(`  would move ${kept} -> ${wantedDir}/`);
          manifest[phrase] = kept;
          continue;
        }
        if (currentDir !== wantedDir) {
          const ext = path.extname(kept) || ".wav";
          const moved = clipPath(phrase, wantedDir, taken, ext);
          await fs.mkdir(path.dirname(path.join(dir, moved)), { recursive: true });
          await fs.rename(path.join(dir, kept), path.join(dir, moved));
          existing.delete(kept);
          existing.add(moved);
          manifest[phrase] = moved;
          console.log(`  moved ${kept} -> ${moved}`);
          continue;
        }
        manifest[phrase] = kept;
        taken.add(kept.replace(/\.[^.]+$/, ""));
        continue;
      }
      const rel = clipPath(phrase, folder, taken, await outputExt());
      // A clip on disk but absent from the manifest still counts, whichever
      // encoder produced it — matching on the extension too would re-record an
      // m4a because the plan had called it a wav.
      const onDisk = [...existing].find((file) => sameClip(file) === sameClip(rel));
      if (!force && onDisk) {
        manifest[phrase] = onDisk;
        continue;
      }
      todo.push({ phrase, rel, voice });
    }

    const planned = todo.length;
    if (Number.isFinite(budget)) todo.length = Math.min(todo.length, Math.max(0, budget));

    console.log(
      `\n${skillId}: ${phrases.length} phrases, ${planned} missing` +
        (todo.length < planned ? `, recording ${todo.length} (--limit)` : ""),
    );

    if (dryRun) {
      /*
       * The plan, not just the list.
       *
       * This is what you read before spending anything, so it should answer the
       * questions you actually have: which file each line lands in, and which
       * voice reads it. Both are already decided by the time we get here — the
       * preview printed the phrase alone, which made it a word count rather
       * than something you could check against the app.
       */
      const width = todo.reduce((w, t) => Math.max(w, t.rel.length), 0);
      for (const { phrase, rel, voice } of todo) {
        console.log(`  ${rel.padEnd(width)}  ${voice.padEnd(6)}  ${JSON.stringify(phrase)}`);
      }
      if (importDir) console.log(`  would import from: ${importDir}`);
      continue;
    }

    if (importDir) {
      const copied = await importClips(
        path.resolve(root, importDir),
        skillId,
        manifest,
        new Map(phrases.map((p) => [p.phrase, p.folder])),
      );
      console.log(`  ${copied} imported`);
    }

    if (todo.length > 0) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        // Not fatal: clips may have arrived by --import, and the manifest below
        // is still worth writing for whatever is on disk.
        console.warn(
          "  GEMINI_API_KEY is not set, so nothing new was generated.\n" +
            "    GEMINI_API_KEY=... npm run voice:record        generate them\n" +
            "    npm run voice:record -- --skill <id> --import ./my-voice\n" +
            "    npm run voice:record -- --dry-run              just list the phrases",
        );
        todo.length = 0;
      } else {
        ai ??= new GoogleGenAI({ apiKey: key });
        let done = 0;
        let failed = 0;
        for (const { phrase, rel, voice } of todo) {
          try {
            const target = path.join(dir, rel);
            await fs.mkdir(path.dirname(target), { recursive: true });
            const written = await compress(await record(ai, phrase, voice), target);
            manifest[phrase] = path.relative(dir, written);
            done += 1;
            console.log(
              `  [${done + failed}/${todo.length}] ${rel}` + (voice !== VOICE ? `  (${voice})` : ""),
            );
          } catch (error) {
            // One bad phrase must not cost the whole run — the rest are still
            // worth having, and the manifest simply will not list this one.
            failed += 1;
            console.warn(
              `  [${done + failed}/${todo.length}] FAILED ${JSON.stringify(phrase)}: ${error.message}`,
            );
          }
          budget -= 1;
        }
        if (failed) console.warn(`  ${failed} phrase(s) left to the live TTS path.`);
      }
    }

    // Only list clips actually on disk, so a manifest can never promise a file
    // the app then fails to load.
    const onDisk = new Set(
      (await fs.readdir(dir, { recursive: true, withFileTypes: true }))
        .filter((e) => e.isFile() && !e.name.startsWith("."))
        .map((e) => path.relative(dir, path.join(e.parentPath ?? e.path, e.name))),
    );
    for (const [phrase, name] of Object.entries(manifest)) {
      if (!onDisk.has(name)) delete manifest[phrase];
    }

    // A re-worded lesson leaves its old recording behind, referenced by nothing.
    // Reported rather than deleted by default: a clip costs an API call, and
    // silently binning one because a prompt changed is not the script's call.
    const referenced = new Set(Object.values(manifest));
    const orphans = [...onDisk].filter((f) => f !== "manifest.json" && !referenced.has(f));
    // Never prune outside the folders this run was asked about.
    const inScopeOrphans =
      onlyFolders.size > 0 ? orphans.filter((f) => onlyFolders.has(f.split("/")[0])) : orphans;
    if (inScopeOrphans.length > 0) {
      if (args.includes("--prune")) {
        for (const f of inScopeOrphans) await fs.rm(path.join(dir, f));
        console.log(`  pruned ${inScopeOrphans.length} unreferenced clip(s)`);
      } else {
        console.log(`  ${inScopeOrphans.length} unreferenced clip(s) — \`--prune\` removes them`);
      }
    }

    await fs.writeFile(
      path.join(dir, "manifest.json"),
      `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2)}\n`,
    );
    console.log(`  ${Object.keys(manifest).length} clip(s) in src/skills/${skillId}/audio/`);
  }
}

await main();
