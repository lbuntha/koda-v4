import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Beaker, CheckCircle2, Flame, Gauge, RefreshCcw, RotateCcw, Route, Save, Scale, SlidersHorizontal, TrendingDown, TrendingUp, Users } from "lucide-react";
import { RescoreJob, ScoringConfig, ScoringPreview, settingsApi } from "../api/settings";
import { Badge, Button, Card, FieldHint, Input, Label, SkeletonCard, Switch } from "../components/ui";
import { useAppSettings } from "../settings/AppSettingsContext";
import { MasteryJourneySimulator } from "./MasteryJourneySimulator";

const DEFAULT_SCORING: ScoringConfig = {
  weights: { firstTry: 0.45, accuracy: 0.2, independence: 0.2, speed: 0.15 },
  developingScore: 0.6,
  proficientScore: 0.85,
  masterScore: 0.92,
  successfulReviewScore: 0.8,
  gates: {
    developing: { minPlays: 6 },
    proficient: { minPlays: 10, minSessions: 2, minHardPlays: 3 },
    master: { minPlays: 15, minDistinctDays: 3, minHardPlays: 3, minRecentScore: 0.9 },
  },
  speedBaselineMs: 8000,
  reviewIntervalDays: { not_started: null, beginner: 0, developing: 1, proficient: 4, master: 14 },
  placement: {
    per_skill: 2,
    checkpoint_cap: 8,
    pass_threshold: 0.8,
    checkpoints_only: true,
    generator_revision: 1,
    rapid_confirmation_plays: 2,
  },
  streak: {
    counts: "attempt",
    min_events_per_day: 1,
    grace_days: 1,
  },
  recommendation: {
    skills_per_session: 3,
    max_non_new: 2,
    skip_cooldown_sessions: 1,
    reinforce_threshold: 0.6,
  },
};

const clone = (value: ScoringConfig): ScoringConfig => JSON.parse(JSON.stringify(value)) as ScoringConfig;
const percent = (value: number) => Math.round(value * 100);

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  help?: string;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  help,
}) => (
  <div className="min-w-0 space-y-1">
    <div className="flex min-h-4 items-center gap-1">
      <Label className="normal-case tracking-normal">{label}</Label>
      {help && <FieldHint text={help} label={`About ${label}`} />}
    </div>
    <div className="relative">
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(Number(event.target.value))}
        className={`h-9 rounded-lg px-3 ${suffix ? "pr-12" : ""}`}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8D89AE]">{suffix}</span>}
    </div>
  </div>
);

const SectionHeader: React.FC<{ icon: React.ElementType; title: string }> = ({ icon: Icon, title }) => (
  <div className="mb-3 flex items-center gap-2.5 border-b border-[#EEEAF8] pb-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#534AB7]"><Icon size={15} /></span>
    <h3 className="koda-admin-section-title">{title}</h3>
  </div>
);

