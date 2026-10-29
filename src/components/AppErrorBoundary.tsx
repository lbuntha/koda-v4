import React from "react";
import { RotateCcw } from "lucide-react";

import { themeSystem } from "../lib/themeSystem";
import { translate } from "../lib/i18n";

/**
 * Keeps one failed screen from becoming a dead phone.
 *
 * `React.lazy` pages are fetched when opened. On a phone that drops its signal,
 * or one still holding a page from before a deploy, that fetch rejects — and a
 * rejected lazy import is a render error. With nothing to catch it React
 * unmounts the whole app, which a child sees as the app being stuck on a blank
 * or spinning screen with only the tab switcher as a way out.
 *
 * A chunk that would not load usually will on a second go, so the first
 * failure reloads the page by itself (once — the guard stops a loop on a
 * network that is simply gone). Anything else gets a plain sentence and a
 * button, the same wording a crashed activity uses.
 */

const RELOADED_AT = "koda_chunk_reload_at";
/** A reload within this window of the last one is not tried again. */
const RELOAD_COOLDOWN_MS = 30_000;

/** Whether an error is a code-split chunk that failed to arrive. */
export function isChunkLoadError(error: unknown): boolean {
  const text = `${(error as Error | undefined)?.name ?? ""} ${(error as Error | undefined)?.message ?? ""}`;
  return /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk|Unable to preload CSS/i.test(text);
}

/** Reload once for a chunk that failed; false when one was already tried a moment ago. */
export function reloadForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    // No session storage: reloading blind could loop, so show the button instead.
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite fires this when a preloaded chunk or its CSS fails; recover the same way. */
export function installChunkRecovery(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForChunkError()) event.preventDefault();
  });
}

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[app] screen crashed", error, info.componentStack);
    if (isChunkLoadError(error)) reloadForChunkError();
  }

  private retry = () => {
    // A rejected lazy import stays rejected until the module graph is rebuilt.
    if (this.state.error && isChunkLoadError(this.state.error)) window.location.reload();
    else this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-muted text-3xl">🧩</div>
          <h2 className="text-xl font-extrabold text-ink">{translate("round.crash.title")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{translate("round.crash.body")}</p>
          <div className="mt-5">
            <button onClick={this.retry} className={themeSystem.button("primary", "lg", "w-full")}>
              <RotateCcw />
              {translate("studio.tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
