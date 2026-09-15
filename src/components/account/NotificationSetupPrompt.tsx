import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIModal } from "../ui";
import { useSession } from "../../lib/sync";
import { notificationsAreOn, pushSupport } from "../../lib/push";
import {
  SKIP_DAYS,
  shouldOfferNotificationSetup,
  skipNotificationSetup,
} from "../../lib/push/setupPrompt";

/**
 * "Turn on notifications?" — asked once per launch, for an adult who has not.
 *
 * Set up goes to the switch in Settings rather than raising the browser's
 * permission prompt here: that prompt is the one a parent should meet beside
 * the sentence explaining it. Skip, or closing the sheet, keeps it away for
 * `SKIP_DAYS` on this device.
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

  return (
    <UIModal
      isOpen={open}
      onClose={skip}
      title="Turn on notifications?"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" onClick={skip} className={themeSystem.button("secondary", "sm")}>
            Skip
          </button>
          <button type="button" onClick={setUp} className={themeSystem.button("primary", "sm")}>
            Set up
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <BellRing className="w-6 h-6 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="space-y-2 text-sm text-body">
          <p>
            Koda can tell you about announcements, new skills and how your child is getting on, right
            on this device.
          </p>
          <p>
            {needsInstall
              ? "On an iPhone or iPad, Koda needs to be on your Home Screen first — Set up shows you how."
              : "Set up takes you to Settings, where you can turn them on."}
          </p>
          <p className="text-xs text-muted">Skip, and Koda will ask again in {SKIP_DAYS} days.</p>
        </div>
      </div>
    </UIModal>
  );
};
