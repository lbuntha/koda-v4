/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BarChart3, Play, Pencil, Trash2 } from "lucide-react";
import { Button, Card } from "../components/ui";
import { Child } from "../api/family";
import { AVATAR_FALLBACK } from "./AvatarPicker";

interface Props {
  child: Child;
  onPlay: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onProgress: () => void;
}

export const KidCard: React.FC<Props> = ({ child, onPlay, onEdit, onRemove, onProgress }) => (
  <Card className="p-4 flex flex-col items-center gap-3 dark:border-white/10 dark:bg-[#171B2E]">
    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl dark:bg-white/5">
      {child.avatar ?? AVATAR_FALLBACK}
    </div>
    <div className="text-center">
      <div className="font-bold text-slate-800 leading-tight dark:text-[#E4E1F4]">{child.name}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-[#8B85A6]">
        {child.has_pin ? "PIN set" : "No PIN"}
      </div>
    </div>
    <Button size="sm" className="w-full" onClick={onPlay}>
      <Play size={14} /> Play
    </Button>
    <div className="flex flex-wrap justify-center gap-1">
      <Button variant="ghost" size="xs" onClick={onProgress} className="dark:text-[#A9A3C4] dark:hover:bg-white/10 dark:hover:text-white">
        <BarChart3 size={12} /> Progress
      </Button>
      <Button variant="ghost" size="xs" onClick={onEdit} className="dark:text-[#A9A3C4] dark:hover:bg-white/10 dark:hover:text-white">
        <Pencil size={12} /> Edit
      </Button>
      <Button variant="ghost" size="xs" onClick={onRemove} className="text-slate-500 hover:text-rose-600 dark:text-[#A9A3C4] dark:hover:bg-white/10 dark:hover:text-rose-400">
        <Trash2 size={12} /> Remove
      </Button>
    </div>
  </Card>
);
