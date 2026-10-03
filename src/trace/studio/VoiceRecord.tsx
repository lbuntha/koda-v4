import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Sparkles, Square, Trash2, Volume2, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { uploadClip } from "../../library/clips";
import { say } from "../../library/voice";
import { useRecorder } from "../../library/studio/recorder";
import { tutorHeaders } from "../../lib/tutorApi";
import { asStandardAudio } from "../../library/studio/UnitNamesPanel";
import { OPENAI_VOICES, orderedFor, type VoxVoice } from "../../library/voxApi";
import type { TraceItem } from "../geometry/types";
import { canUseAi } from "./autoStrokes";
import { IconButton, inputCls } from "./ui";

type Provider = "openai" | "gemini" | "vox";
const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "openai", name: "ChatGPT" },
  { id: "gemini", name: "Gemini" },
  { id: "vox", name: "Vox" },
];
/** Gemini's voices are the library's four storytellers; the server maps each to its Gemini voice. */
const GEMINI_VOICES = [
  { id: "lila", name: "Lila" },
  { id: "milo", name: "Milo" },
  { id: "zara", name: "Zara" },
  { id: "ari", name: "Ari" },
];
const PROVIDER_KEY = "koda_trace_voice_provider_v1";
const voiceKey = (p: Provider) => `koda_trace_voice_${p}_v1`;
const remembered = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* an authoring preference is optional */
  }
};

