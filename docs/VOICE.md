# The voice

The app speaks: numbers as a child taps, a prompt when a lesson opens, a line
when ten ones become a ten. That speech used to be a network round trip every
time — `koda.speech.say()` called Gemini TTS per utterance — so a child tapped a
rocket and *waited* before hearing "three". On every tap.

The words are almost all authored, so they can be recorded once and played from
disk. That is what this is.

---

## How a spoken line resolves

`koda.speech.say(text)` tries three things in order:

1. **A recording** — the skill registered its clips at import time and
   `lib/voiceClips.ts` plays the matching one. Instant, offline, free.
2. **Live TTS** — `POST /api/tutor/speech`, Gemini, one round trip.
3. **The browser's own voice** — `speakWebSpeech`, when the server has no key or
   speech is switched off.

Only step 1 is new. Nothing had to change about 2 and 3, which is why shipping
with no recordings at all behaves exactly as before: an unrecorded phrase is
*slower*, never silent, and the app works with an empty manifest.

### Why the lookup is synchronous

`playClip` returns a boolean rather than a promise. If it answered
asynchronously, the caller could not fall through to live TTS without awaiting it
first — which puts back the delay the recordings exist to remove.

That is why clips are **registered at import time** rather than fetched. A skill
globs its own `audio/` folder from `index.ts`, Vite emits each clip as a hashed
asset, and the URLs are known before anything renders. There is no request to
wait on and no window in which the app knows a phrase exists but cannot yet say
it.

---

## Recording

The key goes in `.env`, beside the one the server already reads:

```bash
echo 'GEMINI_API_KEY=your-key-here' >> .env
```

```bash
npm run voice:record -- --dry-run       # what would be recorded, no key needed
npm run voice:record -- --limit 5       # record five, to hear it before paying for 140
npm run voice:record -- --skill counting  # one skill only
GEMINI_API_KEY=... npm run voice:record # record everything missing
npm run voice:record -- --force         # re-record, e.g. after changing voice
```

Clips land in **the skill's own folder** — `src/skills/counting/audio/` — as WAV
named by a hash of the phrase, alongside a `manifest.json` mapping phrase to
file. Beside `assets/`, for the same reason: a skill is what it teaches, what it
draws with, and what it says, and removing it should take all three.

### How many files

One per phrase. Counting currently declares **140**, so 140 clips at roughly
20 KB each — about 2.8 MB of WAV, emitted as hashed assets and cached like any
other static file.

That is the argument for `--import` below: mp3 is roughly a fifth the size, and
the recorder will take mp3 happily. It generates WAV only because Gemini returns
raw PCM and wrapping it in a RIFF header needs no external tool, where
transcoding would need ffmpeg.

**It is incremental.** A phrase whose file already exists is skipped, so adding
one lesson costs one API call. **It is content-addressed**, so editing a lesson's
wording produces a new file rather than leaving the old recording under the same
name — which would have the app cheerfully saying last week's copy.

**It never runs automatically.** Unlike `svg:ids` and the art seed, this costs
money per phrase and needs a key, so it stays a deliberate command.

### Bring your own voice

A paid model per phrase is not the only way, and for a fixed list of 140 lines it
is rarely the best one:

```bash
npm run voice:record -- --skill counting --import ./my-voice
```

The folder holds an `index.json` of `{ "phrase": "file.wav" }` plus the files it
names. They are installed under the same content-addressed names a generated clip
would get, so imported and generated clips are interchangeable. Any format a
browser will play works — wav, mp3, ogg, m4a. No API key is involved.

This is the path for a cheaper TTS provider, or for a real person reading the
lines, which for a children's app is usually the better product anyway.

---

## What gets recorded

Two sources, deliberately:

**Collected automatically** — every skill's `lessons.json`, reading
`params.play.audioPrompt`, `targetObjective` and `prompts.*`. Writing a lesson
therefore never means remembering to edit a phrase list.

**Declared in the skill's `voice.json`** — speech that lives in code rather than
in a lesson: number words, the digit range (`FroggySkip` speaks pad values, which
reach the forties), fixed lines like "10 ones make 1 ten", and templates such as
`"Touch each {subject}. Count as you go!"` expanded over the countable objects.

The templates are the one place that needs upkeep: a skill shipping a new
countable should add its name to `subjects`. Forgetting costs a slower prompt,
not a broken one.

---

## Adding speech to a skill

Call `koda.speech.say("...")`. Then either add the phrase to the skill's
`voice.json`, or put it in a lesson's `audioPrompt` where it is collected for
you, and run the recorder.

A skill that has never been recorded needs an `audio/manifest.json` of `{}` and
the `registerSkillVoice` call in its `index.ts` — see `skills/counting/index.ts`.
Until clips exist, every line speaks through live TTS exactly as before.
