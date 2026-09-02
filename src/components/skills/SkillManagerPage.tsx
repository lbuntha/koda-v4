import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  EyeOff,
  Image as ImageIcon,
  Package,
  Pencil,
  Play,
  Power,
  Puzzle,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  skillTitle,
  SkillStoreAPI,
  useGlobalActionLogs,
  useInstalledSkills,
  type InstalledSkill,
  type SkillActionLog,
} from "../../lib/skillStore";
import { SKILLS, hiddenReason, type HiddenReason } from "../../skills/registry";
import { SvgAsset, THUMBNAIL_ART_CATEGORY, useArtCategory, useHasArt } from "../../assets/svg";
import { setViewer, useViewer, type Viewer } from "../../skills/viewer";
import type { Lesson, SettingField, Skill } from "../../skills/types";
import { themeSystem } from "../../lib/themeSystem";
import { ScoringAPI } from "../../lib/scoring";
import { LessonContentAPI, editsAsLessonJson } from "../../lib/lessonContent";
import { isPracticeLesson, practiceTitle } from "../../curriculum";
import {
  lessonIcons,
  UIBadge,
  UIButton,
  UIDataTable,
  type UIDataTableColumn,
  UILessonIcon,
  UISectionHeader,
  UISkillThumbnail,
  UIStatGrid,
  UIStatTile,
  UITabs,
  type UITabItem,
} from "../ui";
import { LearningLogPanel } from "./LearningLogPanel";
import { PracticeLogPanel } from "./PracticeLogPanel";
import { playSound } from "../../utils/audio";
import { SkillHost } from "../../skills/host/SkillHost";
import {
  releaseStatusOf,
  setSkillPublication,
  SkillRegistryAPI,
  useSkillRegistryVersion,
} from "../../lib/skillRegistryApi";
import { usePermissions, useSession } from "../../lib/sync";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  draft: "neutral",
};

