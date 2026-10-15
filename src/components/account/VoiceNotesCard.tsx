import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Mic, Pause, Play, Trash2 } from "lucide-react";
import { clock, deleteVoiceNote, listVoiceNotes, markVoiceNoteHeard, voiceNoteUrl, type VoiceNote } from "../../library/voiceNotes";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UISectionHeader } from "../ui";
import { formatDate, useT } from "../../lib/i18n";

/**
 * The child's voice messages, at the top of their report: a book they read
 * aloud and sent. Newest first, unheard ones marked, one tap to play.
 *
 * Absent until there is one, so a child who has never recorded does not leave
 * an empty box on the page. Playing a message marks it heard for every grown-up
 * in the family. Deleting asks once, inline — no browser dialog.
 */
export const VoiceNotesCard: React.FC<{ learnerId: string; learnerName: string }> = ({ learnerId, learnerName }) => {
  const { t } = useT();
  const [notes, setNotes] = useState<VoiceNote[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, string>());

  useEffect(() => {
    let live = true;
    listVoiceNotes(learnerId).then((r) => live && setNotes(r.notes)).catch(() => live && setNotes([]));
    const cache = urls.current;
    return () => {
      live = false;
      player.current?.pause();
      cache.forEach((u) => URL.revokeObjectURL(u));
      cache.clear();
    };
  }, [learnerId]);

  const play = async (note: VoiceNote) => {
    setError("");
    if (playing === note.id) {
      player.current?.pause();
      setPlaying(null);
      return;
    }
    player.current?.pause();
    try {
      let url = urls.current.get(note.id);
      if (!url) {
        setLoadingId(note.id);
        url = await voiceNoteUrl(note.id);
        urls.current.set(note.id, url);
      }
      const audio = player.current ?? new Audio();
      player.current = audio;
      audio.src = url;
      audio.onended = () => setPlaying(null);
      await audio.play();
      setPlaying(note.id);
      if (!note.heard) {
        setNotes((list) => list?.map((n) => (n.id === note.id ? { ...n, heard: true } : n)) ?? list);
        void markVoiceNoteHeard(note.id).catch(() => {});
      }
    } catch {
      setError(t("report.voice.playFailed"));
    } finally {
      setLoadingId(null);
    }
  };

  const remove = async (id: string) => {
    setConfirm(null);
    if (playing === id) {
      player.current?.pause();
      setPlaying(null);
    }
    try {
      await deleteVoiceNote(id);
      setNotes((list) => list?.filter((n) => n.id !== id) ?? list);
    } catch {
      setError(t("report.voice.deleteFailed"));
    }
  };

  if (!notes?.length) return null;
  const unheard = notes.filter((n) => !n.heard).length;
  const pagesOf = (p: number[]) =>
    !p.length ? "" : p.length === 1 ? t("report.voice.page", { n: p[0] }) : t("report.voice.pages", { from: p[0], to: p[p.length - 1] });

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-3 border-indigo-200 dark:border-indigo-500/40`)}>
      <UISectionHeader
        title={t("report.voice.title")}
        subtitle={t("report.voice.note", { name: learnerName })}
        icon={<Mic className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        action={unheard > 0 ? <UIBadge variant="primary">{t("report.voice.new", { count: unheard })}</UIBadge> : undefined}
      />
      {error && <p className={themeSystem.flash("error")}>{error}</p>}
      <ul className="divide-y divide-line">
        {notes.map((note) => {
          const isPlaying = playing === note.id;
          return (
            <li key={note.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => void play(note)}
                aria-label={isPlaying ? t("report.voice.pause", { book: note.bookTitle }) : t("report.voice.play", { book: note.bookTitle })}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${isPlaying ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200"}`}
              >
                {loadingId === note.id ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-px" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-bold text-ink">
                  <BookOpen className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate">{note.bookTitle}</span>
                  {!note.heard && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label={t("report.voice.unheard")} />}
                </p>
                <p className="text-xs text-muted">
                  {[formatDate(note.createdAt, { dateStyle: "medium", timeStyle: "short" }), clock(note.durationMs), pagesOf(note.pages)].filter(Boolean).join(" · ")}
                </p>
              </div>
              {confirm === note.id ? (
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => void remove(note.id)} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950">{t("report.voice.delete")}</button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-surface-muted">{t("common.cancel")}</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(note.id)} aria-label={t("report.voice.deleteOne", { book: note.bookTitle })} title={t("report.voice.delete")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
