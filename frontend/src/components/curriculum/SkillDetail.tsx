/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real question grid for one Skill: read, preview, edit, reorder (up/down —
 * no drag library in the project's dependencies, see the build plan), and
 * delete.
 */

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Eye,
  FolderHeart,
  Images,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { CountingQuestion, CustomSvgAsset } from "../../types";
import {
  CONCEPT_ID_PATTERN,
  CurriculumTree,
  Skill,
  SkillCoverage,
  SKILL_MINUTES_MAX,
  SKILL_MINUTES_MIN,
  formatSkillMinutes,
  getSkillPath,
  isValidSkillMinutes,
} from "../../curriculum/types";
import { filterAndSortBySkill, formatTechniqueLabel } from "./questionOps";
import { Badge, Button, Dialog, Input, Label, Select, Switch, Textarea } from "../ui";
import { ALL_TECHNIQUES, resolveTechniqueThumbnail } from "../../techniques";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";
import { isSafeSvgMarkup } from "../../assets/svgSafety";
import { preprocessSvgMarkup } from "../../assets/svgPreprocess";
import { createSvgAssetId } from "../../assets/svgIds";
import { CountingAsset } from "../Assets";

interface SkillDetailProps {
  skill: Skill;
  tree: CurriculumTree;
  coverage: SkillCoverage;
  questions: CountingQuestion[];
  onDeleteQuestion: (questionId: string) => void;
  onReorderQuestions: (orderedIds: string[]) => void;
  onAddQuestion: () => void;
  onFillWithAi: () => void;
  onPreviewQuestion: (questionId: string) => void;
  onEditQuestion: (questionId: string) => void;
  onUpdateSkill: (patch: Partial<Omit<Skill, "id" | "unitId">>) => void;
}

export const SkillDetail: React.FC<SkillDetailProps> = ({
  skill,
  tree,
  coverage,
  questions,
  onDeleteQuestion,
  onReorderQuestions,
  onAddQuestion,
  onFillWithAi,
  onPreviewQuestion,
  onEditQuestion,
  onUpdateSkill,
}) => {
  const path = getSkillPath(skill.id, tree);
  const [isReordering, setIsReordering] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false);
  const [thumbnailQuery, setThumbnailQuery] = useState("");
  const { assets: svgAssets, setAssets: setSvgAssets, persistenceStatus: svgPersistenceStatus } = useSvgLibrary();
  const [markupNotice, setMarkupNotice] = useState<string | null>(null);
  const [markupError, setMarkupError] = useState<string | null>(null);
  const completionXpInvalid = (
    skill.completionXp !== undefined
    && (!Number.isInteger(skill.completionXp) || skill.completionXp < 0 || skill.completionXp > 100)
  );
  const minutesLabel = formatSkillMinutes(skill);
  const estimatedMinutesInvalid = !isValidSkillMinutes(skill.presentation?.estimatedMinutes);
  // Matches the check the release runs; publishing a malformed one is refused server-side.
  const conceptIdInvalid = Boolean(skill.conceptId) && !CONCEPT_ID_PATTERN.test(skill.conceptId!);

  const skillQuestions = filterAndSortBySkill(questions, skill.id);
  const coverageLabel = coverage.shortfall === 0
    ? `${skillQuestions.length} questions · requirement met`
    : `${skillQuestions.length} questions · ${coverage.shortfall} more required`;
  const primaryTechnique = skillQuestions[0]?.technique;
  const selectedLibraryAssetId = skill.presentation?.thumbnailAssetId;
  const selectedLibraryAsset = selectedLibraryAssetId
    ? svgAssets.find(asset => asset.id === selectedLibraryAssetId)
    : undefined;
  const thumbnail = resolveTechniqueThumbnail(
    skill.presentation?.thumbnailUrl,
    primaryTechnique,
  );
  const thumbnailSourceLabel = selectedLibraryAsset
    ? "SVG library"
    : selectedLibraryAssetId
      ? "Missing SVG asset"
    : thumbnail.source === "curriculum"
    ? "Curriculum override"
    : thumbnail.source === "component"
      ? `${formatTechniqueLabel(primaryTechnique)} default`
      : "Generic fallback";
  const missingLibraryAsset = Boolean(
    selectedLibraryAssetId && !selectedLibraryAsset && svgPersistenceStatus !== "loading",
  );
  // Anything a publish would reject. Collapsing the form must never hide it, so an issue
  // both flags the strip and forces the fields open.
  const presentationIssue = estimatedMinutesInvalid || completionXpInvalid || missingLibraryAsset;
  const showPresentationFields = presentationOpen || presentationIssue;
  const thumbnailOptions = [
    {
      id: "curriculum:count-to-10",
      label: "Count & Math 10",
      url: "/assets/curriculum/count-to-10.svg",
      source: "Curriculum artwork",
    },
    {
      id: "curriculum:subtraction",
      label: "Take away & Subtraction",
      url: "/assets/curriculum/subtraction-within-10.svg",
      source: "Curriculum artwork",
    },
    ...ALL_TECHNIQUES
      .filter(manifest => manifest.defaultThumbnailUrl)
      .map(manifest => ({
        id: `component:${manifest.technique}`,
        label: formatTechniqueLabel(manifest.technique),
        url: manifest.defaultThumbnailUrl!,
        source: "Component artwork",
      })),
  ];
  const normalizedThumbnailQuery = thumbnailQuery.trim().toLowerCase();
  const visibleSvgAssets = svgAssets.filter(asset =>
    !normalizedThumbnailQuery || asset.label.toLowerCase().includes(normalizedThumbnailQuery)
  );
  const visibleThumbnailOptions = thumbnailOptions.filter(option =>
    !normalizedThumbnailQuery
    || `${option.label} ${option.source}`.toLowerCase().includes(normalizedThumbnailQuery)
  );

  /**
   * Accept SVG markup pasted into the URL field by saving it to the shared library and
   * linking the skill to it.
   *
   * The field is a *reference* — the backend rejects anything that is not an app path or
   * HTTP URL, so pasted markup used to fail validation and leave a broken preview. Markup is
   * artwork, and artwork lives in the library, where it gets an id, is reusable across
   * skills, and is snapshotted into the release. Sanitising first is what keeps a paste from
   * carrying a script into every learner's page.
   */
  const attachPastedMarkup = (raw: string) => {
    setMarkupNotice(null);
    setMarkupError(null);
    const markup = preprocessSvgMarkup(raw.trim());
    if (!isSafeSvgMarkup(markup)) {
      setMarkupError("That markup contains script or event handlers, so it was not saved.");
      return;
    }
    const label = (skill.presentation?.title || skill.label || "Skill artwork").slice(0, 60);
    const asset: CustomSvgAsset = { id: createSvgAssetId(), label, markup, scale: 1 };
    setSvgAssets(current => [...current, asset]);
    onUpdateSkill({
      presentation: { ...skill.presentation, thumbnailUrl: undefined, thumbnailAssetId: asset.id },
    });
    setMarkupNotice(`Saved to your SVG library as “${label}” and linked to this skill.`);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= skillQuestions.length) return;
    const orderedIds = skillQuestions.map(q => q.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];
    onReorderQuestions(orderedIds);
  };

  return (
    <div className="p-3 md:p-5">
      {path && (
        <nav aria-label="Skill location" className="mb-2 flex flex-wrap items-center gap-1.5">
          {[path.grade.label, path.subject.label, path.unit.label].map((label, index) => (
            <React.Fragment key={`${label}-${index}`}>
              {index > 0 && <ChevronRight size={11} aria-hidden="true" className="text-[#B7B2CC]" />}
              <span className="koda-admin-chip max-w-full rounded-full bg-[#F2F0FA] px-2 py-0.5 text-[10px] leading-4 text-[#6D6997]">
                {label}
              </span>
            </React.Fragment>
          ))}
          <ChevronRight size={11} aria-hidden="true" className="text-[#B7B2CC]" />
          <span
            className="koda-admin-chip max-w-full rounded-full bg-[#EDE8FF] px-2 py-0.5 text-[10px] leading-4 text-[#534AB7]"
            aria-current="page"
          >
            {path.skill.label}
          </span>
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 className="text-base font-extrabold text-slate-800">{skill.label}</h1>
        <Badge variant={coverage.isComplete ? "success" : "warning"}>
          {coverage.questionCount}/{coverage.minQuestions}
        </Badge>
        {skill.standardRef && <span className="text-2xs font-mono text-slate-400">{skill.standardRef}</span>}
      </div>
      {skill.description && <p className="mt-1 text-xs text-slate-500">{skill.description}</p>}

      <section className="mt-3 overflow-hidden rounded-xl border border-[#E7E3F6] bg-white">
        {/* The learner card at a glance. Six authoring fields sit behind one toggle so the
            page leads with the questions, but a validation problem always forces them open. */}
        <div className="flex items-center gap-2.5 p-2.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E7E3F6] bg-[#FBFAFF]">
            {selectedLibraryAsset ? (
              <CountingAsset
                type="custom_svg"
                customSvgMarkup={selectedLibraryAsset.markup}
                size={38}
                scale={1}
              />
            ) : (
              <img
                src={thumbnail.url}
                alt={`${skill.label} thumbnail preview`}
                className="h-full w-full object-contain"
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#0E0B55]">
              {skill.presentation?.title || skill.label}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#6D6997]">
              <span
                className={`inline-flex items-center gap-1 font-medium ${minutesLabel ? "text-[#6D6997]" : "text-[#B7B2CC]"}`}
                title={minutesLabel ? "Authored duration shown on the learner card" : "No duration authored yet"}
              >
                <Clock size={10} /> {minutesLabel ?? "No time set"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Zap size={10} />
                {typeof skill.completionXp === "number" ? `${skill.completionXp} XP` : "Default XP"}
              </span>
              <span className="capitalize">{skill.presentation?.accent || "purple"}</span>
              <span className="truncate">{thumbnailSourceLabel}</span>
            </div>
          </div>
          {presentationIssue ? (
            <Badge variant="warning" className="shrink-0">Needs attention</Badge>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="shrink-0"
              onClick={() => setPresentationOpen(open => !open)}
            >
              {presentationOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {presentationOpen ? "Done" : "Edit card"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[#EEEAF8] bg-[#FBFAFF]/70 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEEAFE] text-[#534AB7]">
            <Compass size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="koda-admin-label font-medium text-[#0E0B55]">Placement checkpoint</p>
            <p className="text-[10px] leading-relaxed text-[#6D6997]">
              Sample 1–2 published, gradable questions from this skill during placement.
            </p>
          </div>
          <Switch
            size="sm"
            checked={skill.placementCheckpoint === true}
            onCheckedChange={checked => onUpdateSkill({ placementCheckpoint: checked || undefined })}
            aria-label={`Use ${skill.label} as a placement checkpoint`}
          />
        </div>

        {showPresentationFields && (
        <div className="grid gap-3 border-t border-[#EEEAF8] p-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="skill-concept-id">Concept id</Label>
            <Input
              id="skill-concept-id"
              maxLength={120}
              className="font-mono"
              value={skill.conceptId ?? ""}
              placeholder="number.place-value.make-a-ten"
              onChange={event => onUpdateSkill({ conceptId: event.target.value.trim() || undefined })}
              aria-invalid={conceptIdInvalid || undefined}
            />
            <p className="text-[10px] leading-relaxed text-[#6D6997]">
              What this skill teaches, named the same way in every grade that touches it. Lets a
              later grade name this as a prerequisite and review it. Optional, but a published
              release keeps whatever it was given — releases are immutable.
            </p>
            {conceptIdInvalid && (
              <p className="text-[10px] font-medium text-rose-600">
                Use dotted lowercase words, e.g. <span className="font-mono">number.counting.to-20</span>.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-student-title">Student title</Label>
            <Input
              id="skill-student-title"
              maxLength={120}
              value={skill.presentation?.title || ""}
              placeholder={skill.label}
              onChange={event => onUpdateSkill({
                presentation: { ...skill.presentation, title: event.target.value },
              })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="skill-thumbnail">Thumbnail path or URL</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setThumbnailPickerOpen(true)}
                >
                  <Images size={11} /> Browse
                </Button>
              {(selectedLibraryAssetId || thumbnail.source === "curriculum") && thumbnail.componentDefaultUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onUpdateSkill({
                    presentation: {
                      ...skill.presentation,
                      thumbnailUrl: undefined,
                      thumbnailAssetId: undefined,
                    },
                  })}
                >
                  Use component default
                </Button>
              )}
              </div>
            </div>
            <Input
              id="skill-thumbnail"
              maxLength={20000}
              value={skill.presentation?.thumbnailUrl || ""}
              placeholder={
                selectedLibraryAsset
                  ? `Selected from library: ${selectedLibraryAsset.label}`
                  : selectedLibraryAssetId
                    ? "Selected SVG is no longer in the library"
                  : thumbnail.componentDefaultUrl || "/assets/owl-mascot.svg"
              }
              onPaste={event => {
                const pasted = event.clipboardData.getData("text");
                if (pasted.trim().toLowerCase().startsWith("<svg")) {
                  event.preventDefault();
                  attachPastedMarkup(pasted);
                }
              }}
              onChange={event => {
                const value = event.target.value;
                if (value.trim().toLowerCase().startsWith("<svg")) {
                  attachPastedMarkup(value);
                  return;
                }
                onUpdateSkill({
                  presentation: {
                    ...skill.presentation,
                    thumbnailUrl: value,
                    thumbnailAssetId: undefined,
                  },
                });
              }}
            />
            <p className="text-[10px] leading-relaxed text-[#8D89AE]">
              Browse your shared SVG Library, paste an app path/HTTP URL, or paste SVG markup
              straight in — markup is saved to your library and linked. Empty uses the first
              question component’s default artwork.
            </p>
            {markupError && <p className="text-[10px] font-medium text-rose-600">{markupError}</p>}
            {!markupError && markupNotice && (
              <p className="text-[10px] font-medium text-emerald-700">{markupNotice}</p>
            )}
            {missingLibraryAsset && (
              <p className="text-[10px] font-medium text-rose-600">
                This SVG was removed from the library. Choose another thumbnail before publishing.
              </p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="skill-student-description">Student description</Label>
            <Textarea
              id="skill-student-description"
              rows={2}
              maxLength={300}
              value={skill.presentation?.description || ""}
              placeholder={skill.description || "A short, encouraging description"}
              onChange={event => onUpdateSkill({
                presentation: { ...skill.presentation, description: event.target.value },
              })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-accent">Accent</Label>
            <Select
              id="skill-accent"
              value={skill.presentation?.accent || "purple"}
              onChange={event => onUpdateSkill({
                presentation: {
                  ...skill.presentation,
                  accent: event.target.value as NonNullable<Skill["presentation"]>["accent"],
                },
              })}
            >
              {["purple", "blue", "green", "amber", "pink"].map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-estimated-minutes">
              <span className="inline-flex items-center gap-1"><Clock size={12} /> Estimated minutes</span>
            </Label>
            <Input
              id="skill-estimated-minutes"
              type="number"
              min={SKILL_MINUTES_MIN}
              max={SKILL_MINUTES_MAX}
              value={skill.presentation?.estimatedMinutes ?? ""}
              placeholder="Shown on the learner card"
              onChange={event => onUpdateSkill({
                presentation: {
                  ...skill.presentation,
                  estimatedMinutes: event.target.value === "" ? undefined : Number(event.target.value),
                },
              })}
            />
            {estimatedMinutesInvalid && (
              <p className="text-[11px] font-medium text-rose-600">
                Use a whole number from {SKILL_MINUTES_MIN}–{SKILL_MINUTES_MAX}.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-completion-xp">
              <span className="inline-flex items-center gap-1"><Zap size={12} /> Completion XP override</span>
            </Label>
            <Input
              id="skill-completion-xp"
              type="number"
              min={0}
              max={100}
              value={skill.completionXp ?? ""}
              placeholder="Curriculum default"
              onChange={event => onUpdateSkill({
                completionXp: event.target.value === "" ? undefined : Number(event.target.value),
              })}
            />
            {completionXpInvalid && (
              <p className="text-[11px] font-medium text-rose-600">Use a whole number from 0–100.</p>
            )}
          </div>
        </div>
        )}
      </section>

      <div className="mb-2 mt-3.5 flex flex-wrap items-center gap-2">
        <h2 className="koda-admin-section-title text-sm text-[#0E0B55]">Questions</h2>
        <span className={`koda-admin-chip text-[10px] ${coverage.shortfall === 0 ? "text-emerald-700" : "text-amber-700"}`}>
          {coverageLabel}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="xs" onClick={onAddQuestion}>
            <Plus size={12} /> Add
          </Button>
          <Button size="xs" variant="secondary" onClick={onFillWithAi}>
            <Sparkles size={12} /> Fill with AI
          </Button>
          <Button
            size="xs"
            variant={isReordering ? "default" : "outline"}
            onClick={() => setIsReordering(v => !v)}
            disabled={skillQuestions.length < 2}
          >
            <ListOrdered size={12} /> {isReordering ? "Done" : "Reorder"}
          </Button>
        </div>
      </div>

      {skillQuestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-400">No questions yet — add one or fill this skill with AI.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {skillQuestions.map((q, index) => (
            <article
              key={q.id}
              className="group flex min-w-0 flex-col rounded-xl border border-[#E7E3F6] bg-white px-3 py-2 transition-colors hover:border-[#CFC7EE]"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className="koda-admin-chip mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F2F0FA] px-1.5 text-[10px] leading-none text-[#6D6997]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="koda-admin-card-title truncate text-xs leading-4 text-[#24213F]" title={q.title}>{q.title}</h3>
                  {q.instruction && (
                    <p className="mt-0.5 truncate text-[10px] text-[#8D89AE]" title={q.instruction}>
                      {q.instruction}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onPreviewQuestion(q.id)}
                    title="Preview question"
                    aria-label={`Preview ${q.title}`}
                    className="h-7 w-7 p-0 text-[#A8A3BF] hover:text-[#534AB7]"
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onEditQuestion(q.id)}
                    title="Edit question"
                    aria-label={`Edit ${q.title}`}
                    className="h-7 w-7 p-0 text-[#A8A3BF] hover:text-[#534AB7]"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onDeleteQuestion(q.id)}
                    title="Delete question"
                    aria-label={`Delete ${q.title}`}
                    className="h-7 w-7 p-0 text-[#C0BBD1] hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1 pl-7">
                <span
                  className="koda-admin-chip max-w-full truncate rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[10px] leading-4 text-[#534AB7]"
                  title={formatTechniqueLabel(q.technique)}
                >
                  {formatTechniqueLabel(q.technique)}
                </span>
                <span className="koda-admin-chip rounded-full bg-[#F7F6FB] px-2 py-0.5 text-[10px] leading-4 capitalize text-[#6D6997]">
                  {q.difficulty || "medium"}
                </span>
                <span className="koda-admin-chip ml-auto whitespace-nowrap text-[10px] leading-4 text-[#6D6997]">
                  Target <strong className="ml-0.5 text-[#24213F]">{q.targetCount}</strong>
                </span>
              </div>

              {isReordering && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-[#EEEAF8] pt-2 pl-7">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="flex-1"
                  >
                    <ArrowUp size={11} /> Up
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === skillQuestions.length - 1}
                    className="flex-1"
                  >
                    <ArrowDown size={11} /> Down
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog
        isOpen={thumbnailPickerOpen}
        onClose={() => {
          setThumbnailPickerOpen(false);
          setThumbnailQuery("");
        }}
        maxWidthClassName="max-w-3xl"
      >
        <div className="pr-8">
          <h3 className="koda-admin-section-title flex items-center gap-2 text-[#0E0B55]">
            <FolderHeart size={18} className="text-[#534AB7]" /> Choose thumbnail
          </h3>
          <p className="koda-admin-label mt-1 text-[#6D6997]">
            Select reusable artwork from the same SVG Library used by Interactive Studio.
          </p>
        </div>

        <div className="relative mt-4">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8D89AE]"
          />
          <Input
            value={thumbnailQuery}
            onChange={event => setThumbnailQuery(event.target.value)}
            placeholder="Search thumbnails…"
            aria-label="Search thumbnail collection"
            className="pl-9"
          />
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="koda-admin-card-title text-[#0E0B55]">My SVG Library</h4>
            <span className="koda-admin-chip text-[#8D89AE]">
              {svgPersistenceStatus === "loading" ? "Loading…" : `${visibleSvgAssets.length} assets`}
            </span>
          </div>
          {visibleSvgAssets.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {visibleSvgAssets.map(asset => {
                const selected = skill.presentation?.thumbnailAssetId === asset.id;
                return (
                  <button
                    type="button"
                    key={asset.id}
                    onClick={() => {
                      onUpdateSkill({
                        presentation: {
                          ...skill.presentation,
                          thumbnailUrl: undefined,
                          thumbnailAssetId: asset.id,
                        },
                      });
                      setThumbnailPickerOpen(false);
                      setThumbnailQuery("");
                    }}
                    className={`relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                      selected
                        ? "border-[#534AB7] bg-[#F3F0FF]"
                        : "border-[#E7E3F6] bg-[#FBFAFF] hover:border-[#7C6DD8] hover:bg-[#F4F1FD]"
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#534AB7] text-white">
                        <Check size={12} />
                      </span>
                    )}
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-white">
                      <CountingAsset
                        type="custom_svg"
                        customSvgMarkup={asset.markup}
                        size={56}
                        scale={1}
                      />
                    </span>
                    <span className="koda-admin-label line-clamp-2 text-[#0E0B55]">{asset.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-[#DCD6F2] bg-[#FBFAFF] px-4 py-6 text-center">
              <p className="koda-admin-label text-[#6D6997]">
                {svgAssets.length === 0
                  ? "No saved SVGs yet. Create one in Interactive Studio → SVG Library."
                  : "No SVG thumbnails match your search."}
              </p>
            </div>
          )}
        </section>

        <section className="mt-5 border-t border-[#EEEAF8] pt-4">
          <h4 className="koda-admin-card-title text-[#0E0B55]">Component artwork</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {visibleThumbnailOptions.map(option => {
              const selected = skill.presentation?.thumbnailUrl === option.url;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => {
                    onUpdateSkill({
                      presentation: {
                        ...skill.presentation,
                        thumbnailUrl: option.url,
                        thumbnailAssetId: undefined,
                      },
                    });
                    setThumbnailPickerOpen(false);
                    setThumbnailQuery("");
                  }}
                  className={`relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                    selected
                      ? "border-[#534AB7] bg-[#F3F0FF]"
                      : "border-[#E7E3F6] bg-[#FBFAFF] hover:border-[#7C6DD8] hover:bg-[#F4F1FD]"
                  }`}
                >
                  {selected && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#534AB7] text-white">
                      <Check size={12} />
                    </span>
                  )}
                  <img src={option.url} alt="" className="h-16 w-16 rounded-lg bg-white object-contain" />
                  <span className="koda-admin-label line-clamp-2 text-[#0E0B55]">{option.label}</span>
                  <span className="koda-admin-chip text-[#8D89AE]">{option.source}</span>
                </button>
              );
            })}
          </div>
        </section>
      </Dialog>
    </div>
  );
};