/** One control, rendered from the skill's own `settingsSchema`. */
const SettingControl: React.FC<{
  field: SettingField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}> = ({ field, value, disabled, onChange }) => {
  const label = (
    <div className="min-w-0">
      <div className="text-sm font-bold text-slate-900 dark:text-white">{field.label}</div>
      {field.help && <div className="text-xs text-slate-500 dark:text-slate-400">{field.help}</div>}
    </div>
  );

  if (field.type === "number") {
    const current = typeof value === "number" ? value : field.min;
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        {label}
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={current}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-36 accent-indigo-600 disabled:opacity-40"
            aria-label={field.label}
          />
          <span className="w-14 text-right text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
            {current}
            {field.unit ?? ""}
          </span>
        </div>
      </div>
    );
  }

  if (field.type === "choice") {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        {label}
        <div className="flex items-center gap-1.5 shrink-0">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black border-2 transition disabled:opacity-40 ${
                value === opt.value
                  ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        {label}
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          className={themeSystem.field("sm", "w-48 shrink-0 font-mono")}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {label}
      <button
        disabled={disabled}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={Boolean(value)}
        aria-label={field.label}
        className={`w-11 h-6 rounded-full border-2 transition shrink-0 disabled:opacity-40 ${
          value
            ? "bg-indigo-600 border-indigo-700"
            : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
};

const HIDDEN_COPY: Record<Exclude<HiddenReason, null>, string> = {
  draft: "Draft — visible to developers only.",
  "outside-age-range": "Outside this learner's age range.",
  "disabled-here": "Switched off on this device.",
};

const SkillRow: React.FC<{
  skill: Skill;
  stored: InstalledSkill | undefined;
  viewer: Viewer;
  onOpen: () => void;
}> = ({ skill, stored, viewer, onOpen }) => {
  const { manifest } = skill;
  const releaseStatus = releaseStatusOf(skill);
  const isEnabled = stored?.isEnabled ?? true;
  const features = stored?.features ?? skill.features;
  const settings = { ...skill.settings, ...(stored?.settings ?? {}) };
  const activeCount = features.filter((f) => f.isEnabled).length;
  const hidden = hiddenReason(skill, viewer);
  const activityCount = Object.keys(skill.activities).length;
  const activityLabel = `${activityCount} ${activityCount === 1 ? "activity" : "activities"}`;

  return (
    <button
      onClick={onOpen}
      className={themeSystem.card("interactive", "w-full flex items-center gap-3 p-4 text-left")}
    >
      {/*
        * The skill's own artwork, resolved exactly as every other surface
        * resolves it — the per-install override, else the manifest's, else the
        * first lesson's icon on the category's gradient.
        *
        * This was a parcel glyph on an indigo square, identical for every row,
        * which made the one screen listing every skill the one screen where
        * they all look the same. The learner sees the real thumbnail on Home
        * and in the catalogue; an operator changing that artwork should be
        * looking at what they are changing.
        */}
      <UISkillThumbnail
        thumbnail={stored?.thumbnail ?? manifest.thumbnail}
        fallbackIconName={skill.lessons[0]?.iconName}
        category={manifest.audience.category}
        size="sm"
        className="shrink-0"
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-black text-slate-900 dark:text-white">
            {skillTitle(manifest.name, stored)}
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            v{manifest.version}
          </span>
          <UIBadge variant={STATUS_TONE[releaseStatus] ?? "neutral"}>{releaseStatus}</UIBadge>
          {hidden && <UIBadge variant="neutral">not shown</UIBadge>}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {skill.lessons.length} lessons · {activityLabel} · ages {manifest.audience.ages[0]}–
          {manifest.audience.ages[1]} · {manifest.audience.category}
        </span>
      </span>

      <span className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 shrink-0">
        {activeCount}/{features.length}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
    </button>
  );
};

/** Everything about one skill: what it is, whether it reaches the learner, and how it behaves. */

/**
 * The store listing, editable per install.
 *
 * Kept apart from Settings on purpose: nothing in a round reads these, so a
 * change here alters what a learner is offered, never how the skill behaves.
 * That distinction is the whole reason it is a separate card.
 */
/**
 * What the stored string will actually draw, said back to whoever typed it.
 *
 * One field takes four kinds of value, so the failure that matters is silent:
 * a name nothing answers to looks identical to a good one until the tile
 * renders. Naming the resolution under the field turns that into a sentence
 * before it becomes a wrong tile on the Learn page.
 */
const describeThumbnail = (value: string, isArt: boolean, shipped?: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return `Empty — the tile the skill shipped${shipped ? ` (${shipped})` : ""}.`;
  if (/^(https?:|\/|data:)/.test(trimmed)) return "An image, loaded from that address.";
  if (isArt) return `Artwork "${trimmed}" from the Art page.`;
  if (!/[a-zA-Z0-9]/.test(trimmed)) return "Drawn as typed — an emoji tile.";
  if (trimmed in lessonIcons) return `The "${trimmed}" icon from the shared set.`;
  return `Nothing answers to "${trimmed}" — the tile falls back to what the skill shipped. Pick artwork below, or paste an emoji or image URL.`;
};

const ListingEditor: React.FC<{
  skill: Skill;
  stored: InstalledSkill | undefined;
}> = ({ skill, stored }) => {
  const { manifest } = skill;
  const title = stored?.title ?? "";
  const tagline = stored?.tagline ?? manifest.tagline ?? "";
  const thumbnail = stored?.thumbnail ?? manifest.thumbnail ?? "";
  const edited =
    Boolean(stored?.title) ||
    (stored?.tagline ?? undefined) !== manifest.tagline ||
    (stored?.thumbnail ?? undefined) !== manifest.thumbnail;

  // Typing is local; the store is written on blur, so the Learn page does not
  // redraw on every keystroke.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftTag, setDraftTag] = useState<string | null>(null);
  const [draftThumb, setDraftThumb] = useState<string | null>(null);

  const firstLessonIcon = skill.lessons[0]?.iconName;
  const [artOpen, setArtOpen] = useState(false);
  const artIds = useArtCategory(THUMBNAIL_ART_CATEGORY);
  const isArt = useHasArt((draftThumb ?? thumbnail).trim());

  const setThumbnail = (value: string) => {
    SkillStoreAPI.updateSkillListing(manifest.id, { thumbnail: value });
    setDraftThumb(null);
    playSound("pop");
  };

  return (
    <div className={themeSystem.card("default", "p-4 sm:p-5 space-y-4")}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className={themeSystem.sectionHeader.subtitle}>Store listing</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            What a learner sees on the Learn page. Blank falls back to what the skill shipped.
          </p>
        </div>
        {edited && (
          <button
            onClick={() => {
              SkillStoreAPI.resetSkillListing(manifest.id);
              setDraftName(null);
              setDraftTag(null);
              setDraftThumb(null);
              playSound("pop");
            }}
            className={themeSystem.button("secondary", "sm")}
          >
            <RotateCcw />
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <UISkillThumbnail
          thumbnail={draftThumb ?? thumbnail}
          fallbackIconName={firstLessonIcon}
          category={manifest.audience.category}
          size="md"
        />
        <div className="min-w-0">
          <div className="font-mono font-black text-sm text-slate-900 dark:text-white truncate">
            {(draftName ?? title).trim() || manifest.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {(draftTag ?? tagline) || manifest.description}
          </div>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
          Name
        </span>
        <input
          type="text"
          value={draftName ?? title}
          maxLength={60}
          /* The manifest's name as the placeholder, so an empty box reads as
             "this is what it is called" rather than as a missing name. */
          placeholder={manifest.name}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            if (draftName !== null) {
              SkillStoreAPI.updateSkillListing(manifest.id, { title: draftName });
            }
            setDraftName(null);
          }}
          className={themeSystem.field("lg", "w-full")}
        />
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {/* What a rename does and does not touch. The id is what lessons,
              events and the course reference, and it never moves — an operator
              renaming a skill should know the record follows it. */}
          Shown wherever a learner sees this skill. Clearing it goes back to{" "}
          <span className="font-mono">{manifest.name}</span>. The skill's id (
          <span className="font-mono">{manifest.id}</span>) never changes, so
          progress and the learning log follow the rename.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
          Short description
        </span>
        <input
          type="text"
          value={draftTag ?? tagline}
          maxLength={80}
          placeholder={manifest.description}
          onChange={(e) => setDraftTag(e.target.value)}
          onBlur={() => {
            if (draftTag !== null) {
              SkillStoreAPI.updateSkillListing(manifest.id, {
                tagline: draftTag,
              });
            }
            setDraftTag(null);
          }}
          className={themeSystem.field("lg", "w-full")}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
          Thumbnail
        </span>
        <input
          type="text"
          value={draftThumb ?? thumbnail}
          placeholder={firstLessonIcon ?? "emoji, art id, icon name, or image URL"}
          onChange={(e) => setDraftThumb(e.target.value)}
          onBlur={() => {
            if (draftThumb !== null) {
              SkillStoreAPI.updateSkillListing(manifest.id, {
                thumbnail: draftThumb,
              });
            }
            setDraftThumb(null);
          }}
          className={themeSystem.field("lg", "w-full font-mono")}
        />
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {describeThumbnail(draftThumb ?? thumbnail, isArt, firstLessonIcon)}
        </span>
      </label>

      <ArtPicker
        ids={artIds}
        selected={(draftThumb ?? thumbnail).trim()}
        open={artOpen}
        onToggle={() => {
          setArtOpen((v) => !v);
          playSound("pop");
        }}
        onPick={setThumbnail}
      />
    </div>
  );
};

/**
 * The Art page's `thumbnail` collection, offered as tiles.
 *
 * The same ids the text field accepts, shown as the artwork they draw — typing
 * `counting-quest` from memory is the part that does not scale as the
 * collection grows. Picking writes the id into the same field, so there is one
 * stored value and one resolution rule, not a second kind of thumbnail.
 *
 * Only that one collection: a mango is art a lesson counts, not a tile that has
 * to read beside a skill name, and scrolling past every shape to find the two
 * tiles that fit is how a picker stops being worth opening. The field still
 * takes any id typed by hand, so filtering here narrows what is offered, never
 * what is allowed.
 */
const ArtPicker: React.FC<{
  ids: string[];
  selected: string;
  open: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
}> = ({ ids, selected, open, onToggle, onPick }) => {
  const picked = ids.includes(selected);

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className={themeSystem.button("secondary", "sm")}
        aria-expanded={open}
      >
        <ImageIcon />
        {open ? "Hide artwork" : "Choose from Art"}
        <span className="font-mono text-[11px] opacity-70">{ids.length} svg</span>
      </button>

      {open && (
        <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 p-2 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {ids.map((id) => {
              const isSelected = id === selected;
              return (
                <button
                  key={id}
                  onClick={() => onPick(isSelected ? "" : id)}
                  title={
                    isSelected
                      ? `${id} — click to drop back to the shipped tile`
                      : `${id} · ${THUMBNAIL_ART_CATEGORY}`
                  }
                  className={`rounded-lg p-1 border-2 transition cursor-pointer ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                      : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="w-full h-12 rounded-md bg-checkerboard flex items-center justify-center overflow-hidden">
                    <SvgAsset id={id} size={40} title={id} />
                  </div>
                  <div className="pt-1 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 truncate">
                    {id}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="px-1 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {picked
              ? "Click the selected artwork again to drop back to the shipped tile."
              : ids.length === 0
                ? `Nothing filed under ${THUMBNAIL_ART_CATEGORY} yet — file artwork there on the Art page and it shows up here.`
                : `The ${THUMBNAIL_ART_CATEGORY} collection on the Art page. File art there to offer it here.`}
          </p>
        </div>
      )}
    </div>
  );
};

