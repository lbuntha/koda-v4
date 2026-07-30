/**
 * AiGeneratorPanel — AI-powered slide generator.
 *
 * Technique-agnostic: the prompt is matched to a ComponentSchema, which
 * supplies the system prompt, presets, validation, and (optionally) an
 * offline rule-based fallback. To support a new canvas, register its schema —
 * this panel needs no changes.
 *
 * Uses the authenticated backend AI proxy when configured, otherwise falls
 * back to the schema's offline generator.
 *
 * Two operating modes: normal (Studio tab — "Apply to Current Slide"/"Apply
 * All N Slides" may overwrite activeQuestion) vs. skill-scoped append-only
 * (targetSkillId set — those two destructive actions are hidden entirely and
 * every generated slide is stamped with skillId, added only via onAddSlides).
 */

import React, { useState, useRef } from "react";
import { Sparkles, Wand2, Zap, Layers, ArrowRight, AlertCircle, Database } from "lucide-react";
import { CountingQuestion, CountingTechnique } from "../../../types";
import { sounds } from "../../../sound";
import { Button, Label, Badge } from "../../ui";
import { generateWithAI } from "./openaiService";
import { detectTechniqueFromPrompt, getSchemaByTechnique, SCHEMA_REGISTRY } from "./schemas";
import { GenerationStep } from "./types";
import { useAppSettings } from "../../../settings/AppSettingsContext";
import { useSvgLibrary } from "../../../assets/SvgLibraryContext";

interface AiGeneratorPanelProps {
  activeQuestion: CountingQuestion;
  questions: CountingQuestion[];
  updateActiveQuestion: (patch: Partial<CountingQuestion>) => void;
  onAddSlides?: (slides: CountingQuestion[]) => void;
  onSwitchToVisual?: () => void;
  /** When set, every generated slide is stamped with this skillId and the destructive "apply" actions are hidden — see the file-level comment. */
  targetSkillId?: string;
  initialPrompt?: string;
  initialBatchCount?: number;
}

