/**
 * Pre-recorded voice lines, played from disk instead of generated per utterance.
 *
 * `koda.speech.say()` used to be a network round trip every time. For a tutor
 * reply that is unavoidable; for counting it was the wrong trade entirely — a
 * child taps a rocket and waits on Gemini before hearing "three", on every tap.
 *
 * `scripts/generate-voice.mjs` records a skill's authored phrases into its own
 * `audio/` folder, and the skill registers them from its `index.ts` the same way
 * it registers its artwork. A hit plays immediately. A miss returns false and the
 * caller falls through to live TTS, so an unrecorded phrase is slower rather than
 * silent, and shipping with no recordings at all changes nothing.
 *
 * Registration is a build-time glob rather than a fetched manifest, so there is
 * no request to wait on and no window in which the app knows a phrase exists but
 * cannot yet say it. That matters because `playClip` has to answer synchronously
 * — see below.
 *
 * A leaf module by design: it imports nothing from the skill layer, so skills can
 * write to it without closing an import cycle.
 */

/**
 * The registry, held on `globalThis` rather than in module scope.
 *
 * Module-level state is the obvious way to write this and it is wrong here, for
 * a reason that only shows up in a browser: Vite serves an edited module under a
 * cache-busting `?t=` query, so `voiceClips.ts` and `voiceClips.ts?t=123` are two
 * modules with two separate Maps. A skill registers its clips into one; the
 * round hook reads the other and finds it empty. Every gate passes, every file
 * is served, and nothing plays.
 *
 * Anchoring to a global makes the registry survive that duplication — and any
 * other route to two copies of this module, which a lazily-loaded skill could
 * also produce.
 */
interface VoiceRegistry {
  /** phrase -> URL of its recording. */
  clips: Map<string, string>;
  /**
   * Who currently has the speaker, or null when it is free.
   *
   * A skill talks *at* a child — a number on every tap, a word of praise on
   * every answer. The voice coach talks *with* them, over a live microphone.
   * Those cannot share a speaker: counting "four, five, six" over the top of
   * Koda mid-sentence is unusable, and because the coach's mic is open it also
   * feeds the count straight back into the conversation as if the child had
   * said it.
   *
   * So the coach takes the floor for as long as it is live, and the skill
   * yields. One flag rather than a per-skill setting: a child talking to Koda
   * wants Koda, whichever lesson they happen to be inside.
   */
  floor: string | null;
  /**
   * group name -> the URLs that can answer it.
   *
   * A reaction is several recordings of the same intent, so that "correct" is
   * not one clip a child hears forty times in a session — which is how praise
   * stops being heard at all. Only URLs are kept: once a group is registered,
   * nothing needs the words back.
   */
  groups: Map<string, string[]>;
  /** Last variant played per group, so the next pick can avoid repeating it. */
  lastPlayed: Map<string, string>;
}

const REGISTRY = Symbol.for("koda.voiceClips");
type GlobalWithRegistry = typeof globalThis & { [REGISTRY]?: VoiceRegistry };

const registry: VoiceRegistry = ((globalThis as GlobalWithRegistry)[REGISTRY] ??= {
  clips: new Map(),
  floor: null,
  groups: new Map(),
  lastPlayed: new Map(),
});

const { clips, groups } = registry;

/**
 * Which voice each clip came from, so something can ask what a skill needs
 * before it can play with no network.
 *
 * The clip map itself is keyed by phrase and shared on purpose, so it cannot
 * answer that: once addition and the common pack have both registered, nothing
 * in it says which URLs belong to which. Kept here rather than derived, because
 * "what would this skill have to download" is a question the offline flow asks
 * about a skill the child has not opened yet.
 */
const owned = new Map<string, Set<string>>();

/** The name the common pack files its clips under. Not a skill id. */
export const COMMON_VOICE = "common";

/**
 * A phrase and its recording must key identically.
 *
 * The recorder hashes the phrase exactly as authored; this trims and collapses
 * runs of whitespace so a prompt reflowed across two lines in JSON still finds
 * its clip. Nothing more aggressive — folding case or punctuation would start
 * matching phrases that are meant to sound different.
 */
