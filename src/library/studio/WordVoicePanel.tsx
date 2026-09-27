import { useEffect, useMemo, useState } from "react";
import { Mic, Play, Sparkles, Square, Trash2, Upload } from "lucide-react";
import type { Passage } from "../data/passage";
import { core } from "../data/text";
import { clipSizes, uploadClip } from "../clips";
import { say } from "../voice";
import { useRecorder } from "./recorder";
import { asStandardAudio } from "./UnitNamesPanel";

/**
 * A recording for each word a child can tap.
 *
 * Separate from the sentence recordings on purpose, because they do different
 * jobs. A sentence is recorded for reading aloud, and its words cannot be cut
 * out of it and replayed — a word lifted from the middle of a sentence carries
 * the sentence's falling pitch and sounds wrong on its own. A word recorded by
 * itself is what a child needs when they stop at one they do not know, which in
 * Khmer is the common case: the script writes no spaces, so a child who cannot
 * yet see where a word ends cannot sound it out, and most phones have no Khmer
 * voice to fall back on.
 *
 * Recorded once per *distinct* word. ថ្ងៃ appears four times in the market story
 * and is one recording; the reader looks every occurrence up by the same key.
 */

type Draft = Omit<Passage, "rev">;

const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;
const icon = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink hover:border-indigo-400 disabled:opacity-40";

/** One word to record, and where it turns up. */
export interface WordToVoice {
  /** What `wordAudio` is keyed by — exactly what a tap in the reader looks up. */
  key: string;
  /** The word as the story first writes it, which is what an author should read. */
  shown: string;
  /** How many times it appears, so an author can see what one recording buys. */
  times: number;
}

/**
 * Every distinct word in a story, in the order a reader meets them.
 *
 * Keyed the way the reader looks a word up: punctuation stripped by the same
 * `core` the page itself uses, and lowercased, because the reader falls back to
 * the lowercase form — so "The" at the start of a sentence and "the" in the
 * middle of one share a recording instead of needing two.
 */
export function wordsToVoice(sentences: Draft["sentences"]): WordToVoice[] {
  const found = new Map<string, WordToVoice>();
  for (const sentence of sentences) {
    for (const token of sentence.words) {
      const shown = core(token);
      if (!shown) continue;
      const key = shown.toLowerCase();
      const seen = found.get(key);
      if (seen) seen.times++;
      else found.set(key, { key, shown, times: 1 });
    }
  }
  return [...found.values()];
}

