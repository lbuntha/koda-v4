/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Grid of the available menu icons. The selected name is stored on the menu.
 */

import React from "react";
import { ICON_NAMES, resolveIcon } from "./icons";

export const IconPicker: React.FC<{ value: string; onChange: (name: string) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-7 gap-1.5">
    {ICON_NAMES.map((name) => {
      const Icon = resolveIcon(name);
      const active = value === name;
      return (
        <button
          key={name}
          type="button"
          title={name}
          onClick={() => onChange(name)}
          className={`aspect-square rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            active ? "bg-indigo-100 ring-2 ring-indigo-500 text-indigo-600" : "bg-slate-50 hover:bg-slate-100 text-slate-500"
          }`}
        >
          <Icon size={16} />
        </button>
      );
    })}
  </div>
);
