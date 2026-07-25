import React from "react";
import { CheckCircle2, CircleDashed, LoaderCircle } from "lucide-react";
import type { ActivityStatus } from "../../api/course";
import { Badge } from "../../components/ui";
import { cn } from "../../lib/utils";

/** Dark tones live here, not in the shared Badge, which admin screens also render. */
const DARK_TONE: Record<ActivityStatus, string> = {
  completed: "dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
  in_progress: "dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
  not_completed: "dark:border-white/15 dark:text-[#9A94B8]",
};

export const ActivityStatusBadge: React.FC<{
  status?: ActivityStatus;
  className?: string;
}> = ({ status = "not_completed", className }) => {
  if (status === "completed") {
    return (
      <Badge variant="success" className={cn(DARK_TONE.completed, className)}>
        <CheckCircle2 size={11} className="mr-1" /> Completed
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge variant="warning" className={cn(DARK_TONE.in_progress, className)}>
        <LoaderCircle size={11} className="mr-1" /> In progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(DARK_TONE.not_completed, className)}>
      <CircleDashed size={11} className="mr-1" /> Not completed
    </Badge>
  );
};
