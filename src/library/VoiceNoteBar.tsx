import { Check, Loader2, MicOff, RotateCcw, Send, Square, Trash2 } from "lucide-react";
import { clock, MAX_RECORDING_MS, type VoiceNoteRecorder } from "./voiceNotes";
import { useT } from "../lib/i18n";

/**
 * The reader's "read to my grown-ups" strip, under the toolbar.
 *
 * Only there once a child has tapped the microphone, and says one thing at a
 * time: recording (with the time and a Stop), listen back (with Send and Again),
 * sending, sent. Buttons are big and carry an icon as well as a word, for a
 * reader who is still learning the words. Recording goes on across page turns,
 * so a child can read a whole book into one message.
 */

const big = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-[background-color,transform] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50";

export function VoiceNoteBar({ voice }: { voice: VoiceNoteRecorder }) {
  const { t } = useT();
  const { stage } = voice;
  if (stage === "idle") return null;

  return (
    <div role="region" aria-label={t("reader.voice.region")} aria-live="polite" className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 dark:border-indigo-800 dark:bg-indigo-950/60">
      {stage === "asking" && (
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("reader.voice.asking")}
        </p>
      )}

      {stage === "recording" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative grid h-3 w-3 shrink-0 place-items-center" aria-hidden="true">
            <span className="absolute h-3 w-3 animate-ping rounded-full bg-rose-500/60 motion-reduce:animate-none" />
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">
              {t("reader.voice.recording")} <span className="font-mono tabular-nums">{clock(voice.elapsed)}</span>
            </p>
            <p className="text-xs text-muted">{t("reader.voice.recordingHint")}</p>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-indigo-200/70 dark:bg-indigo-900" aria-hidden="true">
              <span className="block h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, (voice.elapsed / MAX_RECORDING_MS) * 100)}%` }} />
            </span>
          </div>
          <button type="button" onClick={voice.stop} className={`${big} bg-rose-600 text-white hover:bg-rose-700`}>
            <Square className="h-4 w-4 fill-current" aria-hidden="true" /> {t("reader.voice.stop")}
          </button>
        </div>
      )}

      {(stage === "review" || stage === "sending" || stage === "failed") && (
        <div className="grid gap-2">
          <p className="text-sm font-bold text-ink">{t("reader.voice.listen", { time: clock(voice.elapsed) })}</p>
          {voice.url && <audio controls src={voice.url} className="h-10 w-full" aria-label={t("reader.voice.listenBack")} />}
          {stage === "failed" && <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t("reader.voice.failed")}{voice.error ? ` — ${voice.error}` : ""}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void voice.send()} disabled={stage === "sending"} className={`${big} flex-1 bg-indigo-600 text-white hover:bg-indigo-700 sm:flex-none`}>
              {stage === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {stage === "sending" ? t("reader.voice.sending") : stage === "failed" ? t("reader.voice.retry") : t("reader.voice.send")}
            </button>
            <button type="button" onClick={() => void voice.again()} disabled={stage === "sending"} className={`${big} bg-white text-ink hover:bg-indigo-100 dark:bg-slate-900 dark:hover:bg-slate-800`}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("reader.voice.again")}
            </button>
            <button type="button" onClick={voice.discard} disabled={stage === "sending"} aria-label={t("reader.voice.discard")} title={t("reader.voice.discard")} className={`${big} px-3 text-muted hover:bg-indigo-100 dark:hover:bg-slate-800`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {stage === "sent" && (
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <Check className="h-5 w-5" aria-hidden="true" /> {t("reader.voice.sent")}
        </p>
      )}

      {stage === "blocked" && (
        <div className="flex flex-wrap items-center gap-3">
          <MicOff className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-ink">{t("reader.voice.blocked")}</p>
          <button type="button" onClick={voice.dismiss} className={`${big} bg-white text-ink hover:bg-indigo-100 dark:bg-slate-900`}>{t("common.ok")}</button>
        </div>
      )}
    </div>
  );
}
