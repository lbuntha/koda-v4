import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mic, Play, Square, Trash2, Upload } from "lucide-react";
import { fetchSpellingUnitsInUse } from "../api";
import { useShelf } from "../bookStore";
import type { Passage } from "../data/passage";
import { uploadClip } from "../clips";
import { unitLabel } from "../data/khmer";
import { UNIT_GROUPS, unitName } from "../data/khmerCoach";
import { tilesOf } from "../data/tiles";
import { UnitVoices, useUnitVoices } from "../unitVoices";
import { say, stop } from "../voice";
import { useRecorder } from "./recorder";

/**
 * Khmer sound names — a person records each spelling unit's classroom name
 * (ក, ជើងម, ស្រៈអែ …) once, and every child hears it while spelling.
 *
 * The units used by the studio's Khmer books come first, so the recordings that
 * matter today are the first ones made. A name can be recorded here with the
 * microphone, or uploaded from a phone's recorder.
 */

const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;
const chip = (on: boolean) =>
  `${btn} border ${on ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100" : "border-line bg-surface text-ink hover:border-indigo-400"}`;
const icon = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink hover:border-indigo-400 disabled:opacity-40";

/** Phone recorders label the same formats several ways; the server takes the standard names. */
const STANDARD: Record<string, string> = { "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "audio/aac": "audio/mp4", "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav" };
export const asStandardAudio = (b: Blob): Blob => (STANDARD[b.type] ? new Blob([b], { type: STANDARD[b.type] }) : b);

/** The units a set of books asks children to spell. */
export function unitsUsedBy(books: readonly Pick<Passage, "language" | "questions">[]): Set<string> {
  const out = new Set<string>();
  for (const book of books) {
    if (book.language !== "km") continue;
    for (const q of book.questions) if (q.kind === "spell") tilesOf(q.word, "km").forEach((u) => out.add(u));
  }
  return out;
}

export function UnitNamesPanel({ onClose }: { onClose(): void }) {
  const voices = useUnitVoices();
  const shelf = useShelf();
  // Every book the server has (drafts too), plus what ships on the shelf.
  const [fromServer, setFromServer] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    fetchSpellingUnitsInUse("km").then((u) => live && setFromServer(u)).catch(() => {});
    return () => { live = false; };
  }, []);
  const used = useMemo(() => new Set([...fromServer, ...unitsUsedBy(shelf)]), [fromServer, shelf]);
  const [choice, setOnly] = useState<boolean | null>(null);
  const only = choice ?? used.size > 0;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const recorder = useRecorder();
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const all = UNIT_GROUPS.flatMap((g) => g.units);
  const recorded = all.filter((u) => voices[u]).length;
  const usedRecorded = [...used].filter((u) => voices[u]).length;

  const keep = async (unit: string, blob: Blob) => {
    setBusy(unit);
    setErr("");
    try {
      await UnitVoices.save(unit, (await uploadClip(asStandardAudio(blob))).id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The recording could not be saved.");
    } finally {
      setBusy(null);
    }
  };
  const forget = async (unit: string) => {
    setBusy(unit);
    setErr("");
    try {
      await UnitVoices.save(unit, null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove it.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6">
      <button type="button" className={quiet} onClick={() => { stop(); onClose(); }}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Library Studio
      </button>
      <header className="mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Khmer sound names</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Record each piece’s classroom name once — a child hears it as they choose the tile, and when a hint names the next piece. Say the name clearly, as a
          teacher would in class. Without a recording, a device with a Khmer voice reads the name; most phones have none.
        </p>
        <p className="mt-2 text-sm font-bold text-ink">
          {recorded} of {all.length} recorded{used.size > 0 && ` · ${usedRecorded} of the ${used.size} the books use`}
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Show">
        {used.size > 0 && (
          <button type="button" aria-pressed={only} onClick={() => setOnly(true)} className={chip(only)}>
            Used in books ({used.size})
          </button>
        )}
        <button type="button" aria-pressed={!only} onClick={() => setOnly(false)} className={chip(!only)}>
          All ({all.length})
        </button>
      </div>
      {err && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{err}</p>}
      {!canRecord && <p className="mt-3 text-sm text-muted">This browser cannot use the microphone here — upload recordings from a phone instead.</p>}

      {UNIT_GROUPS.map((g) => {
        const units = only ? g.units.filter((u) => used.has(u)) : g.units;
        if (!units.length) return null;
        return (
          <section key={g.title} className="mt-6" aria-label={g.title}>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">{g.title}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {units.map((u) => {
                const clip = voices[u];
                const live = recorder.recording === u;
                return (
                  <li key={u} data-unit={u} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-muted text-2xl text-ink ${KHMER}`} aria-hidden="true">{unitLabel(u)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-lg font-bold text-ink ${KHMER}`}>{unitName(u)}</span>
                      <span className={`text-xs font-bold ${clip ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>{busy === u ? "Saving…" : clip ? "✓ Recorded" : "Not recorded"}</span>
                    </span>
                    {clip && (
                      <button type="button" className={icon} aria-label={`Play ${unitName(u)}`} onClick={() => void say(unitName(u), "km", clip)}>
                        <Play className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    {canRecord && (
                      <button
                        type="button"
                        className={`${icon} ${live ? "border-rose-600 bg-rose-600 text-white" : ""}`}
                        aria-label={live ? `Stop recording ${unitName(u)}` : `Record ${unitName(u)}`}
                        disabled={busy !== null || (recorder.recording !== null && !live)}
                        onClick={() => (live ? recorder.stop() : void recorder.start(u, (blob) => void keep(u, blob)).catch(() => setErr("The microphone could not be opened.")))}
                      >
                        {live ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    )}
                    <label className={`${icon} cursor-pointer`} aria-label={`Upload a recording of ${unitName(u)}`}>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      <input type="file" accept="audio/*" className="sr-only" disabled={busy !== null}
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void keep(u, f); }} />
                    </label>
                    {clip && (
                      <button type="button" className={icon} aria-label={`Remove the recording of ${unitName(u)}`} disabled={busy !== null} onClick={() => void forget(u)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
