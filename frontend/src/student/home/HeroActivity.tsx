import React from "react";
import { ArrowRight } from "lucide-react";
import type { CourseQueueItem } from "../../api/course";
import { Button, Card, CardContent } from "../../components/ui";
import { KIND, cardsLabel } from "./kinds";
import { ActivityStatusBadge } from "./ActivityStatusBadge";

interface Props {
  item: CourseQueueItem;
  /** Show the subtle "Not now" skip (scheduled plan with a live recommendation run). */
  canSkip: boolean;
  skipping: boolean;
  onStart: (item: CourseQueueItem) => void;
  onSkip: (item: CourseQueueItem) => void;
}

/** The one primary activity — the single obvious thing to do next. */
export const HeroActivity: React.FC<Props> = ({ item, canSkip, skipping, onStart, onSkip }) => {
  const meta = KIND[item.kind];
  const Icon = meta.icon;
  return (
    <Card className="border-[#E2DEEF] shadow-[0_12px_36px_rgba(45,35,100,0.08)] dark:border-white/10 dark:bg-[#181D31] dark:shadow-none">
      <CardContent className="flex flex-col items-center p-7 text-center md:p-10">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${meta.tone}`}>
          <Icon size={13} /> {meta.label} · {cardsLabel(item.questions.length)}
        </span>
        <ActivityStatusBadge status={item.status} className="mt-3" />
        <h2 className="mt-5 text-2xl font-extrabold text-[#22203A] md:text-3xl dark:text-[#E7E5F7]">{item.skillLabel}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#746E8D] dark:text-[#9A94B8]">{item.reason || "Let’s practise!"}</p>
        <Button size="lg" className="mt-7 min-w-[220px]" onClick={() => onStart(item)}>
          Play <ArrowRight size={16} />
        </Button>
        {canSkip && (
          <button
            type="button"
            disabled={skipping}
            onClick={() => onSkip(item)}
            className="mt-3 text-xs font-semibold text-[#9B95B2] hover:text-[#6B57D8] disabled:opacity-60 dark:text-[#8E88AC] dark:hover:text-[#B7A7FF]"
          >
            {skipping ? "Skipping…" : "Not now"}
          </button>
        )}
      </CardContent>
    </Card>
  );
};