const key = (text: string): string => text.trim().replace(/\s+/g, " ");

/**
 * Where a skill's reactions are filed.
 *
 * A bare name is the unscoped pool, which only a caller that registered without
 * a skill id can reach. Every skill in the build passes one.
 */
const groupKey = (name: string, skillId?: string): string =>
  skillId ? `${skillId}:${name}` : name;

/**
 * Everything a skill may say for one reaction: its own words and the common
 * pack's, never another skill's.
 *
 * The union rather than a fallback. A skill that recorded one line of its own
 * would otherwise say that single line after every correct answer for the rest
 * of the round, while a dozen neutral ones sat unused in common.
 */
const reactionPool = (name: string, skillId?: string): string[] => {
  const own = skillId ? (groups.get(groupKey(name, skillId)) ?? []) : [];
  const common = groups.get(name) ?? [];
  return [...new Set([...own, ...common])];
};

/**
 * Register one skill's recordings.
 *
 * `manifest` maps phrase to filename — written by the recorder into the skill's
 * `audio/manifest.json`. `files` is that folder globbed for URLs:
 *
 * ```ts
 * registerSkillVoice(
 *   audioManifest,
 *   import.meta.glob("./audio/*", { query: "?url", import: "default", eager: true }),
 * );
 * ```
 *
 * Vite emits each clip as a hashed asset and hands back its URL, so the files are
 * versioned with the build and cached like any other static asset. A manifest
 * entry whose file is missing is skipped rather than registered as a broken URL —
 * that phrase then simply takes the live path.
 */
