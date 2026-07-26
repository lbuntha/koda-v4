/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The "+" square that sits in the profile grid alongside the kids. Same footprint as a kid
 * tile so the row keeps its rhythm, but outlined rather than filled — it is a setup action,
 * not a profile to switch into.
 */

import React from "react";
import { Plus } from "lucide-react";

export const AddProfileTile: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="flex w-28 flex-col items-center gap-2.5 sm:w-32 lg:w-36">
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a child profile"
      className="flex aspect-square w-full items-center justify-center rounded-[1.6rem] border-2 border-dashed border-slate-300 bg-white/50 text-slate-400 outline-none transition-colors hover:border-indigo-400 hover:bg-white hover:text-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/30 dark:border-white/15 dark:bg-white/5 dark:text-[#8B85A6] dark:hover:border-indigo-400/60 dark:hover:bg-white/10 dark:hover:text-indigo-300"
    >
      <Plus size={34} />
    </button>
    <p className="text-sm font-bold text-slate-500 dark:text-[#A9A3C4]">Add child</p>
  </div>
);