/** Local time, matching how the learning log renders a timestamp. */
const trailTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const TRAIL_TONE: Record<string, "success" | "danger" | "neutral"> = {
  success: "success",
  error: "danger",
  info: "neutral",
};

const TRAIL_COLUMNS: UIDataTableColumn<SkillActionLog>[] = [
  {
    key: "timestamp",
    header: "Time",
    render: (e) => trailTime(e.timestamp),
    sortValue: (e) => e.timestamp,
    numeric: true,
    nowrap: true,
    muted: true,
  },
  {
    key: "actionType",
    header: "Action",
    render: (e) => e.actionType,
    sortValue: (e) => e.actionType,
    nowrap: true,
  },
  {
    key: "level",
    header: "Level",
    render: (e) => (e.step ? `${e.level} · #${e.step}` : String(e.level)),
    sortValue: (e) => e.level,
    align: "right",
    numeric: true,
    nowrap: true,
    muted: true,
  },
  { key: "details", header: "Detail", render: (e) => e.details },
  {
    key: "status",
    header: "",
    render: (e) =>
      e.status && e.status !== "info" ? (
        <UIBadge variant={TRAIL_TONE[e.status] ?? "neutral"}>{e.status}</UIBadge>
      ) : (
        ""
      ),
    sortValue: (e) => e.status ?? "",
    nowrap: true,
  },
];