/** Read by the chosen AI voice, as audio. Throws the server's reason when it cannot. */
async function aiVoice(body: { text: string; title: string; kind: string; language: "km" | "en"; provider: Provider; voice: string }): Promise<Blob> {
  const res = await fetch("/api/trace/voice", { method: "POST", headers: await tutorHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const reply = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(reply?.error?.message ?? reply?.message ?? "");
  }
  return res.blob();
}

async function voxVoices(): Promise<VoxVoice[]> {
  const res = await fetch("/api/trace/voices", { headers: await tutorHeaders() });
  const body = (await res.json().catch(() => null)) as { voices?: VoxVoice[]; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(body?.error?.message ?? "");
  return body?.voices ?? [];
}

/**
 * What the item sounds like — a letter's name, a word — for the learner's
 * speaker button. The creator writes what is said (the title, or more:
 * "ក — ក្អែក"), then records it or has an AI voice read it (paid `trace.ai`,
 * like AI strokes), choosing ChatGPT, Gemini or Vox. Either way it is kept in
 * the library's clip store, so it is cached on the device and plays offline.
 *
 * One toolbar button opens it, so the toolbar stays short on a phone; there
 * the panel is a sheet across the bottom of the screen, wider up a popover.
 */
export function VoiceRecord({ item, onVoice }: { item: TraceItem; onVoice(clipId: string | undefined, text: string | undefined): void }) {
  const { t } = useT();
  const recorder = useRecorder();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "ai">("");
  const [err, setErr] = useState("");
  const [text, setText] = useState(item.voiceText ?? "");
  const [ai, setAi] = useState(false);
  const [provider, setProviderState] = useState<Provider>(() => {
    const saved = remembered(PROVIDER_KEY);
    return saved === "gemini" || saved === "vox" ? saved : "openai";
  });
  const [voices, setVoices] = useState<Record<Provider, string>>(() => ({
    openai: remembered(voiceKey("openai")) ?? "marin",
    gemini: remembered(voiceKey("gemini")) ?? "lila",
    vox: remembered(voiceKey("vox")) ?? "",
  }));
  const [vox, setVox] = useState<VoxVoice[] | null>(null);
  const [voxErr, setVoxErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const live = recorder.recording !== null;
  const language = item.script === "khmer" ? "km" : "en";
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  /** What is said: the creator's words, or the title. */
  const spoken = text.trim() || item.title.trim();

  // Another item opened, or undo changed the words: show the item's own.
  useEffect(() => setText(item.voiceText ?? ""), [item.id, item.voiceText]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void canUseAi().then((ok) => alive && setAi(ok));
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  // Vox's voices are fetched only when someone picks Vox: it is another service, and may be down.
  useEffect(() => {
    if (!open || provider !== "vox" || vox !== null) return;
    let alive = true;
    voxVoices()
      .then((got) => alive && setVox(got))
      .catch((e: unknown) => alive && setVoxErr((e instanceof Error && e.message) || t("traceStudio.voice.aiFailed")));
    return () => { alive = false; };
  }, [open, provider, vox, t]);
  const voxList = orderedFor(vox ?? [], language);
  const voice = provider === "vox" ? (voxList.some((v) => v.id === voices.vox) ? voices.vox : (voxList[0]?.id ?? "")) : voices[provider];

  const setProvider = (p: Provider) => {
    setProviderState(p);
    remember(PROVIDER_KEY, p);
  };
  const setVoice = (id: string) => {
    setVoices((v) => ({ ...v, [provider]: id }));
    remember(voiceKey(provider), id);
  };
  /** The words are kept only when they say more than the title. */
  const wordsToKeep = () => (text.trim() && text.trim() !== item.title.trim() ? text.trim() : undefined);
  const keep = async (audio: () => Promise<Blob>, kind: "save" | "ai") => {
    setBusy(kind);
    setErr("");
    try {
      onVoice((await uploadClip(await audio(), "trace/studio/audio")).id, wordsToKeep());
    } catch (e) {
      setErr((e instanceof Error && e.message) || t(kind === "ai" ? "traceStudio.voice.aiFailed" : "traceStudio.voice.failed"));
    } finally {
      setBusy("");
    }
  };
  const toggle = () => {
    if (live) return recorder.stop();
    setErr("");
    void recorder.start("item", (blob) => void keep(async () => asStandardAudio(blob), "save")).catch(() => setErr(t("studio.voice.micFailed")));
  };
  const askAi = () => void keep(() => aiVoice({ text: spoken, title: item.title.trim(), kind: item.kind, language, provider, voice }), "ai");

  const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";
  const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;

  return (
    <div ref={ref} className="relative">
      <IconButton size="sm" label={item.voice ? t("traceStudio.voice.recorded") : t("traceStudio.voice.title")} active={open || live} tip={open ? "none" : "bottom-end"} onClick={() => setOpen((o) => !o)}>
        <span className="relative">
          {live ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          {item.voice && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface" />}
        </span>
      </IconButton>
      {open && (
        <div
          role="dialog"
          aria-label={t("traceStudio.voice.title")}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex max-h-[80vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">{t("traceStudio.voice.title")}</p>
            <button type="button" aria-label={t("common.close")} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-ink" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{t("traceStudio.voice.text")}</span>
            <input
              className={inputCls}
              lang={language}
              value={text}
              maxLength={200}
              placeholder={item.title || t("traceStudio.voice.textPlaceholder")}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="text-xs text-muted">{t("traceStudio.voice.textNote")}</span>
          </label>

          <button
            type="button"
            className={`${btn} text-white ${live ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
            disabled={!canRecord || busy !== ""}
            onClick={toggle}
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : live ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            {!canRecord ? t("traceStudio.voice.noMic") : busy === "save" ? t("traceStudio.voice.saving") : live ? t("traceStudio.voice.stop") : t("traceStudio.voice.record")}
          </button>
          {live && spoken && (
            <p lang={language} className="rounded-xl bg-surface-muted px-3 py-2 text-center text-lg font-bold text-ink">
              {spoken}
            </p>
          )}

          {ai && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <span className="text-xs font-semibold text-muted">{t("traceStudio.voice.aiModel")}</span>
              <div role="radiogroup" aria-label={t("traceStudio.voice.aiModel")} className="grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={provider === p.id}
                    className={`min-h-9 rounded-lg text-sm font-semibold transition ${provider === p.id ? "bg-surface text-indigo-700 shadow-sm dark:text-indigo-300" : "text-muted hover:text-ink"}`}
                    onClick={() => setProvider(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <select aria-label={t("traceStudio.voice.aiVoice")} className={inputCls} value={voice} disabled={provider === "vox" && !voxList.length} onChange={(e) => setVoice(e.target.value)}>
                {provider === "openai" && OPENAI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.tone}</option>)}
                {provider === "gemini" && GEMINI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                {provider === "vox" &&
                  (vox === null && !voxErr ? <option value="">{t("traceStudio.voice.loadingVoices")}</option> : voxList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>))}
              </select>
              {provider === "vox" && voxErr && <p className="text-xs text-rose-600 dark:text-rose-300">{voxErr}</p>}
              <button type="button" className={quiet} disabled={busy !== "" || live || !spoken || !voice} onClick={askAi}>
                {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy === "ai" ? t("traceStudio.voice.making") : t("traceStudio.voice.ai")}
              </button>
            </div>
          )}

          {err && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
              {err}
            </p>
          )}

          {item.voice && !live && (
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <span className="min-w-0 flex-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">✓ {t("traceStudio.voice.recorded")}</span>
              <button type="button" className={quiet} disabled={busy !== ""} onClick={() => void say(item.voiceText ?? item.title, language, item.voice)}>
                <Volume2 className="h-4 w-4" />
                {t("common.play")}
              </button>
              <IconButton size="sm" tone="danger" tip="none" label={t("traceStudio.voice.remove")} disabled={busy !== ""} onClick={() => onVoice(undefined, undefined)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
