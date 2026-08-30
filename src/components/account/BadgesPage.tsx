import React, { useState, useSyncExternalStore } from "react";
import { Award, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import {
  BADGE_METRICS,
  BadgeAPI,
  MAX_BADGES,
  slugify,
  type BadgeMetric,
  type BadgeRule,
} from "../../lib/badges";
import { usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIButton, UIModal, UISectionHeader } from "../ui";
import {
  ART_PREFIX,
  BADGE_ART_CATEGORY,
  BADGE_ICONS,
  BadgeIcon,
  badgeRequirement,
  useBadgeArt,
} from "./BadgeVisuals";
import { NoAccess } from "./NoAccess";

const field =
  themeSystem.field("lg", "w-full");

/** One picture to choose from, built-in or drawn by the family. */
const IconChoice: React.FC<{
  icon: string;
  label: string;
  selected: boolean;
  onSelect(): void;
}> = ({ icon, label, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-label={label}
    title={label}
    aria-pressed={selected}
    className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-colors ${
      selected
        ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
        : "border-line bg-surface-muted text-muted"
    }`}
  >
    <BadgeIcon icon={icon} size={22} />
  </button>
);

const blank = (): BadgeRule => ({
  id: "",
  label: "",
  description: "",
  icon: "award",
  metric: "xp",
  threshold: 50,
});

/**
 * What a badge is, for the whole family.
 *
 * Its own page rather than a third block of sliders on Scoring & XP: this is a
 * list somebody adds to and removes from, and a list editor needs room that a
 * row of sliders does not. It sits behind the same right for the same reason it
 * sits beside them — a badge is a reward, and what it takes to win one is part
 * of the same economy as what a star is worth.
 *
 * Everything here is read at render time by `earnedBadges`, so a change lands on
 * every learner's profile as soon as it syncs. That includes taking one back: a
 * raised threshold un-earns a badge a child already had, which is the same
 * retroactive bargain the Scoring page makes with stars, and the page says so.
 */
export const BadgesPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  useSyncExternalStore(BadgeAPI.subscribe, BadgeAPI.version);
  const { can } = usePermissions();
  const art = useBadgeArt();
  const [draft, setDraft] = useState<BadgeRule | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!can("system:write")) {
    return (
      <NoAccess
        title="Badges"
        permission="system:write"
        what="What a badge is, and what it takes to earn one, is set once for every family on this Koda."
      />
    );
  }

  const rules = BadgeAPI.current();

  const save = () => {
    if (!draft || !draft.label.trim()) return;
    playSound("pop");
    if (editingId) {
      BadgeAPI.update(
        rules.map((rule) => (rule.id === editingId ? { ...draft, id: editingId } : rule)),
      );
    } else {
      BadgeAPI.add({ ...draft, id: slugify(draft.label) });
    }
    setDraft(null);
    setEditingId(null);
  };

  const remove = (rule: BadgeRule) => {
    if (!window.confirm(`Remove "${rule.label}"? Any learner who has it loses it.`)) return;
    BadgeAPI.remove(rule.id);
    playSound("pop");
  };

  return (
    <div
      className={
        embedded ? "space-y-6" : "max-w-3xl mx-auto space-y-6"
      }
    >
      {!embedded && (
        <div>
          <h2 className={themeSystem.typography("h2")}>Badges</h2>
          <p className={themeSystem.typography("body-sm", "mt-1")}>
            What a learner has to reach to earn one. Shared by every child in the family, and
            re-checked against what each of them has already done.
          </p>
        </div>
      )}

      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title="Achievements"
          subtitle="Earned on lifetime XP, longest streak or stars — whichever the badge names"
          icon={<Award className="h-5 w-5 text-amber-500" />}
          action={
            BadgeAPI.isEdited() ? (
              <button
                onClick={() => {
                  if (!window.confirm("Put the badges back to the ones Koda ships with?")) return;
                  BadgeAPI.reset();
                  playSound("pop");
                }}
                className={themeSystem.button("secondary", "sm")}
              >
                <RotateCcw />
                Reset
              </button>
            ) : undefined
          }
        />

        {rules.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-surface-muted p-6 text-center">
            <Award className="mx-auto h-8 w-8 text-amber-400" />
            <h4 className="mt-2 text-sm font-bold text-ink">No badges yet</h4>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Add one and every learner who has already passed it earns it straight away.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* No tile: the badges are drawn artwork now, with their own
                      rim and drop shadow, and a bordered box around a thing
                      that already has an edge reads as two frames. 44px so the
                      art is the size it was drawn to be rather than a 20px
                      thumbnail of itself. */}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center text-amber-500 [&>svg]:h-9 [&>svg]:w-9">
                    <BadgeIcon icon={rule.icon} size={44} />
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate font-mono text-sm font-bold text-ink">{rule.label}</h4>
                    <p className="truncate text-xs text-muted">
                      {rule.description || "No description"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Ink, not amber. Amber-600 on this pale row is the weakest
                      contrast on the page, and it is the one figure an adult
                      actually reads here — what the badge costs. */}
                  <span className="font-mono text-sm font-black tabular-nums text-ink">
                    {badgeRequirement(rule)}
                  </span>
                  <button
                    onClick={() => {
                      setDraft({ ...rule });
                      setEditingId(rule.id);
                    }}
                    aria-label={`Edit ${rule.label}`}
                    className={themeSystem.button("secondary", "sm")}
                  >
                    <Pencil />
                  </button>
                  <button
                    onClick={() => remove(rule)}
                    aria-label={`Remove ${rule.label}`}
                    className={themeSystem.button("danger", "sm")}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <UIButton
            variant="primary"
            size="sm"
            icon={<Plus />}
            disabled={rules.length >= MAX_BADGES}
            onClick={() => {
              setDraft(blank());
              setEditingId(null);
            }}
          >
            Add badge
          </UIButton>
          <p className="text-xs text-muted">
            Raising a badge's number takes it back off a learner who no longer meets it.
          </p>
        </div>
      </section>

      <UIModal
        isOpen={Boolean(draft)}
        onClose={() => {
          setDraft(null);
          setEditingId(null);
        }}
        title={editingId ? "Edit badge" : "Add badge"}
        footer={
          <>
            <UIButton
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
              }}
            >
              Cancel
            </UIButton>
            <UIButton variant="primary" disabled={!draft?.label.trim()} onClick={save}>
              {editingId ? "Save badge" : "Add badge"}
            </UIButton>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="koda-admin-label text-ink">Name</span>
              <input
                className={field}
                autoFocus
                maxLength={40}
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                placeholder="Week Warrior"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="koda-admin-label text-ink">
                Description <span className="font-normal text-muted">(what the learner reads)</span>
              </span>
              <input
                className={field}
                maxLength={120}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Practised seven days in a row."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">Earned on</span>
                <select
                  className={field}
                  value={draft.metric}
                  onChange={(event) =>
                    setDraft({ ...draft, metric: event.target.value as BadgeMetric })
                  }
                >
                  {BADGE_METRICS.map((metric) => (
                    <option key={metric.id} value={metric.id}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">
                  Reaching{" "}
                  <span className="font-normal text-muted">
                    ({BADGE_METRICS.find((m) => m.id === draft.metric)?.unit})
                  </span>
                </span>
                <input
                  className={field}
                  type="number"
                  min={1}
                  value={draft.threshold}
                  onChange={(event) =>
                    setDraft({ ...draft, threshold: Number(event.target.value) || 1 })
                  }
                />
              </label>
            </div>

            <p className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
              {BADGE_METRICS.find((m) => m.id === draft.metric)?.hint}
            </p>

            <div className="space-y-1.5">
              <span className="koda-admin-label text-ink">Picture</span>
              <div className="flex flex-wrap gap-2">
                {BADGE_ICONS.map((icon) => (
                  <IconChoice
                    key={icon}
                    icon={icon}
                    label={icon}
                    selected={draft.icon === icon}
                    onSelect={() => setDraft({ ...draft, icon })}
                  />
                ))}
              </div>

              {/*
                * A family's own artwork, filed under `badges` on the Art page.
                * Offered second because the built-ins are always there — but
                * these are the ones a family drew for their own children, and
                * they are drawn at the size they will actually appear.
                */}
              <p className="pt-2 text-xs font-bold text-muted">Your badge artwork</p>
              {art.length === 0 ? (
                <p className="text-xs text-muted">
                  Nothing here yet. Add SVGs to a{" "}
                  <span className="font-mono text-ink">{BADGE_ART_CATEGORY}</span> collection on the
                  Art page and they will show up in this list.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {art.map((id) => (
                    <IconChoice
                      key={id}
                      icon={`${ART_PREFIX}${id}`}
                      label={id}
                      selected={draft.icon === `${ART_PREFIX}${id}`}
                      onSelect={() => setDraft({ ...draft, icon: `${ART_PREFIX}${id}` })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </UIModal>
    </div>
  );
};