/**
 * What this skill did, newest first.
 *
 * The developer's trail, not the child's record: free text a skill writes to
 * explain itself, kept apart from the learning log so nothing pedagogical is
 * ever read from here. Until now every `koda.log` call in every skill was
 * written to a channel with no reader.
 */
export const ActivityTrail: React.FC<{ skillId: string }> = ({ skillId }) => {
  const logs = useGlobalActionLogs();
  const mine = logs.filter((l) => l.skillId === skillId);

  return (
    <div className={themeSystem.card("default", "p-4 sm:p-5 space-y-2")}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className={themeSystem.sectionHeader.subtitle}>Activity trail</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            What this skill reported while running. Diagnostics only — the last 500 across all
            skills, and it is not saved between sessions.
          </p>
        </div>
        {mine.length > 0 && (
          <button
            onClick={() => {
              SkillStoreAPI.clearLogs();
              playSound("pop");
            }}
            className={themeSystem.button("secondary", "sm")}
          >
            <Trash2 />
            Clear
          </button>
        )}
      </div>

      <UIDataTable
        columns={TRAIL_COLUMNS}
        rows={mine.slice(0, 200)}
        rowKey={(e) => e.id}
        defaultSort={{ key: "timestamp", direction: "desc" }}
        maxHeight="20rem"
        caption="Actions this skill reported, newest first"
        emptyMessage="Nothing yet. Play a round and the trail fills up."
      />
    </div>
  );
};

/** The sections of one skill's page, each independent of the others. */
type DetailTab = "features" | "listing" | "settings" | "lessons" | "practice" | "trail";

/**
 * The lessons of one section, as rows you can play or reword.
 *
 * Lifted out of the page when the lessons split in two, because the two lists
 * differ only in which lessons they hold and what a row is called — and a
 * second copy of a row this detailed is a second place to fix a row bug.
 */
