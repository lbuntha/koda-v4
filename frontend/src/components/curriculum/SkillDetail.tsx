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
  Eye,
  FolderHeart,
  Image,
  Images,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { CountingQuestion } from "../../types";
import { CurriculumTree, Skill, SkillCoverage, getSkillPath, formatSkillPath } from "../../curriculum/types";
import { filterAndSortBySkill, formatTechniqueLabel } from "./questionOps";
import { Badge, Button, Dialog, Input, Label, Select, Textarea } from "../ui";
import { ALL_TECHNIQUES, resolveTechniqueThumbnail } from "../../techniques";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";
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
  const [thumbnailPickerOpen, setThumbnailPickerOpen] = useState(false);
  const [thumbnailQuery, setThumbnailQuery] = useState("");
  const { assets: svgAssets, persistenceStatus: svgPersistenceStatus } = useSvgLibrary();
  const completionXpInvalid = (
    skill.completionXp !== undefined
    && (!Number.isInteger(skill.completionXp) || skill.completionXp < 0 || skill.completionXp > 100)
  );

  const skillQuestions = filterAndSortBySkill(questions, skill.id);
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
  const thumbnailOptions = [
    ...ALL_TECHNIQUES
      .filter(manifest => manifest.defaultThumbnailUrl)
      .map(manifest => ({
        id: `component:${manifest.technique}`,
        label: formatTechniqueLabel(manifest.technique),
        url: manifest.defaultThumbnailUrl!,
        source: "Component artwork",
      })),
    {
      id: "generic:owl",
      label: "Koda owl",
      url: "/assets/owl-mascot.svg",
      source: "Generic artwork",
    },
  ];
  const normalizedThumbnailQuery = thumbnailQuery.trim().toLowerCase();
  const visibleSvgAssets = svgAssets.filter(asset =>
    !normalizedThumbnailQuery || asset.label.toLowerCase().includes(normalizedThumbnailQuery)
  );
  const visibleThumbnailOptions = thumbnailOptions.filter(option =>
    !normalizedThumbnailQuery
    || `${option.label} ${option.source}`.toLowerCase().includes(normalizedThumbnailQuery)
  );

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= skillQuestions.length) return;
    const orderedIds = skillQuestions.map(q => q.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];
    onReorderQuestions(orderedIds);
  };

  return (
    <div className="p-6 md:p-8">
      {path && (
        <span className="block text-2xs font-mono uppercase tracking-widest text-slate-400 mb-1.5">
          {formatSkillPath(path)}
        </span>
      )}
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-xl font-extrabold text-slate-800">{skill.label}</h1>
        <Badge variant={coverage.isComplete ? "success" : "warning"}>
          {coverage.questionCount}/{coverage.minQuestions}
        </Badge>
      </div>
      {skill.description && <p className="text-xs text-slate-500 mb-1">{skill.description}</p>}
      {skill.standardRef && <span className="text-2xs font-mono text-slate-400">{skill.standardRef}</span>}

      <section className="mt-5 rounded-2xl border border-[#E7E3F6] bg-white p-4 shadow-[0_2px_12px_rgba(83,74,183,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]">
              <Image size={16} className="text-[#534AB7]" /> Student presentation
            </h2>
            <p className="koda-admin-label mt-1 text-[#6D6997]">
              The published values shown on this skill’s learner card.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-[#E7E3F6] bg-[#FBFAFF]">
              {selectedLibraryAsset ? (
                <CountingAsset
                  type="custom_svg"
                  customSvgMarkup={selectedLibraryAsset.markup}
                  size={56}
                  scale={1}
                />
              ) : (
                <img
                  src={thumbnail.url}
                  alt={`${skill.label} thumbnail preview`}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <Badge variant="outline" className="max-w-40 truncate text-[9px]">
              {thumbnailSourceLabel}
            </Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
              maxLength={500}
              value={skill.presentation?.thumbnailUrl || ""}
              placeholder={
                selectedLibraryAsset
                  ? `Selected from library: ${selectedLibraryAsset.label}`
                  : selectedLibraryAssetId
                    ? "Selected SVG is no longer in the library"
                  : thumbnail.componentDefaultUrl || "/assets/owl-mascot.svg"
              }
              onChange={event => onUpdateSkill({
                presentation: {
                  ...skill.presentation,
                  thumbnailUrl: event.target.value,
                  thumbnailAssetId: undefined,
                },
              })}
            />
            <p className="text-[10px] leading-relaxed text-[#8D89AE]">
              Browse your shared SVG Library or paste an app path/HTTP URL. Empty uses the first
              question component’s default artwork.
            </p>
            {selectedLibraryAssetId && !selectedLibraryAsset && svgPersistenceStatus !== "loading" && (
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
      </section>

      <div className="flex items-center gap-2 mt-6 mb-4">
        <Button size="sm" onClick={onAddQuestion} className="gap-1.5">
          <Plus size={13} /> Add Question
        </Button>
        <Button size="sm" variant="secondary" onClick={onFillWithAi} className="gap-1.5">
          <Sparkles size={13} /> Fill with AI
        </Button>
        <Button
          size="sm"
          variant={isReordering ? "default" : "outline"}
          onClick={() => setIsReordering(v => !v)}
          className="gap-1.5 ml-auto"
          disabled={skillQuestions.length < 2}
        >
          <ListOrdered size={13} /> {isReordering ? "Done Reordering" : "Reorder"}
        </Button>
      </div>

      {skillQuestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-xs text-slate-400">No questions yet — add one or fill this skill with AI.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {skillQuestions.map((q, index) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-700 leading-snug flex-1 truncate">{q.title}</h4>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onPreviewQuestion(q.id)}
                    title="Preview question"
                    className="text-slate-300 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => onEditQuestion(q.id)}
                    title="Edit question"
                    className="text-slate-300 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDeleteQuestion(q.id)}
                    title="Delete question"
                    className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-2xs">{formatTechniqueLabel(q.technique)}</Badge>
                <span className="text-2xs font-mono text-slate-400">target {q.targetCount}</span>
              </div>

              {isReordering && (
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 mt-1">
                  <button
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default text-2xs font-bold cursor-pointer"
                  >
                    <ArrowUp size={11} /> Up
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === skillQuestions.length - 1}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default text-2xs font-bold cursor-pointer"
                  >
                    <ArrowDown size={11} /> Down
                  </button>
                </div>
              )}
            </div>
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
