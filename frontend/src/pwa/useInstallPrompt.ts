/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Install-to-home-screen state for the Koda PWA.
 *
 * Chromium fires `beforeinstallprompt` and hands us a deferred prompt we can replay from a
 * button. iOS Safari never fires it — installing there is a manual Share → "Add to Home
 * Screen" — so the hook reports that case separately and the UI shows instructions instead.
 *
 * Nothing is offered on the first visit: a household that opens Koda once does not want a
 * banner, and a dismissal is remembered for a month so the ask never becomes nagging.
 */

import { useCallback, useEffect, useState } from "react";

const VISITS_KEY = "koda_pwa_visits";
const DISMISSED_UNTIL_KEY = "koda_pwa_install_dismissed_until";
const VISITS_BEFORE_ASKING = 2;
const DISMISS_DAYS = 30;

/** The Chromium-only event; not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const readNumber = (key: string): number => {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0; // Private browsing or a blocked store: behave as a first visit.
  }
};

const writeNumber = (key: string, value: number): void => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // The prompt simply reappears next session; not worth surfacing.
  }
};

/** True once the app is launched from the home screen, where an install ask is pointless. */
export const isStandalone = (): boolean =>
  typeof window !== "undefined"
  && (window.matchMedia?.("(display-mode: standalone)").matches
    || (window.navigator as any).standalone === true);

const isIosSafari = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
  // Chrome and Firefox on iOS cannot install at all, so only Safari gets the hint.
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export interface InstallPromptState {
  /** Show the banner: the browser can install, or iOS can be told how. */
  canShow: boolean;
  /** iOS gets instructions rather than a working button. */
  needsManualIosSteps: boolean;
  /** Runs the native install dialog. Resolves once the user has chosen. */
  install: () => Promise<void>;
  /** Hide the banner and stay quiet for a month. */
  dismiss: () => void;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const visits = readNumber(VISITS_KEY) + 1;
    writeNumber(VISITS_KEY, visits);
    const quietUntil = readNumber(DISMISSED_UNTIL_KEY);
    const welcome = visits >= VISITS_BEFORE_ASKING && Date.now() >= quietUntil;

    const onBeforeInstallPrompt = (event: Event) => {
      // Keep the browser's own mini-infobar from firing so the ask happens once, in our UI.
      event.preventDefault();
      if (welcome) setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (welcome && isIosSafari()) setIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // A deferred prompt is single-use whichever way the user answered.
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeNumber(DISMISSED_UNTIL_KEY, Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000);
  }, []);

  return {
    canShow: !dismissed && (deferred !== null || iosHint),
    needsManualIosSteps: deferred === null && iosHint,
    install,
    dismiss,
  };
}