const LessonRows: React.FC<{
  skillId: string;
  lessons: Lesson[];
  titleOf?: (title: string) => string;
  editingLessonId: string | null;
  onEdit: (id: string) => void;
  onPreview: (lesson: Lesson) => void;
}> = ({ skillId, lessons, titleOf = (t) => t, editingLessonId, onEdit, onPreview }) => (
  <div className={themeSystem.card("default", "p-4 sm:p-5")}>
    <ol className="divide-y-2 divide-slate-100 dark:divide-slate-800">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                playSound("pop");
                onPreview(lesson);
              }}
              className="flex-1 min-w-0 flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group"
            >
              <UILessonIcon name={lesson.iconName} tone={lesson.iconTone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                  {titleOf(lesson.title)}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {lesson.concept}
                </span>
              </span>
              <span className="hidden sm:flex items-center gap-2 shrink-0">
                {lesson.ageBand && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    ages {lesson.ageBand[0]}–{lesson.ageBand[1]}
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  {lesson.standards?.[0] ?? "—"}
                </span>
              </span>
              <Play className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
            </button>

            {/* Editing is a separate act from playing, so it is a separate
            control rather than a mode the preview drops you into. */}
            <button
              onClick={() => {
                playSound("pop");
                onEdit(lesson.id);
              }}
              aria-expanded={editingLessonId === lesson.id}
              aria-label={`Edit the wording of ${lesson.title}`}
              title="Edit wording"
              className={`p-2 rounded-xl shrink-0 transition cursor-pointer ${
                editingLessonId === lesson.id
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          {editingLessonId === lesson.id && (
            <div className="pb-3">
              <LessonContentEditor skillId={skillId} lesson={lesson} />
            </div>
          )}
        </li>
      ))}
    </ol>
  </div>
);

const SkillDetail: React.FC<{
  skill: Skill;
  stored: InstalledSkill | undefined;
  viewer: Viewer;
  onBack: () => void;
  onPreview: (lesson: Lesson) => void;
}> = ({ skill, stored, viewer, onBack, onPreview }) => {
  const { manifest } = skill;
  const releaseStatus = releaseStatusOf(skill);
  const registration = SkillRegistryAPI.get(manifest.id);
  const configurationPending = SkillRegistryAPI.hasPendingConfiguration(manifest.id);
  const { can } = usePermissions();
  const session = useSession();
  const canPublish = Boolean(session && !session.familyId && can("content:write"));
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const isEnabled = stored?.isEnabled ?? true;
  const features = stored?.features ?? skill.features;
  const settings = { ...skill.settings, ...(stored?.settings ?? {}) };
  const hidden = hiddenReason(skill, viewer);
  /** Which lesson's wording is open for editing, if any. */
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  // One section at a time. Everything here used to stack into a page you had to
  // scroll past Settings to reach the lessons; the sections are independent, so
  // they are tabs rather than a sequence.
  const [tab, setTab] = useState<DetailTab>("features");
  const activeFeatures = features.filter((f) => f.isEnabled).length;
  /*
   * Teaching and practice, as two lists.
   *
   * The same split the Learn page makes, read from the same flag, because they
   * are two different things to look at: the teaching lessons are a sequence a
   * child works through, and the practice ones are a pool that mixes techniques
   * already taught. Sixty-four rows in one scroll hid both.
   */
  const teaching = skill.lessons.filter((lesson) => !isPracticeLesson(lesson));
  const practice = skill.lessons.filter(isPracticeLesson);
  const tabs: UITabItem<DetailTab>[] = [
    {
      id: "features",
      label: "Features",
      count: `${activeFeatures}/${features.length}`,
    },
    { id: "listing", label: "Listing" },
    ...(skill.settingsSchema.length > 0
      ? [
          {
            id: "settings" as const,
            label: "Settings",
            count: skill.settingsSchema.length,
          },
        ]
      : []),
    { id: "lessons", label: "Lessons", count: teaching.length },
    ...(practice.length > 0
      ? [{ id: "practice" as const, label: "Practice", count: practice.length }]
      : []),
    { id: "trail", label: "Activity" },
  ];

  return (
    <div className={themeSystem.spacing.section}>
      <button onClick={onBack} className={themeSystem.button("ghost", "sm")}>
        <ChevronLeft />
        All skills
      </button>

      <div className={themeSystem.card("default", "p-4 sm:p-5 space-y-5")}>
        <div className="flex items-start gap-3">
          {/* The same artwork the row you arrived from showed, and the same the
              listing editor below edits — one skill, one picture of it. */}
          <UISkillThumbnail
            thumbnail={stored?.thumbnail ?? manifest.thumbnail}
            fallbackIconName={skill.lessons[0]?.iconName}
            category={manifest.audience.category}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-mono font-black text-lg text-slate-900 dark:text-white">
                {skillTitle(manifest.name, stored)}
              </h2>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                v{manifest.version}
              </span>
              <UIBadge variant={STATUS_TONE[releaseStatus] ?? "neutral"}>
                {releaseStatus}
              </UIBadge>
              <UIBadge variant={registration ? "success" : "warning"}>
                {registration ? "server registered" : "offline manifest"}
              </UIBadge>
              {configurationPending && <UIBadge variant="warning">changes waiting to sync</UIBadge>}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {manifest.description}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              by {manifest.author} · ages {manifest.audience.ages[0]}–{manifest.audience.ages[1]} ·{" "}
              {manifest.audience.category}
            </p>
            {registration?.publishedBy && registration.publishedAt && (
              <p className="koda-admin-chip text-[#6D6997] dark:text-slate-400 mt-1">
                {releaseStatus === "published" ? "Published" : "Last published"} by{" "}
                {registration.publishedBy.displayName} ·{" "}
                {new Date(registration.publishedAt).toLocaleString()}
              </p>
            )}
            {registration?.configurationChangedBy && registration.configurationChangedAt && (
              <p className="koda-admin-chip text-[#6D6997] dark:text-slate-400 mt-1">
                Configuration saved by {registration.configurationChangedBy.displayName} ·{" "}
                {new Date(registration.configurationChangedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {hidden && (
          <div className={themeSystem.flash("warning")}>
            <EyeOff className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-sm">{HIDDEN_COPY[hidden]}</p>
          </div>
        )}

        {publishError && <div className={themeSystem.flash("error")}>{publishError}</div>}

        <div className="flex flex-wrap items-center gap-2">
          {canPublish && (
            <UIButton
              size="sm"
              variant={releaseStatus === "published" ? "secondary" : "primary"}
              icon={releaseStatus === "published" ? <EyeOff /> : <Check />}
              isLoading={publishing}
              onClick={async () => {
                setPublishing(true);
                setPublishError(null);
                try {
                  await setSkillPublication(
                    manifest.id,
                    releaseStatus === "published" ? "draft" : "published",
                  );
                  playSound("pop");
                } catch (error) {
                  setPublishError(error instanceof Error ? error.message : "Could not update publication.");
                } finally {
                  setPublishing(false);
                }
              }}
            >
              {publishing
                ? releaseStatus === "published" ? "Moving to draft..." : "Publishing..."
                : releaseStatus === "published" ? "Move to draft" : "Publish skill"}
            </UIButton>
          )}
          <button
            onClick={() => {
              playSound("pop");
              SkillStoreAPI.toggleSkill(manifest.id);
            }}
            className={themeSystem.button(isEnabled ? "secondary" : "primary", "sm")}
          >
            <Power />
            {isEnabled ? "Disable skill" : "Enable skill"}
          </button>
          <button
            onClick={() => {
              playSound("pop");
              SkillStoreAPI.resetSkillToDefaults(manifest.id);
            }}
            className={themeSystem.button("ghost", "sm")}
          >
            <RotateCcw />
            Reset to defaults
          </button>
        </div>
      </div>

      <UITabs items={tabs} value={tab} onChange={setTab} label={`${manifest.name} sections`} />

      {tab === "features" && (
        <div className={themeSystem.card("default", "p-4 sm:p-5")}>
          <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
            {features.map((feat) => (
              <div key={feat.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {feat.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {feat.description}
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={feat.isEnabled}
                  aria-label={feat.name}
                  disabled={!isEnabled}
                  onClick={() => {
                    playSound("pop");
                    SkillStoreAPI.toggleFeature(manifest.id, feat.id);
                  }}
                  className={`w-11 h-6 rounded-full border-2 transition shrink-0 disabled:opacity-40 ${
                    feat.isEnabled
                      ? "bg-indigo-600 border-indigo-700"
                      : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      feat.isEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "listing" && <ListingEditor skill={skill} stored={stored} />}

      {tab === "settings" && skill.settingsSchema.length > 0 && (
        <div className={themeSystem.card("default", "p-4 sm:p-5")}>
          <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
            {skill.settingsSchema.map((field) => (
              <SettingControl
                key={field.key}
                field={field}
                value={settings[field.key]}
                disabled={!isEnabled}
                onChange={(v) => SkillStoreAPI.updateSkillSetting(manifest.id, field.key, v)}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "lessons" && (
        <LessonRows
          skillId={manifest.id}
          lessons={teaching}
          editingLessonId={editingLessonId}
          onEdit={(id) => setEditingLessonId((open) => (open === id ? null : id))}
          onPreview={onPreview}
        />
      )}

      {/* The word "Practice" is already the tab, so a row does not repeat it. */}
      {tab === "practice" && (
        <LessonRows
          skillId={manifest.id}
          lessons={practice}
          titleOf={practiceTitle}
          editingLessonId={editingLessonId}
          onEdit={(id) => setEditingLessonId((open) => (open === id ? null : id))}
          onPreview={onPreview}
        />
      )}

      {/* Diagnostics, so it sits after everything you can actually change. */}
      {tab === "trail" && <ActivityTrail skillId={manifest.id} />}
    </div>
  );
};

/**
 * Runs one lesson exactly as a learner would see it, but sealed off from their
 * record: XP and completions are swallowed rather than written. That is the
 * point of a preview — you can play a lesson to check it without inflating a
 * child's progress, and you can preview a skill that is switched off.
 */

/** One editable line of lesson wording. */
const ContentField: React.FC<{
  label: string;
  help?: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}> = ({ label, help, value, placeholder, multiline, onCommit }) => {
  // Typing is local; the store is written on blur, so the round behind this
  // panel does not redraw on every keystroke.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  const className =
    themeSystem.field("lg", "w-full");

  return (
    <label className="block space-y-1">
      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={shown}
          rows={2}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className={className}
        />
      ) : (
        <input
          type="text"
          value={shown}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className={className}
        />
      )}
      {help && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{help}</span>}
    </label>
  );
};

/**
 * The words in a lesson, editable here.
 *
 * Only the wording: the title, the concept line, the teaching note and the
 * prompts a child reads. `conceptKey`, standards, ages and params decide how the
 * app behaves and what a child's record means, so those stay in the lesson file
 * where a change is reviewed rather than typed.
 *
 * Blank means "use what the skill shipped", which is why every field shows the
 * file's own value as its placeholder.
 */
const LessonContentEditor: React.FC<{ skillId: string; lesson: Lesson }> = ({
  skillId,
  lesson,
}) => {
  useSyncExternalStore(LessonContentAPI.subscribe, LessonContentAPI.version);
  const edit = LessonContentAPI.get(skillId, lesson.id) ?? {};
  const edited = LessonContentAPI.isEdited(skillId, lesson.id);
  /** Cleared on a timer so the button confirms itself and then forgets. */
  const [copied, setCopied] = useState(false);

  const copyForFile = async () => {
    const json = editsAsLessonJson(skillId, lesson.id);
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      playSound("pop");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused. Say so rather than pretending it worked.
      setCopied(false);
    }
  };

  const play = (lesson.params as { play?: { kidTip?: string; prompts?: Record<string, string> } } | undefined)
    ?.play;
  const filePrompts = play?.prompts ?? {};

  return (
    <div className={themeSystem.card("default", "p-4 sm:p-5 space-y-4")}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className={themeSystem.sectionHeader.subtitle}>Lesson wording</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            What a learner reads. Saved on this device; blank uses what the skill shipped.
          </p>
        </div>
        {edited && (
          <div className="flex items-center gap-2">
            <button onClick={copyForFile} className={themeSystem.button("secondary", "sm")}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy for lessons.json"}
            </button>
            <button
              onClick={() => {
                LessonContentAPI.reset(skillId, lesson.id);
                playSound("pop");
              }}
              className={themeSystem.button("secondary", "sm")}
            >
              <RotateCcw />
              Reset
            </button>
          </div>
        )}
      </div>

      <ContentField
        label="Title"
        value={edit.title ?? ""}
        placeholder={lesson.title}
        onCommit={(title) => LessonContentAPI.set(skillId, lesson.id, { title })}
      />
      <ContentField
        label="Concept line"
        value={edit.concept ?? ""}
        placeholder={lesson.concept}
        onCommit={(concept) => LessonContentAPI.set(skillId, lesson.id, { concept })}
      />
      <ContentField
        label="Teaching note"
        multiline
        value={edit.pedagogyTip ?? ""}
        placeholder={lesson.pedagogyTip ?? "For the adult watching, not the child."}
        onCommit={(pedagogyTip) => LessonContentAPI.set(skillId, lesson.id, { pedagogyTip })}
      />
      {/* The first thing a stuck child is told, and the only rung of the hint
          ladder a lesson writes: the rest are built by the activity out of the
          numbers on screen. Shown to the child and read aloud, so it is written
          to be heard — a short sentence, the strategy, no numbers. */}
      <ContentField
        label="Hint (first tap)"
        multiline
        value={edit.kidTip ?? ""}
        placeholder={play?.kidTip ?? "The strategy, in a child's words. Said out loud."}
        onCommit={(kidTip) => LessonContentAPI.set(skillId, lesson.id, { kidTip })}
      />

      {edited && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          These words are on this device only. Copy them into{" "}
          <code className="font-mono">src/skills/{skillId}/lessons.json</code> to ship them to
          everyone.
        </p>
      )}

      {Object.keys(filePrompts).length > 0 && (
        <div className="space-y-3 pt-2 border-t-2 border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Question prompts
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              One per situation. Keep the {"{placeholders}"} — they are filled with the numbers the
              child is looking at.
            </p>
          </div>
          {Object.entries(filePrompts).map(([key, fileText]) => (
            <ContentField
              key={key}
              label={key}
              multiline
              value={edit.prompts?.[key] ?? ""}
              placeholder={fileText}
              onCommit={(text) =>
                LessonContentAPI.set(skillId, lesson.id, {
                  prompts: { ...edit.prompts, [key]: text },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

const LessonPreview: React.FC<{ lesson: Lesson; onClose: () => void }> = ({ lesson, onClose }) => {
  const [awarded, setAwarded] = useState(0);

  const q = (lesson.params?.question ?? {}) as Record<string, unknown>;
  const level = (lesson.params?.level as number) ?? 1;
  const range = q.countRange as [number, number] | undefined;

  const meta = [
    { term: "Level", value: String(level) },
    { term: "Activity", value: lesson.activity },
    { term: "Concept", value: lesson.concept },
    { term: "Difficulty", value: lesson.difficulty ?? "—" },
    { term: "Questions", value: String(q.questionsPerRound ?? 5) },
    // Every level pays the same, from Settings — a lesson no longer sets it.
    { term: "XP", value: `up to +${ScoringAPI.current().xpPerLevel}` },
    ...(range ? [{ term: "Items", value: `${range[0]}–${range[1]}` }] : []),
    ...(lesson.ageBand
      ? [{ term: "Ages", value: `${lesson.ageBand[0]}–${lesson.ageBand[1]}` }]
      : []),
    ...(lesson.trajectoryLevel ? [{ term: "Trajectory", value: lesson.trajectoryLevel }] : []),
    ...(lesson.standards?.length ? [{ term: "Standard", value: lesson.standards.join(", ") }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="border-b-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 px-4 pt-2.5">
          <UIBadge variant="warning">Preview</UIBadge>
          <UILessonIcon name={lesson.iconName} tone={lesson.iconTone} variant="bare" size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {lesson.title}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              progress is not saved
              {awarded > 0 && ` · ${awarded} XP discarded`}
            </div>
          </div>
          <button onClick={onClose} className={themeSystem.button("secondary", "sm")}>
            <X />
            Close
          </button>
        </div>

        {/* What this lesson actually is, so a reviewer can check the numbers
            without opening lessons.json. */}
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-[11px] font-mono">
          {meta.map(({ term, value }) => (
            <div key={term} className="flex items-center gap-1.5">
              <dt className="text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {term}
              </dt>
              <dd className="font-black text-slate-700 dark:text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <SkillHost
          activityRef={lesson.activity}
          params={lesson.params}
          level={(lesson.params?.level as number) ?? 1}
          snapshot={PREVIEW_SNAPSHOT}
          // Identity for the skill's chrome. `entry="preview"` is what keeps
          // telemetry off — it is now stated rather than implied by omitting
          // the lesson, because the lesson has to be passed for the title.
          entry="preview"
          lesson={{
            lessonId: lesson.id,
            conceptKey: lesson.conceptKey ?? "",
            title: lesson.title,
            concept: lesson.concept,
            practice: isPracticeLesson(lesson),
          }}
          onExit={onClose}
          // Swallowed on purpose — a preview must not touch the learner's record.
          onAwardXp={(xp) => setAwarded((n) => n + xp)}
          onComplete={() => {}}
        />
      </div>
    </div>
  );
};

/** Stand-in learner for previews, so a skill reading progress still renders. */
const PREVIEW_SNAPSHOT = {
  xp: 0,
  level: 1,
  streakDays: 0,
  problemsSolved: 0,
  dailyGoal: 5,
  dailySolved: 0,
};

/**
 * Skill manager.
 *
 * Reads the registry, so every registered skill appears with no edit here. The
 * page it replaced hardcoded one skill id in 18 places and rendered bespoke
 * controls for that skill's settings.
 */
export const SkillManagerPage: React.FC = () => {
  useSkillRegistryVersion();
  const stored = useInstalledSkills();
  const viewer = useViewer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Lesson | null>(null);
  const [tab, setTab] = useState<"skills" | "log" | "practice">("skills");

  const storedById = useMemo(() => new Map(stored.map((p) => [p.id, p])), [stored]);

  const totals = useMemo(() => {
    const features = SKILLS.flatMap((p) => storedById.get(p.manifest.id)?.features ?? p.features);
    return {
      skills: SKILLS.length,
      visible: SKILLS.filter((p) => hiddenReason(p, viewer) === null).length,
      lessons: SKILLS.reduce((n, p) => n + p.lessons.length, 0),
      activeFeatures: `${features.filter((f) => f.isEnabled).length}/${features.length}`,
    };
  }, [storedById, viewer]);

  const selected = SKILLS.find((p) => p.manifest.id === selectedId);
  if (selected) {
    return (
      <>
        <SkillDetail
          skill={selected}
          stored={storedById.get(selected.manifest.id)}
          viewer={viewer}
          onBack={() => {
            playSound("pop");
            setSelectedId(null);
          }}
          onPreview={setPreview}
        />
        {preview && <LessonPreview lesson={preview} onClose={() => setPreview(null)} />}
      </>
    );
  }

  return (
    <div className={themeSystem.spacing.section}>
      <UISectionHeader
        icon={<Puzzle />}
        title="Skill Manager"
        subtitle="Every skill in this build. Turn one on or off, tune how it behaves, or edit what it says."
      />

      {/* The log spans every skill, so it is a peer of the skill list rather
          than something buried inside one skill's detail page. */}
      <UITabs
        items={[
          { id: "skills", label: "Skills", count: SKILLS.length },
          { id: "log", label: "Learning log" },
          // Its own tab rather than a section of the learning log: that log
          // answers "is this understood?", and this one answers "how fluent is
          // it?". Reading a speed table as a mastery table is the misreading
          // worth designing against, so they do not share a screen.
          { id: "practice", label: "Practice log" },
        ]}
        value={tab}
        onChange={setTab}
        label="Skill manager sections"
      />

      {tab === "log" ? (
        <LearningLogPanel />
      ) : tab === "practice" ? (
        <PracticeLogPanel />
      ) : (
        <>
          <UIStatGrid>
            <UIStatTile icon={<Package />} value={String(totals.skills)} label="Installed" />
            <UIStatTile
              icon={<Power />}
              value={String(totals.visible)}
              label="Visible to learner"
              tone="success"
            />
            <UIStatTile icon={<BookOpen />} value={String(totals.lessons)} label="Lessons" />
            <UIStatTile
              icon={<SlidersHorizontal />}
              value={totals.activeFeatures}
              label="Features on"
            />
          </UIStatGrid>

          {/* Who the gate is being evaluated against. No accounts yet, so this is
          per-device — see skills/viewer.ts. */}
          <div className={themeSystem.card("default", "p-4 flex flex-wrap items-center gap-4")}>
            <span className="text-sm font-bold text-slate-900 dark:text-white">Viewing as</span>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Age</span>
              <input
                type="number"
                min={3}
                max={12}
                value={viewer.age}
                onChange={(e) => setViewer({ age: Number(e.target.value) })}
                className={themeSystem.field("sm", "w-16 font-mono font-bold")}
              />
            </label>

            {/* A filter on what this page lists, not a switch on any skill —
                worded so it cannot be read as a second "disable". */}
            <button
              role="switch"
              aria-checked={viewer.isDeveloper}
              onClick={() => setViewer({ isDeveloper: !viewer.isDeveloper })}
              className={themeSystem.button(viewer.isDeveloper ? "primary" : "secondary", "sm")}
            >
              Include drafts
            </button>
          </div>

          <div className="space-y-3">
            {SKILLS.map((skill) => (
              <SkillRow
                key={skill.manifest.id}
                skill={skill}
                stored={storedById.get(skill.manifest.id)}
                viewer={viewer}
                onOpen={() => {
                  playSound("pop");
                  setSelectedId(skill.manifest.id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
