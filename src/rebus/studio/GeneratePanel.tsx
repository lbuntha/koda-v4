/**
 * Draft a batch of puzzles with a model, and keep the good ones.
 *
 * The form asks for four things: a topic, who it is for, how many, and an
 * optional note. Exact ages, difficulty, tricks, the provider and the prompt
 * behind it sit under "More options", the prompt saved as numbered versions so a
 * good batch can be repeated. What comes back is shown as cards with the checks
 * each already passed or failed: the model chose only from the drawing library,
 * a second call tried to solve each from its pictures alone, and anything already
 * in the bank is marked. The author ticks the ones to keep and either adds them
 * to review or approves them now. Nothing generated is ever live until it has
 * been approved and published.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Check, Save, Sparkles } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIAgePicker, UIBadge, UIButton, UIInput, UISelect, UITabs, UITextarea } from "../../components/ui";
import { CATEGORIES } from "../categories";
import { DEFAULT_SYSTEM_PROMPT } from "../generate/prompt";
import type { GeneratedPuzzle } from "../generate/pipeline";
import { TRICKS } from "../types";
import { LEVELS, levelOf, type LevelId } from "./levels";
import { PuzzleCard } from "./PuzzleCard";
import { generatePuzzles, StudioAPI, type GenerateResponse, type SavedPrompt, type StudioPuzzle } from "./studioApi";
import { messageOf } from "./useStudioAction";

/** How many to ask for at once. */
const COUNTS = [5, 10, 20] as const;

/** A candidate, drawn as a puzzle card so it is judged the way a saved puzzle is. */
const asCard = (g: GeneratedPuzzle, i: number): StudioPuzzle => ({
  ...g.draft,
  difficulty: g.draft.difficulty as StudioPuzzle["difficulty"],
  id: `candidate-${i}`,
  source: "ai",
  status: "draft",
  seeded: false,
  note: "",
  issues: g.checks.issues,
  checks: g.checks,
});

/** What is worth saving: not a repeat, not unsafe, and not waiting on a drawing that does not exist. */
export const worthSaving = (g: GeneratedPuzzle): boolean => g.checks.safe && !g.checks.issues.includes("duplicate") && !g.checks.issues.includes("unknown-icon");