export const AiGeneratorPanel: React.FC<AiGeneratorPanelProps> = ({
  activeQuestion,
  questions,
  updateActiveQuestion,
  onAddSlides,
  onSwitchToVisual,
  targetSkillId,
  initialPrompt,
  initialBatchCount
}) => {
  const [prompt, setPrompt] = useState<string>(initialPrompt ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [generatedPreview, setGeneratedPreview] = useState<CountingQuestion | null>(null);
  const [batchMode, setBatchMode] = useState((initialBatchCount ?? 1) > 1);
  const [batchCount, setBatchCount] = useState(initialBatchCount ?? 3);
  const [batchResults, setBatchResults] = useState<CountingQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings } = useAppSettings();
  const { assets: customAssets, persistenceStatus: assetPersistenceStatus } = useSvgLibrary();
  const isOpenAI = settings.api_key_configured;

  const GENERATION_STEPS_OPENAI: string[] = [
    "Connecting to OpenAI...",
    "Sending prompt to the model...",
    "Analyzing pedagogy & assets...",
    "Parsing AI response...",
    "Validating slide schema ✨"
  ];

  const GENERATION_STEPS_LOCAL: string[] = [
    "Analyzing educational pedagogy...",
    "Selecting high-contrast assets...",
    "Computing visual layout...",
    "Generating instruction text...",
    "Configuring slide schema ✨"
  ];

  const runGeneration = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedPreview(null);
    setBatchResults([]);
    setSteps([]);
    setError(null);
    sounds.playPop();

    const stepLabels = isOpenAI ? GENERATION_STEPS_OPENAI : GENERATION_STEPS_LOCAL;

    try {
      if (isOpenAI) {
        // Show first 2 steps immediately
        setSteps([{ label: stepLabels[0], done: true }]);
        await new Promise(r => setTimeout(r, 300));
        setSteps(prev => [...prev, { label: stepLabels[1], done: true }]);

        // Call OpenAI
        const slideCount = batchMode ? batchCount : 1;
        const slides = await generateWithAI(prompt, slideCount, questions, customAssets);
        const stamped = targetSkillId ? slides.map(s => ({ ...s, skillId: targetSkillId })) : slides;

        // Show remaining steps
        for (let i = 2; i < stepLabels.length; i++) {
          await new Promise(r => setTimeout(r, 200));
          setSteps(prev => [...prev, { label: stepLabels[i], done: true }]);
        }

        if (batchMode) {
          setBatchResults(stamped as CountingQuestion[]);
        } else {
          setGeneratedPreview(stamped[0] as CountingQuestion);
        }
      } else {
        // Rule-based fallback with animated steps
        for (let i = 0; i < stepLabels.length; i++) {
          await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
          setSteps(prev => [...prev, { label: stepLabels[i], done: true }]);
        }

        await new Promise(r => setTimeout(r, 200));

        const schema = detectTechniqueFromPrompt(prompt);
        if (!schema.offlineFallback) {
          throw new Error(`"${schema.name}" needs an OpenAI key — it has no offline generator.`);
        }
        const slides = schema.offlineFallback(prompt, batchMode ? batchCount : 1);
        const stamped = targetSkillId ? slides.map(s => ({ ...s, skillId: targetSkillId })) : slides;
        if (batchMode) {
          setBatchResults(stamped.map(s => ({ ...s, config: { ...s.config } } as CountingQuestion)));
        } else {
          setGeneratedPreview({ ...stamped[0], config: { ...stamped[0].config } } as CountingQuestion);
        }
      }

      sounds.playSuccess();
    } catch (err: any) {
      setError(err.message || "Generation failed. Please try again.");
      sounds.playFailure();
    } finally {
      setIsGenerating(false);
    }
  };

  const applyToCurrentSlide = () => {
    if (!generatedPreview) return;
    sounds.playPop();
    updateActiveQuestion({
      technique: generatedPreview.technique,
      title: generatedPreview.title,
      instruction: generatedPreview.instruction,
      objectId: generatedPreview.objectId,
      targetCount: generatedPreview.targetCount,
      config: { ...generatedPreview.config }
    });
    onSwitchToVisual?.();
  };

  const addAsNewSlide = (slide: CountingQuestion) => {
    if (onAddSlides) {
      sounds.playPop();
      onAddSlides([slide]);
    }
  };

  const applyBatchSlides = () => {
    if (batchResults.length === 0) return;
    sounds.playPop();
    const [first, ...rest] = batchResults;
    updateActiveQuestion({
      technique: first.technique,
      title: first.title,
      instruction: first.instruction,
      objectId: first.objectId,
      targetCount: first.targetCount,
      config: { ...first.config }
    });
    if (rest.length > 0 && onAddSlides) {
      onAddSlides(rest);
    }
    onSwitchToVisual?.();
  };

  const selectPreset = (presetPrompt: string) => {
    setPrompt(presetPrompt);
    setGeneratedPreview(null);
    setBatchResults([]);
    setSteps([]);
    setError(null);
    sounds.playTock();
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Dynamic prompt helper tip based on detected schema
  const detectedSchema = detectTechniqueFromPrompt(prompt || activeQuestion.instruction || "");

  /**
   * Preset chips follow the teacher's context: the active slide's component
   * first, then the prompt-detected one, then a taste of the others — so a
   * teacher editing a Subtraction slide sees subtraction suggestions, while
   * still discovering that other components exist.
   */
  const activeSchema = getSchemaByTechnique(activeQuestion.technique);
  const contextPresets = (() => {
    const primary = activeSchema?.presets ?? [];
    const secondary = detectedSchema !== activeSchema ? detectedSchema.presets : [];
    const rest = SCHEMA_REGISTRY
      .filter(sch => sch !== activeSchema && sch !== detectedSchema)
      .flatMap(sch => sch.presets.slice(0, 2));
    const seen = new Set<string>();
    return [...primary, ...secondary, ...rest]
      .filter(pr => (seen.has(pr.id) ? false : (seen.add(pr.id), true)))
      .slice(0, 8);
  })();
  const dynamicTip = detectedSchema.tip || "Describe your math activity and we'll configure it.";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Wand2 size={15} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">AI Activity Generator</h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {isOpenAI ? "Powered by OpenAI" : "Using built-in engine"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Mode Indicator ── */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold ${
        isOpenAI
          ? "bg-indigo-50/70 border-indigo-100 text-indigo-700"
          : "bg-slate-50 border-slate-200 text-slate-500"
      }`}>
        <span className={`w-2 h-2 rounded-full ${isOpenAI ? "bg-indigo-500 animate-pulse" : "bg-slate-400"}`} />
        {isOpenAI ? "OpenAI Mode — smarter, creative generation" : "Built-in Engine — fast, rule-based generation"}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[#E7E3F6] bg-[#FBFAFF] px-3 py-2 text-[10px] font-medium text-[#6D6997]">
        <Database size={12} className="shrink-0 text-[#534AB7]" />
        <span>
          {assetPersistenceStatus === "loading"
            ? "Loading MongoDB asset library…"
            : assetPersistenceStatus === "saved"
              ? `MongoDB library connected · ${customAssets.length} custom asset${customAssets.length === 1 ? "" : "s"} available to AI`
              : `${customAssets.length} cached custom asset${customAssets.length === 1 ? "" : "s"} available · MongoDB offline`}
        </span>
      </div>

      {/* ── Prompt Input ── */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-indigo-500" />
          Describe your activity
        </Label>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setError(null); }}
          placeholder={isOpenAI
            ? 'e.g. "Create a fun ocean adventure where kids count 6 colorful fish swimming into a coral reef aquarium"'
            : 'e.g. "Move 5 fish from the bowl into the aquarium"'
          }
          rows={3}
          className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white
            focus:ring-2 focus:ring-indigo-100/50 focus:border-indigo-500 outline-none
            placeholder:text-slate-300 font-medium leading-relaxed resize-none transition-all"
        />
      </div>

      {/* ── Quick Presets ── */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <Zap size={10} className="text-indigo-500" />
          Quick Prompts
        </label>
        <div className="flex flex-wrap gap-1.5">
          {contextPresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset.prompt)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold
                transition-all duration-200 cursor-pointer
                ${prompt === preset.prompt
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-100/60 shadow-sm"
                  : "bg-white border-slate-150 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
            >
              <span className="text-sm">{preset.emoji}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Batch Mode Toggle ── */}
      <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-indigo-500" />
          <div>
            <span className="text-[11px] font-bold text-slate-700">Batch Generate</span>
            <p className="text-[9px] text-slate-400 font-medium">Create multiple slides at once</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {batchMode && (
            <select
              value={batchCount}
              onChange={(e) => setBatchCount(parseInt(e.target.value))}
              className="text-[10px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white font-bold text-slate-700 cursor-pointer outline-none focus:border-indigo-500"
            >
              {Array.from(new Set([2, 3, 5, batchCount])).sort((a, b) => a - b).map(n => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          )}
          <input
            type="checkbox"
            checked={batchMode}
            onChange={(e) => setBatchMode(e.target.checked)}
            className="w-4 h-4 accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>

      {/* ── Generate Button ── */}
      <Button
        onClick={runGeneration}
        disabled={!prompt.trim() || isGenerating}
        className={`w-full font-bold text-xs tracking-wide transition-all duration-300 border-0 cursor-pointer
          ${isGenerating
            ? "bg-slate-250 text-slate-450 cursor-wait animate-pulse"
            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow shadow-indigo-600/10"
          }`}
      >
        <Wand2 size={14} className={isGenerating ? "animate-spin" : ""} />
        {isGenerating
          ? "Generating..."
          : batchMode
            ? `Generate ${batchCount} Slides ${isOpenAI ? "with AI" : ""} ✨`
            : `Generate Slide ${isOpenAI ? "with AI" : ""} ✨`
        }
      </Button>

      {/* ── Error Display ── */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in">
          <AlertCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-rose-700">Generation Failed</p>
            <p className="text-[10px] text-rose-600 mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* ── Generation Progress Steps ── */}
      {steps.length > 0 && (
        <div className="space-y-1.5 p-3 bg-slate-900 rounded-xl border border-slate-800">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0
                ${step.done ? "bg-emerald-500 text-white" : "bg-slate-750 text-slate-500 animate-pulse"}`}>
                {step.done ? "✓" : "…"}
              </span>
              <span className={step.done ? "text-emerald-400" : "text-slate-400"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Single Slide Preview ── */}
      {generatedPreview && !batchMode && (
        <div className="space-y-3 animate-fade-in">
          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1">
            <Sparkles size={10} className="text-indigo-500" />
            Generated Preview
          </label>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">{generatedPreview.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{generatedPreview.instruction}</p>
              </div>
              <Badge variant="secondary" className="bg-indigo-50 text-indigo-750 text-[9px] px-1.5 py-0 flex-shrink-0 border border-indigo-100 font-bold">
                {generatedPreview.targetCount} items
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-1">
              {generatedPreview.config.frameColor && (
                <span className="text-[9px] px-2 py-0.5 bg-white border border-slate-200 rounded-md font-bold text-slate-500">
                  🎨 {generatedPreview.config.frameColor}
                </span>
              )}
              {generatedPreview.config.sourceBinLabel && generatedPreview.config.destinationBinLabel && (
                <span className="text-[9px] px-2 py-0.5 bg-white border border-slate-200 rounded-md font-bold text-slate-500">
                  📦 {generatedPreview.config.sourceBinLabel} → {generatedPreview.config.destinationBinLabel}
                </span>
              )}
              {generatedPreview.config.assetType && (
                <span className="text-[9px] px-2 py-0.5 bg-white border border-slate-200 rounded-md font-bold text-slate-500">
                  🖼 {generatedPreview.config.assetType}
                </span>
              )}
              <span className="text-[9px] px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md font-bold text-indigo-700 uppercase tracking-wide">
                ⚙️ {generatedPreview.technique.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              {!targetSkillId && (
                <Button
                  onClick={applyToCurrentSlide}
                  size="sm"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold border-0 cursor-pointer"
                >
                  <ArrowRight size={12} />
                  Apply to Current Slide
                </Button>
              )}
              {onAddSlides && (
                <Button
                  onClick={() => addAsNewSlide(generatedPreview)}
                  size="sm"
                  variant="outline"
                  className={targetSkillId ? "flex-1 text-[10px] font-bold cursor-pointer" : "text-[10px] font-bold cursor-pointer"}
                >
                  + {targetSkillId ? "Add to Skill" : "New Slide"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Results Preview ── */}
      {batchResults.length > 0 && batchMode && (
        <div className="space-y-3 animate-fade-in">
          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1">
            <Layers size={10} className="text-indigo-500" />
            Generated {batchResults.length} Slides
          </label>

          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {batchResults.map((slide, i) => (
              <div key={slide.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 truncate">{slide.title}</p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {slide.targetCount} items 
                    {slide.config?.destinationBinLabel ? ` • ${slide.config.destinationBinLabel}` : ""}
                    {` • ${slide.technique.replace(/_/g, " ")}`}
                  </p>
                </div>
                {onAddSlides && (
                  <button
                    onClick={() => addAsNewSlide(slide)}
                    className="text-[9px] px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-bold hover:bg-indigo-100 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>

          {!targetSkillId && (
            <Button
              onClick={applyBatchSlides}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold border-0 cursor-pointer"
            >
              <Sparkles size={12} />
              Apply All {batchResults.length} Slides
            </Button>
          )}
          {targetSkillId && onAddSlides && (
            <Button
              onClick={() => onAddSlides(batchResults)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold border-0 cursor-pointer"
            >
              <Sparkles size={12} />
              Add all {batchResults.length} to this skill
            </Button>
          )}
        </div>
      )}

      {/* ── Tip ── */}
      {/* Sky, not amber: this is advice, not a warning — and it must stay readable, so no
          pulse fading the text in and out. */}
      <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[10px] text-sky-800 font-medium leading-relaxed">
        💡 <strong>Tip:</strong> {isOpenAI
          ? `With AI you can be more descriptive! E.g. "${dynamicTip}"`
          : dynamicTip
        }
      </div>
    </div>
  );
};
