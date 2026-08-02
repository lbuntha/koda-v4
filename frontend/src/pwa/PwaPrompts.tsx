/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The three things an installed Koda has to say for itself, as one small overlay mounted
 * once at the app root:
 *
 *   • a new version is waiting  → offer a reload, never take one
 *   • the device went offline   → say so, because saving will fail quietly otherwise
 *   • the app can be installed  → offer it (see useInstallPrompt for the timing rules)
 *
 * These render outside the role screens, so they carry their own `dark` class from the
 * shared theme state rather than inheriting one from a page root.
 */

import React, { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { CloudOff, Download, RefreshCw, X } from "lucide-react";
import { Button } from "../components/ui";
import { useThemeMode } from "../theme/appTheme";
import { useInstallPrompt } from "./useInstallPrompt";

/** A long-lived tab would otherwise never notice a deploy. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
};

const Toast: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/95 dark:shadow-black/40">
    {children}
  </div>
);

export const PwaPrompts: React.FC = () => {
  const [mode] = useThemeMode();
  const online = useOnlineStatus();
  const installPrompt = useInstallPrompt();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        // Only worth asking when there is a network to ask over.
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  const [updating, setUpdating] = useState(false);
  const showInstall = installPrompt.canShow && !needRefresh;

  if (!needRefresh && online && !showInstall) return null;

  return (
    <div
      className={mode === "dark" ? "dark" : undefined}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-slate-700 dark:text-slate-200">
        {!online && (
          <Toast>
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-xs leading-relaxed">
              <span className="font-semibold">You're offline.</span>{" "}
              Koda keeps working, and new progress saves once you're back.
            </p>
          </Toast>
        )}

        {needRefresh && (
          <Toast>
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">A new version of Koda is ready.</span>{" "}
                Reload when you finish what you're doing.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="xs"
                  loading={updating}
                  onClick={() => {
                    setUpdating(true);
                    // Activates the waiting worker, which reloads the page.
                    void updateServiceWorker(true);
                  }}
                >
                  Reload
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setNeedRefresh(false)}>
                  Later
                </Button>
              </div>
            </div>
          </Toast>
        )}

        {showInstall && (
          <Toast>
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">Add Koda to your home screen</span>{" "}
                for full-screen play that opens in one tap.
              </p>
              {installPrompt.needsManualIosSteps ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Tap the Share button, then <span className="font-semibold">Add to Home Screen</span>.
                </p>
              ) : (
                <div className="mt-2">
                  <Button size="xs" onClick={() => void installPrompt.install()}>
                    Install
                  </Button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={installPrompt.dismiss}
              aria-label="Dismiss install suggestion"
              className="-m-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </Toast>
        )}
      </div>
    </div>
  );
};
