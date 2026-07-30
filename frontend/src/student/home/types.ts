import type {
  CourseMode,
  CourseQueueItem,
  CurriculumPath,
  StudentActivitySignal,
  StudentProgress,
  TodayCourse,
} from "../../api/course";
import type { GradeBand } from "../../api/auth";
import type { LevelUp } from "./LevelUpDialog";

/** Props shared by every band layout. `StudentTodayHome` routes these by band. */
export interface StudentHomeProps {
  course: TodayCourse;
  progress: StudentProgress | null;
  activitySignal: StudentActivitySignal | null;
  /** The assigned curriculum walked A→Z, with each skill's status. */
  paths: CurriculumPath[];
  replayItems: CourseQueueItem[];
  levelUp: LevelUp | null;
  studentName: string;
  studentAvatar?: string | null;
  band: GradeBand;
  loadingMode: CourseMode | null;
  skippingSkillId: string | null;
  onModeChange: (mode: CourseMode) => void;
  onStart: (item: CourseQueueItem) => void;
  onSkip: (item: CourseQueueItem) => void;
  onDismissLevelUp: () => void;
  onExit: () => void;
}
