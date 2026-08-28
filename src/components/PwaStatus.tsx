import React, { useEffect, useState } from "react";
import { CloudOff, Download, UploadCloud, X } from "lucide-react";
import { themeSystem } from "../lib/themeSystem";
import { useOnlineStatus, useServiceWorker } from "../pwa/useServiceWorker";
import { useSyncStatus } from "../lib/sync";

/**
 * The two things a child or parent needs told about the app itself.
 *
 * Kept to a corner and worded for a five-year-old where they will read it. Note
 * what is *not* here: going offline is not an error state in this app, so it is
 * a quiet note rather than a banner that blocks anything. Counting works with no
 * network at all — only the AI tutor and spoken prompts from the server need
 * one, and both already fall back on their own.
 */
export const PwaStatus: React.FC = () => {
  const online = useOnlineStatus();
  const sync = useSyncStatus();
  const { updateReady, offlineReady, applyUpdate, dismiss } = useServiceWorker();
  const [showOfflineReady, setShowOfflineReady] = useState(false);
  /**
   * The offline notice shrinks to an icon after a few seconds.
   *
   * It is ambient, persistent information — everything a child does here works
   * without a network — but a bar pinned across the bottom sits exactly where
   * the answer feedback appears, and covering "Great counting!" to say the wifi
   * is off gets the priorities backwards.
   */
  const [offlineCollapsed, setOfflineCollapsed] = useState(false);

  /**
   * "Saving your work…" only when saving is actually slow.
   *
   * The outbox is non-empty for a moment after every single answer, so this pill
   * used to sit in the corner for the whole of a lesson — permanent status with
   * nothing to act on, parked next to the activity it was competing with. It is
   * reassurance, and reassurance is only worth showing once there is something
   * to be reassured about.
   */
  const [savingIsSlow, setSavingIsSlow] = useState(false);

  useEffect(() => {
    if (sync.pending === 0) {
      setSavingIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setSavingIsSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [sync.pending]);

  useEffect(() => {
    if (online) {
      setOfflineCollapsed(false);
      return;
    }
    const timer = setTimeout(() => setOfflineCollapsed(true), 5000);
    return () => clearTimeout(timer);
  }, [online]);

  useEffect(() => {
    if (!offlineReady) return;
    setShowOfflineReady(true);
    // Said once, briefly. A permanent "ready offline" badge is noise after the
    // first time anyone reads it.
    const timer = setTimeout(() => setShowOfflineReady(false), 6000);
    return () => clearTimeout(timer);
  }, [offlineReady]);

  /**
   * Work waiting to reach the server.
   *
   * Only shown once it is enough to be worth a sentence, and never while
   * offline — the offline pill already says everything a person needs, and two
   * notices about the same fact is one too many.
   *
   * And only while sending is actually happening. A queue that is refused (a
   * staff account with no family to write into) or signed out is not being
   * saved, and a pill that says it is stays on screen for the rest of the
   * session telling a comforting lie — which is how this one was found.
   *
   * And only once it has been slow for a few seconds. A round queues events on
   * every answer, so the count crosses the threshold routinely and the pill sat
   * in the corner for whole lessons — status nobody can act on, parked beside
   * the activity it was competing with.
   */
  const stalled = sync.state === "refused" || sync.state === "signed-out";
  const waiting = online && !stalled && sync.pending > 20 && savingIsSlow ? sync.pending : 0;

  const anything = !online || updateReady || showOfflineReady || waiting > 0;
  if (!anything) return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-[60] flex flex-col items-end gap-2 max-w-[calc(100vw-1.5rem)] sm:max-w-sm pointer-events-none [&>*]:pointer-events-auto"
      // Announced, not interrupting: a child mid-question should not have focus
      // yanked because the wifi dropped.
      role="status"
      aria-live="polite"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {!online && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl border-2 border-amber-800/30 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/90 shadow-sm transition-all ${
            offlineCollapsed ? "p-2.5" : "px-4 py-2.5"
          }`}
          // The full sentence stays available to a screen reader and on hover
          // even once the pill has shrunk to its icon.
          title="No internet — you can still play!"
          aria-label="No internet — you can still play!"
        >
          <CloudOff className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0" />
          {!offlineCollapsed && (
            <p className="text-xs font-bold text-slate-800 dark:text-amber-100 whitespace-nowrap">
              No internet — you can still play!
            </p>
          )}
        </div>
      )}

      {waiting > 0 && (
        <div
          className="flex items-center gap-2.5 rounded-2xl border-2 border-line bg-surface px-4 py-2.5 shadow-sm"
          title={`${waiting} things still to save`}
        >
          <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <p className="text-xs font-bold text-ink whitespace-nowrap">Saving your work…</p>
        </div>
      )}

      {updateReady && (
        <div className="flex items-center gap-2.5 rounded-2xl border-2 border-line bg-surface px-4 py-2.5 shadow-sm">
          <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <p className="text-xs font-bold text-ink flex-1">A new version is ready.</p>
          <button onClick={applyUpdate} className={themeSystem.button("primary", "sm")}>
            Update
          </button>
          <button
            onClick={dismiss}
            aria-label="Not now"
            className="p-1 rounded-lg text-muted hover:text-ink cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showOfflineReady && online && !updateReady && (
        <div className="flex items-center gap-2.5 rounded-2xl border-2 border-line bg-surface px-4 py-2.5 shadow-sm">
          <p className="text-xs font-bold text-ink">Ready to play without internet.</p>
        </div>
      )}
    </div>
  );
};
