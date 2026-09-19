import React from "react";
import { UIGuideBubble } from "../../../components/ui";

/**
 * Help a skill offers, rather than help a child asked for.
 *
 * `SkillHint` is the Hint button's panel: pulled, one rung at a time, by a
 * child who knew they were stuck. This is the other half — pushed, by a skill
 * that noticed. The two look different on purpose and a child learns both: the
 * grey lightbulb is *what I asked for*, the bubble with the tail is *Koda
 * saying something*.
 *
 * Thin on purpose. Everything about how it looks belongs to `UIGuideBubble`, so
 * that offered help looks the same in every skill; what lives here is the one
 * convention skills share — the live instruction first, the lesson's own method
 * behind Back and Next — and the import boundary, so an activity reaches the UI
 * kit through `../../kit` like everything else it draws with.
 *
 * It does not speak. `SkillHint` does, because a hint rung changes only when a
 * child presses something; an offered cue is re-rendered every time they tap,
 * as it follows them across the screen, and a panel that re-read itself on each
 * of those would talk over the activity's own counting. Saying it once, at the
 * moment it is raised, belongs to whatever decided to raise it.
 */

export interface SkillGuideCue {
  /** What to do next, in one sentence. */
  text: string;
  /**
   * Which rung of the ladder this is, if it came from one.
   *
   * Passed to the bubble as its reset key: a new rung is new help and starts at
   * page one, while the same rung rewording itself as the child works leaves
   * whoever is reading page three where they are.
   */
  level?: number;
}

export interface SkillGuideProps {
  /** The cue on screen, or nothing. */
  cue: SkillGuideCue | null;
  /**
   * Pages behind the instruction — the lesson's `stepByStep`, usually.
   *
   * Optional, and genuinely optional: the first page is the whole help for a
   * child who only wants to know what to touch next. These are for the one who
   * wants to know how it is done, and for the adult sitting beside them.
   */
  method?: string[];
  /** The child put it away. */
  onDismiss(): void;
  id?: string;
}

export const SkillGuide: React.FC<SkillGuideProps> = ({ cue, method, onDismiss, id }) => {
  if (!cue) return null;
  return (
    <UIGuideBubble
      id={id}
      message={[cue.text, ...(method ?? [])]}
      resetKey={cue.level ?? 0}
      onAction={onDismiss}
    />
  );
};
