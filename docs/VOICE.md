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

## Who has the speaker

Two things in this app talk. A skill talks **at** a child — a number on every
tap, a word of praise on every answer. The voice coach (Ask Koda, the live
session) talks **with** them, over an open microphone.

They cannot share a speaker, and the reason is not politeness. The coach's
microphone is live, so a lesson counting *"four, five, six"* over the top of it
is picked up and answered **as though the child had said it**. The conversation
derails and nobody can see why.

So there is one rule:

> **While the voice coach is live, a skill says nothing.**

### Three switches before a line is spoken

`koda.speech.say()` is the one place that decides whether a skill talks. It
returns without speaking when any of these is true:

| Switch | Who sets it | Where |
|---|---|---|
| The voice coach holds the floor | Koda, while a live session runs | automatic |
| **Koda's Voice** is off | the learner or their family | Settings, beside Sound FX |
| **Spoken voice** is off for this skill | a parent, per skill | Skill Manager → the skill's features (`audio_speech`) |

All three live in `say()` rather than in each activity, because in the
activities they were checked inconsistently. The count-along honoured the
per-skill feature and the Read-aloud button did not, so a lesson with its voice
switched off went quiet only until a child pressed the speaker. And the
learner's own preference was read by praise alone — so turning Koda's Voice off
in Settings silenced "Nice work!" while the lesson carried on counting out loud,
and **opening a question still read the prompt aloud every time**, which is the
one line a child hears on every single question.

A skill that declares no `audio_speech` feature has not opted out of talking, so
the default is on.

### How it works



One flag, held on the same global registry the clips use:

```ts
import { holdVoiceFloor, voiceFloorHeld } from "lib/voiceClips";

const release = holdVoiceFloor("voice-coach");  // take it; returns the release
voiceFloorHeld();                               // is someone else talking?
release();                                      // give it back
```

Three places implement the rule, and that is all of them:

| Where | What it does |
|---|---|
| `LiveVoiceCoachModal` | Holds the floor while its session is live; the effect cleanup releases it, so closing the modal, leaving the round or unmounting all give it back |
| `createKodaSDK.speech.say()` | Returns early — **every** line **every** skill speaks goes through here |
| `playReaction` | Yields too, because praise bypasses `say()` and fires on every answer |

`holdVoiceFloor` also calls `stopClip()`, because mid-word is exactly when this
happens: a child taps Koda while a number is still being spoken.

### What a skill author has to do

**Nothing.** That is the point of putting the gate in the SDK. Counting,
addition and every skill after them inherit it by calling `koda.speech.say()`,
which they already do.

What *would* break it is going around the SDK. A skill must never:

- import `playClip` or `playReaction` from `lib/voiceClips` directly,
- call `window.speechSynthesis` or `new Audio()` itself,
- or fetch `/api/tutor/speech` on its own.

`docs/PLUGINS.md` already forbids all three — "touch the host only through the
injected `koda`, including sound, haptics and speech" — and this is one of the
things that rule was protecting.

### Two deliberate boundaries

**Chimes and haptics still fire.** `koda.sound.play()` is a pop, not a sentence,
and silencing every tap would make a lesson feel dead while a child is reading
the screen mid-conversation. If a live mic picking up pops turns out to matter,
the gate goes in `playSound` and nowhere else — one line, same flag.

**`say()` resolves, it does not reject.** `useSkillRound` awaits the last spoken
number before submitting an answer. A suppressed line that threw, or never
settled, would leave a round stuck behind a sound that was never going to play.

### Adding another holder

Anything else that takes over the speaker — a video, a read-aloud story, a
second live mode — holds the floor the same way, with its own owner name:

```ts
useEffect(() => {
  if (!playing) return;
  return holdVoiceFloor("story-player");
}, [playing]);
```

Release only clears the floor if you are still the one holding it, so a stale
cleanup from a component that has already been replaced cannot hand the speaker
back while a newer holder is talking.

### Testing it

`src/skills/sdk/createKodaSDK.test.ts` holds the rule for every skill at once —
a skill speaks when the floor is free, says nothing while it is held, does not
even reach the network for a line nobody will hear, and speaks again on release.
`src/lib/voiceClips.test.ts` covers the floor itself, including the stale-release
case. A new skill needs no test of its own for this.

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

### Seeing the plan before you spend anything

```bash
npm run voice:plan                      # every skill
npm run voice:plan -- --skill addition  # one of them
```

No key needed. It prints the file each line will land in, the voice that will
read it, and the line itself:

```
addition: 49 phrases, 49 missing
  numbers/seven.wav                              Kore    "seven"
  prompts/start-at-6-and-count-on.wav            Kore    "Start at 6 and count on."
  correct/you-put-them-together.wav              Puck    "You put them together!"
  incorrect/hmm-lets-look-again.wav              Zephyr  "Hmm, let's look again."
  lessons/count-them-all-touch-every-one-in-bo…  Kore    "Count them all! Touch every one…"
```

`voice:plan` is `voice:record --dry-run`; the same flags apply.

### What each folder is, and when a child hears it

The folder is the clip's job, which is why the names are readable rather than
hashes — you can find a bad recording and replace it without resolving the
manifest by hand.

| Folder | What it holds | When it plays |
|---|---|---|
| `numbers/` | number words, `"one"`–`"twenty"` | the count-along, on every tap |
| `lessons/` | each lesson's `audioPrompt` | once, as the round opens |
| `prompts/` | fixed question wording, and expanded templates | the Read-aloud button |
| `phrases/` | fixed lines an activity says in passing | in play — "Put them together!" |
| `correct/` | praise variants | every right answer |
| `incorrect/` | encouragement variants | every wrong answer |

`correct/` and `incorrect/` are the reaction groups, and they rotate voices
across their phrases rather than recording each line in every voice — same
variety for a fraction of the calls. They are also **scoped per skill**, so
counting's praise never answers an addition round.

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
