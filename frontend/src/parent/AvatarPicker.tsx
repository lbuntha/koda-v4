/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export const AVATARS = ["🦊", "🐼", "🐯", "🦄", "🐸", "🐵", "🐙", "🦁", "🐧", "🐨", "🐰", "🐮", "🐷", "🐳", "🦉", "🐝"];
export const AVATAR_FALLBACK = "🧒";

export const AvatarPicker: React.FC<{ value: string | null; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {AVATARS.map((a) => (
      <button
        key={a}
        type="button"
        onClick={() => onChange(a)}
        className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-all cursor-pointer ${
          value === a ? "bg-indigo-100 ring-2 ring-indigo-500" : "bg-slate-50 hover:bg-slate-100"
        }`}
      >
        {a}
      </button>
    ))}
  </div>
);
