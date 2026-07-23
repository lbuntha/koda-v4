/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shown for a menu that's registered/assigned but has no screen mapped yet.
 */

import React from "react";
import { Construction } from "lucide-react";
import { Card } from "./ui";

export const ContentPlaceholder: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <Card className="p-12 flex flex-col items-center text-center gap-3">
    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
      <Construction size={24} />
    </div>
    <div>
      <p className="font-bold text-slate-700">“{label}” has no screen yet</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  </Card>
);