export const ProgressionSettings: React.FC = () => {
  const { settings, loading, save } = useAppSettings();
  const [draft, setDraft] = useState<ScoringConfig>(() => clone(settings.scoring));
  const [saving, setSaving] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<RescoreJob | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [preview, setPreview] = useState<ScoringPreview | null>(null);

  useEffect(() => {
    setDraft(clone(settings.scoring));
    setAcknowledged(false);
    setPreview(null);
  }, [settings.scoring, settings.scoring_revision]);

  useEffect(() => {
    // Absence of a job card is indistinguishable from "no job running", which is the common
    // case and harmless — the next save refreshes this. Nothing here is destructive.
    settingsApi.rescoreJobs()
      .then(result => setJob(result.jobs[0] ?? null))
      .catch(() => undefined);
  }, [settings.scoring_revision]);

  useEffect(() => {
    setPreview(null);
  }, [draft]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings.scoring), [draft, settings.scoring]);
  const atDefaults = useMemo(() => JSON.stringify(draft) === JSON.stringify(DEFAULT_SCORING), [draft]);
  const validation = useMemo(() => {
    const weightSum = Object.values(draft.weights).reduce((sum, value) => sum + value, 0);
    if (Math.abs(weightSum - 1) > 0.000001) return `Evidence weights must total 100% (currently ${Math.round(weightSum * 100)}%).`;
    if (!(draft.developingScore <= draft.proficientScore && draft.proficientScore <= draft.masterScore)) {
      return "Mastery thresholds must increase from Developing to Proficient to Master.";
    }
    if (!(draft.gates.developing.minPlays <= draft.gates.proficient.minPlays
      && draft.gates.proficient.minPlays <= draft.gates.master.minPlays)) {
      return "Minimum plays must increase across mastery levels.";
    }
    if (draft.recommendation.max_non_new > draft.recommendation.skills_per_session) {
      return "The review/reinforcement cap cannot exceed skills per session.";
    }
    return null;
  }, [draft]);

  const setWeight = (key: keyof ScoringConfig["weights"], value: number) =>
    setDraft(current => ({ ...current, weights: { ...current.weights, [key]: value / 100 } }));
  const setGate = <K extends keyof ScoringConfig["gates"]>(
    level: K,
    key: keyof ScoringConfig["gates"][K],
    value: number,
  ) => setDraft(current => ({
    ...current,
    gates: { ...current.gates, [level]: { ...current.gates[level], [key]: value } },
  }));

  const handleSave = async () => {
    if (!dirty || validation || !acknowledged) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = await save({ scoring: draft, scoring_revision: settings.scoring_revision });
      setMessage(`Progression configuration saved as revision ${next.scoring_revision}. Re-scoring has started.`);
      const jobs = await settingsApi.rescoreJobs();
      setJob(jobs.jobs[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save progression configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    if (!dirty || validation) return;
    setSimulating(true);
    setError(null);
    setMessage(null);
    try {
      setPreview(await settingsApi.previewScoring(draft, settings.scoring_revision));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to simulate this configuration.");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <div className="grid w-full gap-4 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="h-72" />)}</div>;
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-col gap-2 rounded-xl border border-[#DED8F3] bg-[#F7F4FF] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="koda-admin-section-title">Progression engine · revision {settings.scoring_revision}</p>
        </div>
        {job && (
          <span className={`koda-admin-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            job.status === "completed" ? "bg-emerald-50 text-emerald-700"
              : job.status === "failed" ? "bg-rose-50 text-rose-700"
                : "bg-amber-50 text-amber-700"
          }`}>
            {job.status === "completed" ? <CheckCircle2 size={13} /> : <RefreshCcw size={13} className={job.status === "running" ? "animate-spin" : ""} />}
            Re-score {job.status}
          </span>
        )}
      </div>

      <MasteryJourneySimulator config={draft} />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="border-[#E7E3F6] p-4">
          <SectionHeader icon={Scale} title="Evidence and thresholds" />
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            <NumberField label="First-try weight" help="How much the score rewards a correct first submitted answer. Higher values emphasize immediate understanding." value={percent(draft.weights.firstTry)} onChange={value => setWeight("firstTry", value)} max={100} suffix="%" />
            <NumberField label="Accuracy weight" help="How much all correct attempts contribute to the score, including retries. Higher values emphasize overall correctness." value={percent(draft.weights.accuracy)} onChange={value => setWeight("accuracy", value)} max={100} suffix="%" />
            <NumberField label="Independence weight" help="How much working without hints contributes to the score. Higher values make hint-free work more important." value={percent(draft.weights.independence)} onChange={value => setWeight("independence", value)} max={100} suffix="%" />
            <NumberField label="Speed weight" help="How much completion time contributes when timing is available. Untimed attempts automatically redistribute this weight." value={percent(draft.weights.speed)} onChange={value => setWeight("speed", value)} max={100} suffix="%" />
            <NumberField label="Developing score" help="Minimum combined evidence score needed for Developing. A higher value makes promotion more demanding." value={percent(draft.developingScore)} onChange={value => setDraft(current => ({ ...current, developingScore: value / 100 }))} max={100} suffix="%" />
            <NumberField label="Proficient score" help="Minimum combined evidence score needed for Proficient. The play and session gates must also be met." value={percent(draft.proficientScore)} onChange={value => setDraft(current => ({ ...current, proficientScore: value / 100 }))} max={100} suffix="%" />
            <NumberField label="Master score" help="Minimum combined evidence score needed for Master. This should be the strictest mastery threshold." value={percent(draft.masterScore)} onChange={value => setDraft(current => ({ ...current, masterScore: value / 100 }))} max={100} suffix="%" />
            <NumberField label="Successful review" help="Minimum score for a later review session to count as successful and move the next review date forward." value={percent(draft.successfulReviewScore)} onChange={value => setDraft(current => ({ ...current, successfulReviewScore: value / 100 }))} max={100} suffix="%" />
            <NumberField label="Speed baseline" help="Expected completion time used to score speed. A larger baseline makes it easier for slower answers to receive a strong speed score." value={draft.speedBaselineMs / 1000} onChange={value => setDraft(current => ({ ...current, speedBaselineMs: Math.round(value * 1000) }))} min={0.1} max={3600} step={0.5} suffix="sec" />
          </div>
        </Card>

        <Card className="border-[#E7E3F6] p-4">
          <SectionHeader icon={SlidersHorizontal} title="Mastery gates" />
          <div className="space-y-3">
            <div>
              <p className="koda-admin-label mb-1.5">Developing</p>
              <NumberField label="Minimum plays" help="Minimum verified question attempts required before a skill can reach Developing." value={draft.gates.developing.minPlays} onChange={value => setGate("developing", "minPlays", value)} min={1} />
            </div>
            <div>
              <p className="koda-admin-label mb-1.5">Proficient</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <NumberField label="Minimum plays" help="Total verified attempts required before Proficient, even when the score is already high enough." value={draft.gates.proficient.minPlays} onChange={value => setGate("proficient", "minPlays", value)} min={1} />
                <NumberField label="Sessions" help="Separate learning sessions required for Proficient. This prevents one short burst from proving durable understanding." value={draft.gates.proficient.minSessions} onChange={value => setGate("proficient", "minSessions", value)} min={1} />
                <NumberField label="Hard plays" help="Hard-difficulty attempts required for Proficient. Set to zero if difficult questions are not required." value={draft.gates.proficient.minHardPlays} onChange={value => setGate("proficient", "minHardPlays", value)} />
              </div>
            </div>
            <div>
              <p className="koda-admin-label mb-1.5">Master</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <NumberField label="Minimum plays" help="Total verified attempts required before Master. It must be at least the Proficient play requirement." value={draft.gates.master.minPlays} onChange={value => setGate("master", "minPlays", value)} min={1} />
                <NumberField label="Distinct days" help="Different calendar days with practice required for Master, ensuring learning is spaced over time." value={draft.gates.master.minDistinctDays} onChange={value => setGate("master", "minDistinctDays", value)} min={1} />
                <NumberField label="Hard plays" help="Hard-difficulty attempts required for Master, providing evidence that the student can handle challenge." value={draft.gates.master.minHardPlays} onChange={value => setGate("master", "minHardPlays", value)} />
                <NumberField label="Recent score" help="Minimum score across recent work required for Master. This prevents older success from hiding a current decline." value={percent(draft.gates.master.minRecentScore)} onChange={value => setGate("master", "minRecentScore", value / 100)} max={100} suffix="%" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-[#E7E3F6] p-4">
          <SectionHeader icon={Route} title="Practice delivery" />
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            <NumberField label="Skills per session" help="Number of skills placed in the student's recommended plan. Larger plans offer variety but take longer." value={draft.recommendation.skills_per_session} onChange={value => setDraft(current => ({ ...current, recommendation: { ...current.recommendation, skills_per_session: value } }))} min={1} max={10} />
            <NumberField label="Review/reinforcement cap" help="Maximum plan slots that may be review or reinforcement. Remaining slots are reserved for forward progress." value={draft.recommendation.max_non_new} onChange={value => setDraft(current => ({ ...current, recommendation: { ...current.recommendation, max_non_new: value } }))} max={10} />
            <NumberField label="Skip cooldown" help="Sessions to wait before recommending a skipped skill again. Zero allows it to return immediately." value={draft.recommendation.skip_cooldown_sessions} onChange={value => setDraft(current => ({ ...current, recommendation: { ...current.recommendation, skip_cooldown_sessions: value } }))} max={10} suffix="sessions" />
            <NumberField label="Reinforce below" help="Skills scoring below this level are treated as reinforcement candidates. Higher values trigger reinforcement more often." value={percent(draft.recommendation.reinforce_threshold)} onChange={value => setDraft(current => ({ ...current, recommendation: { ...current.recommendation, reinforce_threshold: value / 100 } }))} max={100} suffix="%" />
            <NumberField label="Placement items per skill" help="Questions sampled for each placement checkpoint. Two gives stronger evidence but makes placement longer." value={draft.placement.per_skill} onChange={value => setDraft(current => ({ ...current, placement: { ...current.placement, per_skill: value } }))} min={1} max={2} />
            <NumberField label="Placement checkpoint cap" help="Maximum skills sampled by quick placement. This controls placement length, not mastery." value={draft.placement.checkpoint_cap} onChange={value => setDraft(current => ({ ...current, placement: { ...current.placement, checkpoint_cap: value } }))} min={1} max={50} />
            <NumberField label="Placement pass score" help="Score needed to place beyond a checkpoint. Passing only unlocks progression; it never awards mastery." value={percent(draft.placement.pass_threshold)} onChange={value => setDraft(current => ({ ...current, placement: { ...current.placement, pass_threshold: value / 100 } }))} max={100} suffix="%" />
            <NumberField label="Rapid confirmation plays" help="Consecutive strong first-try, no-hint answers needed to advance a knowledgeable student quickly after placement." value={draft.placement.rapid_confirmation_plays} onChange={value => setDraft(current => ({ ...current, placement: { ...current.placement, rapid_confirmation_plays: value } }))} min={1} max={20} />
            <NumberField label="Generator revision" help="Version stamped on newly generated placement manifests. Increase only when placement-generation behavior changes." value={draft.placement.generator_revision} onChange={value => setDraft(current => ({ ...current, placement: { ...current.placement, generator_revision: value } }))} min={1} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#EEEAF8] bg-[#FBFAFF] px-3 py-2">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium text-[#17143D]">Checkpoint skills only</p>
                <FieldHint text="When enabled, placement samples authored checkpoint skills. When disabled, it can sample the broader in-scope skill sequence." label="About checkpoint skills only" />
              </div>
            </div>
            <Switch checked={draft.placement.checkpoints_only} onCheckedChange={value => setDraft(current => ({ ...current, placement: { ...current.placement, checkpoints_only: value } }))} />
          </div>
        </Card>

        <Card className="border-[#E7E3F6] p-4">
          <SectionHeader icon={Flame} title="Daily streak" />
          <p className="mb-2.5 text-[11px] leading-relaxed text-[#6D6997]">
            What a learner has to do for a day to count. Streaks recompute from existing
            events, so a change here restates every learner&rsquo;s current number immediately.
          </p>
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="streak-counts">A day counts when the learner</Label>
              <select
                id="streak-counts"
                value={draft.streak.counts}
                onChange={event => setDraft(current => ({
                  ...current,
                  streak: { ...current.streak, counts: event.target.value as ScoringConfig["streak"]["counts"] },
                }))}
                className="h-9 w-full rounded-lg border border-[#E7E3F6] bg-white px-2.5 text-xs text-[#17143D]"
              >
                <option value="attempt">Answers a question</option>
                <option value="lesson_complete">Finishes an activity</option>
                <option value="any">Opens an activity</option>
              </select>
              <FieldHint text="&ldquo;Opens&rdquo; counts attendance — a learner who views a question and leaves keeps their streak. &ldquo;Answers&rdquo; requires a verified attempt." />
            </div>
            <NumberField
              label="Events needed per day"
              help="How many qualifying events a day needs before it counts. One means a single answer is enough."
              value={draft.streak.min_events_per_day}
              onChange={value => setDraft(current => ({ ...current, streak: { ...current.streak, min_events_per_day: value } }))}
              min={1}
              max={50}
            />
            <NumberField
              label="Grace days"
              help="How stale the last active day may be before the streak resets. One keeps today's number visible until yesterday is missed too; zero resets the moment a day passes with no work."
              value={draft.streak.grace_days}
              onChange={value => setDraft(current => ({ ...current, streak: { ...current.streak, grace_days: value } }))}
              min={0}
              max={7}
              suffix="days"
            />
          </div>
        </Card>

        <Card className="border-[#E7E3F6] p-4">
          <SectionHeader icon={RefreshCcw} title="Review intervals" />
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            {(["beginner", "developing", "proficient", "master"] as const).map(level => (
              <NumberField
                key={level}
                label={`${level[0].toUpperCase()}${level.slice(1)}`}
                value={draft.reviewIntervalDays[level]}
                onChange={value => setDraft(current => ({
                  ...current,
                  reviewIntervalDays: { ...current.reviewIntervalDays, [level]: value },
                }))}
                max={3650}
                suffix="days"
                help={
                  level === "beginner"
                    ? "Days before a Beginner skill is due again. Zero keeps it immediately available until it develops."
                    : `Days after a successful ${level} review before the skill is due again. Larger values space reviews farther apart.`
                }
              />
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <div className="flex gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <p className="text-xs font-medium text-amber-900">Global and retroactive</p>
                <p className="mt-1 text-[11px] leading-4 text-amber-800">Saving creates a new revision and re-scores every learner from the append-only event log.</p>
              </div>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-amber-900">
              <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} className="h-4 w-4 accent-[#534AB7]" />
              I understand this may change displayed mastery levels.
            </label>
          </div>
        </Card>
      </div>

      {preview && (
        <Card className="border-[#D9D1F5] bg-[#FCFBFF] p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-[#E7E3F6] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEE9FF] text-[#534AB7]"><Beaker size={18} /></span>
              <div>
                <h3 className="koda-admin-section-title">Simulation result</h3>
                <p className="koda-admin-secondary mt-1">Read-only replay of verified MongoDB events. No mastery records or settings were changed.</p>
              </div>
            </div>
            <Badge variant="outline">Revision {preview.currentRevision} → {preview.proposedRevision}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Learners scanned", value: preview.studentsScanned, icon: Users, tone: "text-[#534AB7]" },
              { label: "Learners affected", value: preview.affectedStudents, icon: Users, tone: "text-amber-600" },
              { label: `Skills changed / ${preview.skillsScanned}`, value: preview.changedSkills, icon: Gauge, tone: "text-[#534AB7]" },
              { label: "Promotions", value: preview.promotedSkills, icon: TrendingUp, tone: "text-emerald-600" },
              { label: "Demotions", value: preview.demotedSkills, icon: TrendingDown, tone: "text-rose-600" },
              { label: "Review dates changed", value: preview.reviewDueChanged, icon: RefreshCcw, tone: "text-amber-600" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-[#E7E3F6] bg-white p-3">
                <item.icon size={15} className={item.tone} />
                <p className="koda-admin-metric mt-2">{item.value}</p>
                <p className="koda-admin-chip mt-0.5 text-[#6D6997]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-[#E7E3F6] bg-white p-4">
              <p className="koda-admin-label">Projected session delivery</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Skills", current: preview.deliveryImpact.sessionPlan.current.skills, proposed: preview.deliveryImpact.sessionPlan.proposed.skills },
                  { label: "New slots", current: preview.deliveryImpact.sessionPlan.current.newSlots, proposed: preview.deliveryImpact.sessionPlan.proposed.newSlots },
                  { label: "Review slots", current: preview.deliveryImpact.sessionPlan.current.reviewSlots, proposed: preview.deliveryImpact.sessionPlan.proposed.reviewSlots },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-[#F8F6FF] p-2">
                    <p className="text-sm font-semibold text-[#17143D]">{item.current} → {item.proposed}</p>
                    <p className="koda-admin-chip text-[#6D6997]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#E7E3F6] bg-white p-4">
              <p className="koda-admin-label">Placement and skip behavior</p>
              <div className="mt-3 space-y-2 text-xs text-[#6D6997]">
                <div className="flex justify-between gap-3"><span>Maximum placement items</span><span className="font-medium text-[#17143D]">{preview.deliveryImpact.placementMaximumItems.current} → {preview.deliveryImpact.placementMaximumItems.proposed}</span></div>
                <div className="flex justify-between gap-3"><span>Placement pass score</span><span className="font-medium text-[#17143D]">{Math.round(preview.deliveryImpact.placementPassThreshold.current * 100)}% → {Math.round(preview.deliveryImpact.placementPassThreshold.proposed * 100)}%</span></div>
                <div className="flex justify-between gap-3"><span>Skip cooldown</span><span className="font-medium text-[#17143D]">{preview.deliveryImpact.skipCooldownSessions.current} → {preview.deliveryImpact.skipCooldownSessions.proposed} sessions</span></div>
              </div>
            </div>
          </div>

          {preview.sampleChanges.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#E7E3F6] bg-white">
              <div className="border-b border-[#EEEAF8] px-4 py-3">
                <p className="koda-admin-label">Affected skill sample</p>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="sticky top-0 bg-[#FAF9FF] text-[#6D6997]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Learner</th>
                      <th className="px-4 py-2 font-medium">Skill</th>
                      <th className="px-4 py-2 font-medium">Level</th>
                      <th className="px-4 py-2 font-medium">Score</th>
                      <th className="px-4 py-2 font-medium">Review due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleChanges.map((change, index) => (
                      <tr key={`${change.studentId}-${change.skillId}-${index}`} className="border-t border-[#F0EDF8]">
                        <td className="px-4 py-2.5 font-medium text-[#17143D]">{change.studentName}</td>
                        <td className="px-4 py-2.5 text-[#6D6997]">{change.skillId}</td>
                        <td className="px-4 py-2.5 capitalize text-[#17143D]">{change.beforeLevel.replaceAll("_", " ")} → {change.afterLevel.replaceAll("_", " ")}</td>
                        <td className="px-4 py-2.5 text-[#17143D]">{Math.round(change.beforeScore * 100)}% → {Math.round(change.afterScore * 100)}%</td>
                        <td className="px-4 py-2.5 text-[#6D6997]">{change.beforeDue === change.afterDue ? "No change" : `${change.beforeDue ? "Due" : "Not due"} → ${change.afterDue ? "Due" : "Not due"}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.sampleTruncated && <p className="border-t border-[#EEEAF8] px-4 py-2 text-[11px] text-[#6D6997]">Showing the first 100 affected skills.</p>}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              No learner mastery levels or review-due states would change with this draft.
            </div>
          )}
        </Card>
      )}

      <Card className="sticky bottom-3 z-10 flex flex-col gap-3 border-[#DED8F3] bg-white/95 p-3 shadow-[0_10px_30px_rgba(83,74,183,0.12)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-xs">
          {validation && <span className="text-rose-600">{validation}</span>}
          {!validation && error && <span className="text-rose-600">{error}</span>}
          {!validation && message && <span className="text-emerald-600">{message}</span>}
          {!validation && !error && !message && <span className="text-[#6D6997]">{dirty ? "Unsaved progression changes" : "Configuration is up to date"}</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={simulating} loadingText="Simulating…" disabled={!dirty || Boolean(validation) || saving} onClick={handleSimulate}>
            <Beaker size={14} /> Simulate impact
          </Button>
          <Button variant="outline" size="sm" disabled={atDefaults || saving} onClick={() => { setDraft(clone(DEFAULT_SCORING)); setAcknowledged(false); setMessage(null); }}>
            <RotateCcw size={14} /> Defaults
          </Button>
          <Button size="sm" loading={saving} loadingText="Saving…" disabled={!dirty || Boolean(validation) || !acknowledged} onClick={handleSave}>
            <Save size={14} /> Save & re-score
          </Button>
        </div>
      </Card>
    </div>
  );
};
