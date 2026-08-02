import React from "react";
import { CloudOff } from "lucide-react";
import { Button, Dialog } from "../../components/ui";

interface Props {
  /** The activity the learner just finished, or null when there is nothing to report. */
  skillLabel: string | null;
  /** True once a retry has already failed, which makes "try again" a false promise. */
  retried: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Shown when a finished activity did not register as complete.
 *
 * The learner solved the puzzle — the save is what failed — so this credits the work
 * first and never uses red, "server", or "answer". A child reads a red "could not
 * verify your answer" as "you got it wrong", which is the opposite of what happened.
 *
 * After a retry has already failed, the cause is not transient (most often the activity's
 * technique has no server-side grader), so the dialog stops offering a retry that cannot
 * succeed and points somewhere useful instead.
 */
export const SaveIssueDialog: React.FC<Props> = ({ skillLabel, retried, onRetry, onDismiss }) => (
  <Dialog isOpen={skillLabel !== null} onClose={onDismiss}>
    {skillLabel && (
      <div className="py-3 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EEF0FF] text-[#6B57D8] dark:bg-violet-400/15 dark:text-[#B7A7FF]">
          <CloudOff size={29} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#6B57D8] dark:text-[#B7A7FF]">
          Not saved
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[#17152F] dark:text-[#E7E5F7]">
          {retried ? "Let’s come back to this one" : "We couldn’t save that one"}
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#716C8C] dark:text-[#9A94B8]">
          {retried ? (
            <>
              You solved <strong>{skillLabel}</strong> — that part was all you. Koda still can’t save
              it, so it will stay on your path until we fix it. Nothing you did was wrong.
            </>
          ) : (
            <>
              Nice work finishing <strong>{skillLabel}</strong>! Koda couldn’t save it just now, so it
              still shows as not done.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {!retried && (
            <Button className="w-full" onClick={onRetry}>
              Try again
            </Button>
          )}
          <Button variant={retried ? "default" : "ghost"} className="w-full" onClick={onDismiss}>
            {retried ? "Pick something else" : "Back to home"}
          </Button>
        </div>
      </div>
    )}
  </Dialog>
);
