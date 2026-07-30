/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One kid in the profile chooser. Tapping the tile starts a play session as that child —
 * the whole square is the target, so a young child does not have to hit a small button.
 * Management (progress, edit, remove) stays out of the way until the parent turns it on,
 * which keeps the normal state as calm as the switch-profile screens kids already know.
 */

import React from "react";
import { BarChart3, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { Button } from "../components/ui";
import { Child } from "../api/family";
import { KidAvatar } from "../components/KidAvatar";
import { PROFILE_TONE_CLASS, profileToneFor } from "./profileTone";

interface Props {
  child: Child;
  managing: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onProgress: () => void;
  /** Clears a PIN lockout. Absent means the caller doesn't support unlocking. */
  onUnlockPin?: () => void;
}

export const KidProfileTile: React.FC<Props> = ({
  child,
  managing,
  onPlay,
  onEdit,
  onRemove,
  onProgress,
  onUnlockPin,
}) => {
  const tone = PROFILE_TONE_CLASS[profileToneFor(child.id)];
  // A lock the parent can't see makes a locked child look like a broken app. Recomputed on
  // render rather than stored, so an expired lock stops showing without a refetch.
  const pinLocked = Boolean(
    child.pin_locked_until && new Date(child.pin_locked_until).getTime() > Date.now(),
  );
  return (
    <div className="flex w-28 flex-col items-center gap-2.5 sm:w-32 lg:w-36">
      <button
        type="button"
        onClick={managing ? onEdit : onPlay}
        aria-label={`${managing ? "Edit" : "Play as"} ${child.name}${child.has_pin ? ", PIN protected" : ""}`}
        className={`group relative aspect-square w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-br shadow-lg outline-none transition-transform hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:translate-y-0 ${tone}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[image:radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35)_0%,transparent_62%)]"
        />
        <KidAvatar
          avatar={child.avatar}
          className="relative mx-auto flex h-[68%] w-[68%] translate-y-[16%] items-center justify-center text-5xl drop-shadow-sm sm:text-6xl"
        />
        {child.has_pin && !managing && (
          <span
            aria-hidden
            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white backdrop-blur-[2px] ${pinLocked ? "bg-rose-500/90" : "bg-black/25"}`}
          >
            <Lock size={12} />
          </span>
        )}
        {managing && (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-black/45 text-white backdrop-blur-[1px]"
          >
            <Pencil size={26} />
          </span>
        )}
      </button>

      <div className="text-center">
        <p className="w-full truncate text-sm font-bold text-slate-700 dark:text-[#DEDCF0]">
          {child.name}
        </p>
        <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold capitalize text-indigo-600 dark:bg-white/10 dark:text-[#CDBEFF]">
          {(child.grade_level || "grade_1").replace("_", " ")}
        </span>
        {managing && (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8B85A6]">
            {child.has_pin ? "PIN protected" : "No PIN"}
          </p>
        )}
        {pinLocked && (
          <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold leading-tight text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
            Locked after too many wrong PINs
          </p>
        )}
      </div>

      {/* Offered outside `managing`: a locked-out child is a problem to solve now, not one
          that should require finding a management toggle first. */}
      {pinLocked && onUnlockPin && (
        <Button variant="outline" size="xs" onClick={onUnlockPin} className="border-rose-200 text-rose-700 dark:border-rose-400/30 dark:text-rose-200">
          <LockOpen size={12} /> Unlock
        </Button>
      )}

      {managing && (
        <div className="flex flex-wrap justify-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={onProgress}
            className="dark:text-[#A9A3C4] dark:hover:bg-white/10 dark:hover:text-white"
          >
            <BarChart3 size={12} /> Progress
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onRemove}
            className="text-slate-500 hover:text-rose-600 dark:text-[#A9A3C4] dark:hover:bg-white/10 dark:hover:text-rose-400"
          >
            <Trash2 size={12} /> Remove
          </Button>
        </div>
      )}
    </div>
  );
};
