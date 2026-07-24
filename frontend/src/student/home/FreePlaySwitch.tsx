import React from "react";
import { ArrowLeft, Shuffle } from "lucide-react";
import type { CourseMode } from "../../api/course";
import { Button } from "../../components/ui";

interface Props {
  mode: CourseMode;
  loading: boolean;
  onModeChange: (mode: CourseMode) => void;
}

/**
 * Plan-by-default mode control (replaces the segmented toggle): the plan is the
 * default, "Free play" is a secondary action, and free mode offers a way back.
 */
export const FreePlaySwitch: React.FC<Props> = ({ mode, loading, onModeChange }) =>
  mode === "free" ? (
    <Button variant="ghost" size="sm" disabled={loading} onClick={() => onModeChange("scheduled")}>
      <ArrowLeft size={15} /> Back to my plan
    </Button>
  ) : (
    <Button variant="outline" size="sm" disabled={loading} onClick={() => onModeChange("free")}>
      <Shuffle size={15} /> Free play
    </Button>
  );