export function WordVoicePanel({ draft, onEdit, generate, generatorName }: {
  draft: Draft;
  onEdit(d: Draft): void;
  /** Reads one word in the studio's chosen voice. Absent when there is none. */
  generate?(word: string): Promise<Blob>;
  generatorName?: string;
}) {
  const km = draft.language === "km";
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const recorder = useRecorder();
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const words = useMemo(() => wordsToVoice(draft.sentences), [draft.sentences]);
  const audio = draft.wordAudio ?? {};
  const recorded = words.filter((w) => audio[w.key]).length;
  const clipIds = [...new Set(words.flatMap((w) => (audio[w.key] ? [audio[w.key]] : [])))];
  const clipKey = clipIds.join(",");

  useEffect(() => {
    let live = true;
    void clipSizes(clipIds).then((got) => live && setSizes((now) => ({ ...now, ...got })));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ids, not the array's identity
  }, [clipKey]);

  const keep = async (key: string, blob: Blob) => {
    setBusy(key);
    setErr("");
    try {
      const clip = await uploadClip(asStandardAudio(blob));
      setSizes((now) => ({ ...now, [clip.id]: clip.bytes }));
      onEdit({ ...draft, wordAudio: { ...audio, [key]: clip.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The recording could not be saved.");
    } finally {
      setBusy(null);
    }
  };
  const forget = (key: string) => {
    const { [key]: _gone, ...rest } = audio;
    onEdit({ ...draft, wordAudio: rest });
  };
  const readIt = async (word: WordToVoice) => {
    if (!generate) return;
    setBusy(word.key);
    setErr("");
    try {
      const blob = await generate(word.shown);
      const clip = await uploadClip(asStandardAudio(blob));
      setSizes((now) => ({ ...now, [clip.id]: clip.bytes }));
      onEdit({ ...draft, wordAudio: { ...audio, [word.key]: clip.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That voice could not be reached.");
    } finally {
      setBusy(null);
    }
  };
  /** The ones still missing, one at a time so a failure stops rather than repeats. */
  const readTheRest = async () => {
    if (!generate) return;
    setErr("");
    let next = draft;
    for (const word of words) {
      if (next.wordAudio?.[word.key]) continue;
      setBusy(word.key);
      try {
        const clip = await uploadClip(asStandardAudio(await generate(word.shown)));
        setSizes((now) => ({ ...now, [clip.id]: clip.bytes }));
        next = { ...next, wordAudio: { ...(next.wordAudio ?? {}), [word.key]: clip.id } };
        onEdit(next);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "That voice could not be reached.");
        break;
      }
    }
    setBusy(null);
  };

  const stored = clipIds.reduce((total, id) => total + (sizes[id] ?? 0), 0);
  const known = clipIds.every((id) => sizes[id] !== undefined);

  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-3 py-3 text-sm font-extrabold text-ink marker:content-none">
        ▾ Tap-a-word recordings — {recorded} of {words.length} words
        {recorded > 0 && known && <span className="ml-2 font-bold text-muted">{Math.round(stored / 1024)} KB</span>}
      </summary>
      <div className="grid gap-3 border-t border-line px-3 py-3">
        <p className="text-sm text-muted">
          A child who stops at a word taps it and hears this. One recording per word, however many times the story uses it — say the word on its own, the way
          you would to a child asking. Leave a word out and tapping it just shows the word.
        </p>
        {generate && (
          <div>
            <button type="button" className={quiet} disabled={busy !== null || recorded === words.length} onClick={() => void readTheRest()}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {busy !== null ? "Generating…" : `${generatorName ?? "Generated"} voice for the rest`}
            </button>
          </div>
        )}
        {err && <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{err}</p>}
        {!canRecord && <p className="text-xs text-muted">This browser cannot record from a microphone — upload a recording instead.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {words.map((w) => {
            const clip = audio[w.key];
            const live = recorder.recording === w.key;
            return (
              <li key={w.key} data-word-voice={w.key} className="flex items-center gap-2 rounded-2xl border border-line px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-bold text-ink ${km ? `${KHMER} text-lg` : ""}`}>{w.shown}</span>
                  <span className={`text-xs font-bold ${clip ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>
                    {busy === w.key ? "Saving…" : clip ? "✓ Recorded" : "Not recorded"}
                    {w.times > 1 && <span className="ml-1 font-normal text-muted">· {w.times}×</span>}
                  </span>
                </span>
                {clip && (
                  <button type="button" className={icon} aria-label={`Play ${w.shown}`} onClick={() => void say(w.shown, draft.language, clip)}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                {canRecord && (
                  <button
                    type="button"
                    className={`${icon} ${live ? "border-rose-600 bg-rose-600 text-white" : ""}`}
                    aria-label={live ? `Stop recording ${w.shown}` : `Record ${w.shown}`}
                    disabled={busy !== null || (recorder.recording !== null && !live)}
                    onClick={() => (live ? recorder.stop() : void recorder.start(w.key, (blob) => void keep(w.key, blob)).catch(() => setErr("The microphone could not be opened.")))}
                  >
                    {live ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                  </button>
                )}
                {generate && (
                  <button type="button" className={icon} aria-label={`Read ${w.shown} in the chosen voice`} disabled={busy !== null} onClick={() => void readIt(w)}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <label className={`${icon} cursor-pointer`} aria-label={`Upload a recording of ${w.shown}`}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <input type="file" accept="audio/*" className="sr-only" disabled={busy !== null}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void keep(w.key, f); }} />
                </label>
                {clip && (
                  <button type="button" className={icon} aria-label={`Remove the recording of ${w.shown}`} disabled={busy !== null} onClick={() => forget(w.key)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
