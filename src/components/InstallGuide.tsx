import React from "react";
import { ArrowDown, ArrowUp, Check, Ellipsis, EllipsisVertical, Menu, Share, SquarePlus, X } from "lucide-react";
import { UIButton } from "./ui";
import { useT } from "../lib/i18n";
import {
  closeInstallHelp,
  installHelp,
  installKind,
  shareSpot,
  startInstall,
  useInstallState,
  type InstallKind,
  type ShareSpot,
} from "../lib/install";

type Step = { icon: React.ReactNode; text: string };
type Arrow = "bottom" | "bottom-right" | "top-right";

/**
 * The steps for a browser our button cannot install from, drawn over the page
 * with an arrow at the browser's own button. Android's one-tap install never
 * reaches here; the browser's install box covers it.
 *
 * Not a UIModal: on a phone that is a bottom sheet, and Safari's Share button
 * is exactly what the arrow has to point at below it.
 */
export const InstallGuide: React.FC = () => {
  useInstallState();
  const { t } = useT();
  const kind = installHelp();
  React.useEffect(() => {
    if (!kind) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeInstallHelp();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind]);
  if (!kind) return null;

  const { steps, arrow, preview } = guideFor(kind, kind === "ios" ? shareSpot() : null, t);
  const ArrowIcon = arrow.startsWith("top") ? ArrowUp : ArrowDown;
  const arrowPlace =
    arrow === "bottom"
      ? "bottom-2 left-1/2 -translate-x-1/2"
      : arrow === "bottom-right"
        ? "bottom-2 right-3"
        : "top-2 right-3";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={closeInstallHelp}
      role="dialog"
      aria-modal="true"
      aria-label={t("install.title")}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-line/50"
          onClick={closeInstallHelp}
          aria-label={t("install.gotIt")}
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-8 text-lg font-bold text-ink">{t("install.title")}</h2>
        <p className="mt-1 text-sm text-body">{kind === "in-app" ? t("install.inAppIntro") : t("install.intro")}</p>
        <ol className="mt-4 space-y-2.5">
          {steps.map((step, index) => (
            <li key={index} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 [&>svg]:h-5 [&>svg]:w-5">
                {step.icon}
              </span>
              <span className="text-sm font-medium text-ink">{step.text}</span>
            </li>
          ))}
        </ol>
        {preview && <SharePreview label={t("install.lookFor")} item={t("install.homeScreenItem")} />}
        <UIButton variant="primary" className="mt-5 w-full" onClick={closeInstallHelp}>
          {t("install.gotIt")}
        </UIButton>
      </div>
      <div className={`pointer-events-none fixed ${arrowPlace} flex flex-col items-center gap-1`}>
        {arrow.startsWith("top") && <ArrowIcon className="h-10 w-10 animate-bounce text-white drop-shadow" strokeWidth={3} />}
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow">{t("install.tapHere")}</span>
        {!arrow.startsWith("top") && <ArrowIcon className="h-10 w-10 animate-bounce text-white drop-shadow" strokeWidth={3} />}
      </div>
    </div>
  );
};

/** A sketch of the Share menu, with the row to find lit up. */
const SharePreview: React.FC<{ label: string; item: string }> = ({ label, item }) => (
  <div className="mt-4">
    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas" aria-hidden="true">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <span className="h-2.5 rounded-full bg-line" style={{ width: row ? "40%" : "55%" }} />
          <span className="h-4 w-4 rounded bg-line" />
        </div>
      ))}
      <div className="flex items-center justify-between bg-indigo-50 px-3 py-2.5 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-500/15">
        <span className="text-sm font-bold text-ink">{item}</span>
        <SquarePlus className="h-4 w-4 text-ink" />
      </div>
    </div>
  </div>
);

function guideFor(
  kind: InstallKind,
  spot: ShareSpot | null,
  t: (key: string) => string,
): { steps: Step[]; arrow: Arrow; preview: boolean } {
  const add: Step = { icon: <SquarePlus />, text: t("install.addToHome") };
  const confirm: Step = { icon: <Check />, text: t("install.confirmAdd") };
  if (kind === "ios") {
    switch (spot) {
      case "more":
        return {
          arrow: "bottom-right",
          preview: true,
          steps: [{ icon: <Ellipsis />, text: t("install.moreButton") }, { icon: <Share />, text: t("install.shareInMenu") }, add, confirm],
        };
      case "menu":
        return {
          arrow: "bottom-right",
          preview: true,
          steps: [{ icon: <Menu />, text: t("install.menuButton") }, { icon: <Share />, text: t("install.shareInMenu") }, add, confirm],
        };
      case "top":
        return {
          arrow: "top-right",
          preview: true,
          steps: [{ icon: <Share />, text: t(/CriOS/.test(navigator.userAgent) ? "install.shareChrome" : "install.shareTop") }, add, confirm],
        };
      default:
        return { arrow: "bottom", preview: true, steps: [{ icon: <Share />, text: t("install.shareBottom") }, add, confirm] };
    }
  }
  if (kind === "in-app") {
    return {
      arrow: "top-right",
      preview: false,
      steps: [
        { icon: <Ellipsis />, text: t("install.inAppStep1") },
        { icon: <SquarePlus />, text: t("install.inAppStep2") },
      ],
    };
  }
  return {
    arrow: "top-right",
    preview: false,
    steps: [
      { icon: <EllipsisVertical />, text: t("install.manualStep1") },
      { icon: <SquarePlus />, text: t("install.manualStep2") },
    ],
  };
}

const NUDGE_KEY = "koda_install_nudge_v1";

function nudgeDismissed(): boolean {
  try {
    return localStorage.getItem(NUDGE_KEY) === "1";
  } catch {
    return true;
  }
}

function dismissNudge(): void {
  try {
    localStorage.setItem(NUDGE_KEY, "1");
  } catch {
    // Private mode: it simply shows again next visit.
  }
}

/**
 * Once per phone: a small card at the top offering "Add to home screen", so a
 * parent finds it without opening the menu. Android gets the one-tap install,
 * iPhone the guide. Gone for good after either button.
 */
export const InstallNudge: React.FC = () => {
  useInstallState();
  const { t } = useT();
  const [ready, setReady] = React.useState(false);
  const [gone, setGone] = React.useState(nudgeDismissed);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  const kind = installKind();
  const phone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  if (!ready || gone || !phone || (kind !== "prompt" && kind !== "ios") || installHelp()) return null;

  const close = () => {
    dismissNudge();
    setGone(true);
  };
  return (
    <div
      className="fixed inset-x-3 top-3 z-[61] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lg"
      style={{ marginTop: "env(safe-area-inset-top)" }}
      role="status"
    >
      <img src="/icons/icon-64.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{t("install.nudgeTitle")}</p>
        <p className="text-xs text-body">{t("install.nudgeBody")}</p>
      </div>
      <UIButton
        variant="primary"
        size="sm"
        onClick={() => {
          close();
          void startInstall();
        }}
      >
        {t("install.nudgeAdd")}
      </UIButton>
      <button className="rounded-full p-1 text-muted hover:bg-line/50" onClick={close} aria-label={t("install.nudgeLater")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
