/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { KidAvatar } from "./KidAvatar";

export const AVATARS = ["🦊", "🐼", "🐯", "🦄", "🐸", "🐵", "🐙", "🦁", "🐧", "🐨", "🐰", "🐮", "🐷", "🐳", "🦉", "🐝"];
export const AVATAR_FALLBACK = "🧒";

export const AvatarPicker: React.FC<{ value: string | null; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {AVATARS.map((a) => (
      <button
        key={a}
        type="button"
        onClick={() => onChange(a)}
        aria-label={`Avatar ${a}`}
        className={`aspect-square rounded-xl p-1.5 text-xl flex items-center justify-center transition-all cursor-pointer ${
          value === a
            ? "bg-indigo-500 ring-2 ring-indigo-500 dark:bg-indigo-500 dark:ring-indigo-400"
            : "bg-slate-200/70 hover:bg-slate-300/70 dark:bg-white/10 dark:hover:bg-white/15"
        }`}
      >
        <KidAvatar avatar={a} className="h-full w-full" />
      </button>
    ))}
  </div>
);