const register = (
  manifest: Record<string, string>,
  files: Record<string, string>,
  declaredGroups: Record<string, { phrases?: string[] }>,
  skillId: string | undefined,
  /** False for the common pack: a skill saying a line its own way wins. */
  overwrite: boolean,
): number => {
  // Glob keys are paths relative to the skill ("./audio/numbers/three.wav");
  // the manifest names them relative to `audio/` ("numbers/three.wav"). Matched
  // on the folder-and-file tail rather than the bare filename, because the same
  // name legitimately appears in two folders — `numbers/one.wav` beside a future
  // `lessons/one.wav` — and keying on the basename alone would collapse them.
  const byPath = new Map<string, string>();
  for (const [filePath, url] of Object.entries(files)) {
    byPath.set(filePath.replace(/^.*\/audio\//, ""), url);
  }

  let registered = 0;
  for (const [phrase, name] of Object.entries(manifest)) {
    const url = byPath.get(name);
    if (!url) continue;
    if (!overwrite && clips.has(key(phrase))) continue;
    clips.set(key(phrase), url);
    const owner = skillId ?? COMMON_VOICE;
    if (!owned.has(owner)) owned.set(owner, new Set());
    owned.get(owner)!.add(url);
    registered += 1;
  }

  /*
   * Only variants that actually recorded join a group, so a half-recorded group
   * still works — it just has fewer ways of saying it.
   *
   * Filed under the skill that declared them. Clips are deliberately shared —
   * "seven" is "seven", and a second skill saying it should not pay to record it
   * again — but a *reaction* is written for one subject and does not travel.
   * Unscoped, counting's eight praise clips answered addition's rounds, so a
   * child who added 7 and 3 was told "Brilliant counting!"; recording addition
   * would then have put "You put them together!" into counting's rounds. The
   * pool is per skill for the same reason a skill ships its own artwork.
   *
   * Still appended and deduped within a skill, because a module can register
   * more than once — HMR re-executes it, and so does a second import. Without
   * the Set those repeats stack: one dev session showed 32 variants of an
   * 8-clip group, which plays fine but quietly skews which praise a child hears.
   */
  for (const [name, group] of Object.entries(declaredGroups)) {
    const urls = (group.phrases ?? [])
      .map((phrase) => clips.get(key(phrase)))
      .filter((url): url is string => Boolean(url));
    if (urls.length > 0) {
      const scoped = groupKey(name, skillId);
      groups.set(scoped, [...new Set([...(groups.get(scoped) ?? []), ...urls])]);
    }
  }

  return registered;
};

/**
 * Register one skill's recordings.
 *
 * Its phrases join the shared pool and its reactions are filed under its own
 * name. See the note above for why those two are treated differently.
 */
export const registerSkillVoice = (
  manifest: Record<string, string>,
  files: Record<string, string>,
  declaredGroups: Record<string, { phrases?: string[] }> = {},
  skillId?: string,
): number => register(manifest, files, declaredGroups, skillId, true);

/**
 * Register the app's own recordings — the common pack.
 *
 * What every skill says the same way: the number words and digits, the two
 * place-value facts, and praise that names no subject. It lives outside
 * `src/skills/` because it belongs to none of them: before this, addition's
 * count-along was instant only because *counting* happened to be installed, and
 * removing counting would have taken addition's numbers with it.
 *
 * Two rules make it safe to share. A skill's own recording of a line wins, so
 * common never overwrites — it fills gaps. And its reactions are added to a
 * skill's own rather than replacing them, so a skill keeps whatever flavour it
 * recorded ("Brilliant counting!") and still has neutral praise to draw on
 * before it has recorded any.
 */
export const registerCommonVoice = (
  manifest: Record<string, string>,
  files: Record<string, string>,
  declaredGroups: Record<string, { phrases?: string[] }> = {},
): number => register(manifest, files, declaredGroups, undefined, false);

/** How many variants a reaction can draw on. Zero means it stays silent. */
export const groupSize = (name: string, skillId?: string): number =>
  reactionPool(name, skillId).length;

/** The clip URL for a phrase, or undefined when it was never recorded. */
export const clipUrl = (text: string): string | undefined => clips.get(key(text));

/** How many clips are registered. For a test, or a diagnostic. */
export const clipCount = (): number => clips.size;

/**
 * Every clip URL a skill needs to sound like itself with no network.
 *
 * Its own recordings plus the common pack's, which is exactly what
 * `playReaction` and `clipUrl` will reach for — a skill that had only its own
 * warmed would count aloud in the browser's voice on a train.
 *
 * Empty is a normal answer, not a failure: a skill nobody has recorded yet is
 * already fully playable offline, because its lessons and artwork are bundled
 * with the app. Only speech is fetched.
 */
export const clipUrlsFor = (skillId?: string): string[] => [
  ...new Set([
    ...(skillId ? (owned.get(skillId) ?? []) : []),
    ...(owned.get(COMMON_VOICE) ?? []),
  ]),
];

/** The element currently speaking, so a new line can cut off the last one. */
let playing: HTMLAudioElement | null = null;

/**
 * What to run when the current clip stops being audible.
 *
 * A caller sometimes has to wait for a word to be *heard*, not merely started —
 * counting submits the answer only once the last number has been said, and a
 * fixed delay guessed wrong on a phone, where a clip can take a few hundred
 * milliseconds to begin. Cleared before it runs, so it fires exactly once
 * whether the clip ended, failed, or was cut off by the next line.
 */
let playingDone: (() => void) | null = null;

const settle = (): void => {
  const done = playingDone;
  playingDone = null;
  done?.();
};

/**
 * Start one clip, replacing whatever was speaking.
 *
 * Nothing here may throw. This is called from inside `useSkillRound.submit`,
 * which goes on to record the answer and show the feedback panel — so an
 * exception raised for a *sound* would stop a child being told whether they were
 * right. Audio is a flourish; the round is the product.
 *
 * `play()` is the specific hazard. It returns a promise in a browser and rejects
 * when autoplay is blocked, but it is also allowed to throw synchronously, and
 * does in jsdom. A bare `.catch()` misses that case entirely, so the call is
 * wrapped rather than only chained.
 */
const play = (url: string, rate: number, onEnd?: () => void): boolean => {
  try {
    // Ends the previous line before this one takes the slot, so whoever was
    // waiting on it is told rather than left waiting on a clip that stopped.
    stopClip();
    const audio = new Audio(url);
    audio.playbackRate = Math.max(0.5, Math.min(2, rate));
    playing = audio;
    playingDone = onEnd ?? null;
    const done = () => {
      if (playing !== audio) return;
      playing = null;
      settle();
    };
    audio.addEventListener("ended", done);
    // A clip that fails to load never ends, and a caller waiting on it would
    // wait forever. Treat the failure as the end of the line.
    audio.addEventListener("error", done);
    const started = audio.play();
    // A browser that blocks autoplay before the first gesture rejects here. The
    // line is already lost by then, so there is nothing to fall back to — but it
    // must not surface as an unhandled rejection.
    if (started && typeof started.catch === "function") {
      void started.catch(done);
    }
    return true;
  } catch {
    playing = null;
    playingDone = null;
    onEnd?.();
    return false;
  }
};

export const stopClip = (): void => {
  if (!playing) return;
  playing.pause();
  playing = null;
  settle();
};

/**
 * Take the speaker, and silence whatever a skill was saying.
 *
 * Returns the release. Held here rather than in React state because the two
 * things that have to agree are not components: a modal decides the coach is
 * live, and an SDK method several trees away decides whether to speak. Passing
 * that down as a prop would mean every activity threading a flag it never
 * reads, and forgetting it would be silent.
 *
 * Re-entrant by owner: releasing only clears the floor if you are still the one
 * holding it, so a late cleanup from a modal that has already been replaced
 * cannot hand the speaker back while the new one is talking.
 */
export const holdVoiceFloor = (owner: string): (() => void) => {
  registry.floor = owner;
  // Mid-word is exactly when this happens — a child taps Koda while a count is
  // still being spoken — so the line in flight stops rather than finishing over
  // the top of the greeting.
  stopClip();
  return () => {
    if (registry.floor === owner) registry.floor = null;
  };
};

/** Whether something other than a skill currently owns the speaker. */
export const voiceFloorHeld = (): boolean => registry.floor !== null;

const { lastPlayed } = registry;

/**
 * Play a random variant of a reaction — "correct", "incorrect".
 *
 * Returns false when the group has no recordings, which is the normal state
 * before anyone has run the recorder. Silence is the right fallback here: unlike
 * a prompt, a reaction is a flourish, and paying for a live TTS call on every
 * wrong answer would be both slow and expensive for something nobody asked for.
 *
 * Never plays the same variant twice running while an alternative exists. Pure
 * chance repeats about as often as a coin lands twice — often enough that a
 * child notices, which is exactly what having variants was meant to avoid.
 */
export const playReaction = (name: string, rate = 1, skillId?: string): boolean => {
  // Praise is the most interrupting thing a skill says, and the least missed:
  // it lands on every answer, and a child mid-conversation with Koda has not
  // asked for it.
  if (voiceFloorHeld()) return false;
  /*
   * This skill's own reactions plus the common pack's.
   *
   * Never another skill's: counting's "Brilliant counting!" after 7 + 3 is the
   * bug scoping exists to prevent, and it stays prevented — common holds only
   * lines that name no subject. A skill with nothing of its own is no longer
   * silent, though, which is what lets a new skill sound finished on the day it
   * ships and makes its own flavour an upgrade rather than a prerequisite.
   */
  const groupName = groupKey(name, skillId);
  const urls = reactionPool(name, skillId);
  if (urls.length === 0) return false;

  const previous = lastPlayed.get(groupName);
  const choices = urls.length > 1 ? urls.filter((url) => url !== previous) : urls;
  const url = choices[Math.floor(Math.random() * choices.length)];
  lastPlayed.set(groupName, url);

  return play(url, rate);
};

/**
 * Play the recording for `text`, if there is one.
 *
 * Returns false when there is no clip, which is the caller's signal to fall
 * through to live TTS. Synchronous about that decision on purpose: an async
 * answer would mean the fallback could not start without an await in front of
 * it, reintroducing the delay this exists to remove.
 *
 * `rate` is applied with `playbackRate`, which shifts timing without shifting
 * pitch, so a skill's `speechRate` setting still does something for a recording.
 */
export const playClip = (text: string, rate = 1, onEnd?: () => void): boolean => {
  const url = clipUrl(text);
  if (!url) return false;
  return play(url, rate, onEnd);
};
