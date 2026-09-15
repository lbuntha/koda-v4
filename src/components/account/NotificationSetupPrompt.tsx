import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIModal } from "../ui";
import { useSession } from "../../lib/sync";
import { notificationsAreOn, pushSupport } from "../../lib/push";
import { shouldOfferNotificationSetup, skipNotificationSetup } from "../../lib/push/setupPrompt";

/**
 * "Turn on notifications?" — asked once per launch, for an adult who has not.
 *
 * Set up goes to the switch in Settings rather than raising the browser's
 * permission prompt here: that prompt is the one a parent should meet beside
 * the sentence explaining it. Skip, Escape, the close button or a tap outside
 * keeps it away for `SKIP_DAYS` on this device.
 *
 * The shared sheet — a bottom sheet on a phone, a centred card from `rail:` up
 * — in its plain tone and with no backdrop, so it matches Profile and
 * Achievements without dimming the app for what is only a suggestion.
 *
 * Waits a moment after load, because the stored session is verified on boot
 * and a sheet that appears and then vanishes with a rejected session is worse
 * than one that arrives a second late. Never over a running lesson.
 */
export const NotificationSetupPrompt: React.FC<{
  onSetUp: () => void;
  suppressed?: boolean;
  delayMs?: number;
}> = ({ onSetUp, suppressed = false, delayMs = 1200 }) => {
  const session = useSession();
  const userId = session?.userId ?? null;
  const [open, setOpen] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  /** The account already considered this launch, so it is asked at most once. */
  const [considered, setConsidered] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !userId || suppressed || considered === userId) return;
    const timer = setTimeout(() => {
      const support = pushSupport();
      if (shouldOfferNotificationSetup(session, support, notificationsAreOn())) {
        setNeedsInstall(support.state === "needs-install");
        setOpen(true);
      }
      setConsidered(userId);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [session, userId, suppressed, considered, delayMs]);

  const skip = () => {
    if (userId) skipNotificationSetup(userId);
    setOpen(false);
  };

  const setUp = () => {
    setOpen(false);
    onSetUp();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <UIModal
      isOpen={open}
      onClose={skip}
      title="Turn on notifications?"
      tone="plain"
      backdrop="none"
      maxWidth="max-w-md"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/15">
          <BellRing className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <p className="pt-1 text-sm text-muted">
          {needsInstall
            ? "Add Koda to your Home Screen first to get updates on this device."
            : "Get news and updates from Koda on this device."}
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={setUp}
          className={themeSystem.button("primary", "md", "w-full justify-center")}
        >
          Set up
        </button>
        <button
          type="button"
          onClick={skip}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-muted hover:text-ink transition-colors cursor-pointer"
        >
          Skip
        </button>
      </div>
    </UIModal>
  );
};