export const GeneratePanel: React.FC<{ onSaved(): void }> = ({ onSaved }) => {
  const { t } = useT();
  const [category, setCategory] = useState("food");
  const [ages, setAges] = useState<[number, number]>([LEVELS[1].ages[0], LEVELS[1].ages[1]]);
  const [difficulty, setDifficulty] = useState<number>(LEVELS[1].difficulty);
  const [count, setCount] = useState(10);
  const [more, setMore] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [tricks, setTricks] = useState<string[]>(["compound"]);
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState<"sonnet" | "haiku">("sonnet");

  const [saved, setSaved] = useState<SavedPrompt[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [promptVersion, setPromptVersion] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);

  const [busy, setBusy] = useState<"generating" | "saving" | "approving" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [done, setDone] = useState("");

  useEffect(() => {
    let live = true;
    StudioAPI.prompts()
      .then((p) => {
        if (!live) return;
        setSaved(p.versions);
        if (p.latest) {
          setPrompt(p.latest.text);
          setPromptVersion(p.latest.version);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const cards = useMemo(() => (result ? result.puzzles.map(asCard) : []), [result]);
  const chosen = result ? result.puzzles.filter((g, i) => picked.has(i) && worthSaving(g)) : [];
  const missing = result ? [...new Set(result.puzzles.flatMap((g) => g.missingIcons))] : [];

  const toggleTrick = (k: string) => setTricks((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const run = async () => {
    setBusy("generating");
    setError("");
    setDone("");
    setResult(null);
    try {
      const r = await generatePuzzles({ brief: { category, ages, difficulty, count, tricks, notes }, provider: provider || undefined, model, systemPrompt: prompt !== DEFAULT_SYSTEM_PROMPT ? prompt : undefined });
      setResult(r);
      setPicked(new Set(r.puzzles.flatMap((g, i) => (worthSaving(g) ? [i] : []))));
    } catch (e) {
      setError(e instanceof Error ? e.message : messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const savePrompt = async () => {
    try {
      const row = await StudioAPI.savePrompt(prompt);
      setSaved((s) => [row, ...s]);
      setPromptVersion(row.version);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const keep = async (approve: boolean) => {
    if (!result) return;
    setBusy(approve ? "approving" : "saving");
    setError("");
    const runId = `run-${Date.now().toString(36)}`;
    let n = 0;
    try {
      for (const g of chosen) {
        await StudioAPI.create({ ...g.draft, ages: [g.draft.ages[0], g.draft.ages[1]], trick: g.draft.trick, source: "ai", checks: g.checks, runId, promptVersion, model: result.model, approve });
        n += 1;
      }
      setDone(t(approve ? "rebus.studio.approvedCount" : "rebus.studio.savedDrafts", { count: n }));
      setResult(null);
      onSaved();
    } catch (e) {
      setError(`${messageOf(e)} ${t("rebus.studio.savedSoFar", { count: n })}`);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (i: number) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const setLevel = (id: string) => {
    const level = LEVELS.find((l) => l.id === (id as LevelId));
    if (!level) return;
    setAges([level.ages[0], level.ages[1]]);
    setDifficulty(level.difficulty);
  };

  const stat = (label: string, value: number, tone: "primary" | "success" | "danger" | "neutral") => (
    <UIBadge key={label} variant={tone}>
      {value} {label}
    </UIBadge>
  );

  return (
    <section className="flex flex-col gap-5" aria-label={t("rebus.studio.aiTitle")}>
      <div>
        <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.aiTitle")}</h3>
        <p className={themeSystem.typography("body-sm", "mt-1")}>{t("rebus.studio.aiText")}</p>
      </div>

      <div className={themeSystem.card("default", `${themeSystem.spacing.card} grid gap-4 sm:grid-cols-2`)}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.topic")}</span>
          <UISelect value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(`rebus.categories.${c.id}`)}
              </option>
            ))}
          </UISelect>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.howMany")}</span>
          <UITabs label={t("rebus.studio.howMany")} items={COUNTS.map((n) => ({ id: String(n), label: String(n) }))} value={String(count)} onChange={(id) => setCount(Number(id))} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.level")}</span>
          <UITabs label={t("rebus.studio.level")} items={LEVELS.map((l) => ({ id: l.id, label: t(`rebus.studio.level_${l.id}`) }))} value={levelOf(ages, difficulty) ?? ""} onChange={setLevel} />
          <span className={themeSystem.typography("caption")}>{t("rebus.studio.levelLine", { min: ages[0], max: ages[1], difficulty: t(`rebus.studio.difficulty.${difficulty}`) })}</span>
        </div>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.notes")}</span>
          <UIInput value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder={t("rebus.studio.notesHint")} />
        </label>

        <div className="sm:col-span-2">
          <UIButton size="sm" variant="ghost" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            {more ? t("rebus.studio.fewerOptions") : t("rebus.studio.moreOptions")}
          </UIButton>
        </div>

        {more && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.difficultyLabel")}</span>
              <UITabs label={t("rebus.studio.difficultyLabel")} items={[1, 2, 3].map((d) => ({ id: String(d), label: t(`rebus.studio.difficulty.${d}`) }))} value={String(difficulty)} onChange={(id) => setDifficulty(Number(id))} />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.model")}</span>
              <UISelect value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">{t("rebus.studio.modelDefault")}</option>
                <option value="claude">Claude</option>
                <option value="openai">ChatGPT</option>
                <option value="gemini">Gemini</option>
              </UISelect>
            </label>
            <div className="sm:col-span-2">
              <UIAgePicker value={ages} onChange={(a) => setAges([a[0], a[1]])} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.tricks")}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("rebus.studio.tricks")}>
                {TRICKS.map((k) => (
                  <UIButton key={k} size="sm" variant={tricks.includes(k) ? "primary" : "secondary"} aria-pressed={tricks.includes(k)} onClick={() => toggleTrick(k)}>
                    {t(`rebus.studio.trickName.${k}`)}
                  </UIButton>
                ))}
              </div>
            </div>
            {(provider === "" || provider === "claude") && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.claudeModel")}</span>
                <UITabs label={t("rebus.studio.claudeModel")} items={[{ id: "sonnet", label: t("rebus.studio.sonnet") }, { id: "haiku", label: t("rebus.studio.haiku") }]} value={model} onChange={(id) => setModel(id as "sonnet" | "haiku")} />
              </div>
            )}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <UIButton variant="secondary" size="sm" aria-expanded={showPrompt} onClick={() => setShowPrompt((v) => !v)}>
                  {showPrompt ? t("rebus.studio.hidePrompt") : t("rebus.studio.showPrompt")}
                </UIButton>
                <UIBadge variant="neutral">{promptVersion ? t("rebus.studio.promptVersion", { n: promptVersion }) : t("rebus.studio.promptBuiltIn")}</UIBadge>
              </div>
              {showPrompt && (
                <>
                  <UITextarea aria-label={t("rebus.studio.promptLabel")} rows={14} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="font-mono !text-xs" />
                  <div className="flex flex-wrap gap-2">
                    <UIButton size="sm" variant="secondary" icon={<Save />} disabled={prompt.trim().length < 20} onClick={() => void savePrompt()}>
                      {t("rebus.studio.savePromptVersion", { n: (saved[0]?.version ?? 0) + 1 })}
                    </UIButton>
                    <UIButton size="sm" variant="ghost" onClick={() => { setPrompt(DEFAULT_SYSTEM_PROMPT); setPromptVersion(0); }}>
                      {t("rebus.studio.resetPrompt")}
                    </UIButton>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <UIButton size="lg" icon={<Sparkles />} isLoading={busy === "generating"} disabled={busy !== null} onClick={() => void run()}>
            {busy === "generating" ? t("rebus.studio.generating") : t("rebus.studio.generate", { count })}
          </UIButton>
        </div>
      </div>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" className={themeSystem.flash("success")}>
          {done}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4" aria-label={t("rebus.studio.results")}>
          <div className="flex flex-wrap items-center gap-2">
            {stat(t("rebus.studio.statDrafted"), result.stats.drafted, "primary")}
            {stat(t("rebus.studio.statValid"), result.stats.valid, "success")}
            {stat(t("rebus.studio.statSolved"), result.stats.solved, "success")}
            {result.stats.duplicates > 0 && stat(t("rebus.studio.statDuplicates"), result.stats.duplicates, "danger")}
            {result.stats.needIcons > 0 && stat(t("rebus.studio.statNeedIcons"), result.stats.needIcons, "danger")}
            {result.stats.unsafe > 0 && stat(t("rebus.studio.statUnsafe"), result.stats.unsafe, "danger")}
            <span className={themeSystem.typography("caption")}>{t("rebus.studio.madeBy", { model: result.model })}</span>
          </div>

          {missing.length > 0 && <p className={themeSystem.typography("body-sm")}>{t("rebus.studio.needsDrawings", { list: missing.join(", ") })}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <UIButton variant="success" icon={<Check />} isLoading={busy === "approving"} disabled={busy !== null || chosen.length === 0} onClick={() => void keep(true)}>
              {t("rebus.studio.approveNow", { count: chosen.length })}
            </UIButton>
            <UIButton variant="secondary" icon={<Save />} isLoading={busy === "saving"} disabled={busy !== null || chosen.length === 0} onClick={() => void keep(false)}>
              {t("rebus.studio.addToReview", { count: chosen.length })}
            </UIButton>
            <span className={themeSystem.typography("caption")}>{t("rebus.studio.saveDraftsHint")}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c, i) => (
              <div key={c.id} className="flex flex-col gap-2">
                <PuzzleCard puzzle={c} />
                <UIButton size="sm" variant={picked.has(i) ? "primary" : "secondary"} aria-pressed={picked.has(i)} disabled={!worthSaving(result.puzzles[i])} onClick={() => toggle(i)}>
                  {worthSaving(result.puzzles[i]) ? (picked.has(i) ? t("rebus.studio.keeping") : t("rebus.studio.keep")) : t("rebus.studio.cannotKeep")}
                </UIButton>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
