/**
 * Trace Studio, colouring items: the last step — check, then publish.
 *
 * Children get pictures through collections. This step shows each collection
 * the picture is in with one action that fits where it is (publish, publish
 * changes, or nothing when it is up to date), and asks for what is missing
 * before the button is pressed — a collection's grades are picked right in its
 * row. Putting the picture in a collection is one control: an existing one, or
 * a new one (its name checked against the others) created and published at once.
 * Publishing is the collection board's: send the drafts, ask the server what
 * is missing, then publish (or send for review, for a creator who is not an admin).
 */

import { useEffect, useState } from "react";
import { AlertCircle, Check, Play, Rocket } from "lucide-react";
import { useT } from "../../lib/i18n";
import type { AgeRange } from "../../lib/ages";
import { UIAgePicker, UIBadge, UIButton } from "../../components/ui";
import type { Problem, StudioCollection } from "../data/api";
import { checkStudioCollection, fetchStudioCollections, publishStudioCollection, saveStudioCollection } from "../data/api";
import type { TraceItem } from "../geometry/types";
import { TraceDrafts } from "./drafts";
import { Section, inputCls } from "./ui";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NEW = "__new";

type Status = { tone: "good" | "bad"; text: string; problems?: Problem[] };

/** Published and nothing changed since: there is nothing to press. */
const upToDate = (c: StudioCollection) => c.publishedRev !== null && !c.changed && c.reviewState !== "rejected";

export function PaintPublish({ item, ready, checks, onTry }: { item: TraceItem; ready: boolean; checks: React.ReactNode; onTry(): void }) {
  const { t } = useT();
  const [cols, setCols] = useState<StudioCollection[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [target, setTarget] = useState("");
  const [name, setName] = useState(item.title.trim());
  const [ages, setAges] = useState<AgeRange | null>(null);

  useEffect(() => {
    fetchStudioCollections()
      .then((rows) => {
        setCols(rows);
        // Nothing to choose from: start on a new collection.
        if (!rows.some((c) => !c.itemIds.includes(item.id))) setTarget(NEW);
      })
      .catch(() => setOffline(true));
  }, [item.id]);

  const mine = (cols ?? []).filter((c) => c.itemIds.includes(item.id));
  const others = (cols ?? []).filter((c) => !c.itemIds.includes(item.id));
  const replace = (c: StudioCollection) => setCols((all) => (all ?? []).map((x) => (x.id === c.id ? { ...x, ...c } : x)));
  const say = (id: string, s: Status | null) =>
    setStatus(({ [id]: _old, ...rest }) => (s ? { ...rest, [id]: s } : rest));

  /** Send the drafts, ask the server what is missing, then publish. */
  const publish = async (c: StudioCollection) => {
    setBusy(c.id);
    say(c.id, null);
    try {
      await TraceDrafts.flush();
      const found = await checkStudioCollection(c.id);
      if (found.length) return say(c.id, { tone: "bad", text: t("traceStudio.col.problems", { count: found.length }), problems: found });
      const saved = await publishStudioCollection(c.id);
      replace(saved);
      say(c.id, { tone: "good", text: saved.reviewState === "pending" ? t("traceStudio.review.sent") : t("traceStudio.publish.done") });
    } catch {
      say(c.id, { tone: "bad", text: t("traceStudio.col.publishFailed") });
    } finally {
      setBusy(null);
    }
  };

  const setGrades = async (c: StudioCollection, next: AgeRange) => {
    replace({ ...c, ages: next });
    try {
      replace(await saveStudioCollection({ ...c, ages: next }));
    } catch {
      setOffline(true);
    }
  };

  const add = async () => {
    const c = others.find((x) => x.id === target);
    if (!c) return;
    setBusy("add");
    try {
      replace(await saveStudioCollection({ ...c, itemIds: [...c.itemIds, item.id] }));
      setTarget(others.length > 1 ? "" : NEW);
    } catch {
      setOffline(true);
    } finally {
      setBusy(null);
    }
  };

  // A new collection is checked before it is made: a name, not one already used, and the grades.
  const clash = (cols ?? []).some((c) => c.title.trim().toLowerCase() === name.trim().toLowerCase());
  const newProblem = !name.trim() ? "noName" : clash ? "nameTaken" : !ages ? "noGrades" : null;

  const createAndPublish = async () => {
    if (newProblem) return;
    setBusy("create");
    try {
      const c = await saveStudioCollection({ id: uid("c-"), title: name.trim(), description: "", language: item.script === "khmer" ? "km" : "en", itemIds: [item.id], order: 100, ages });
      setCols((all) => [...(all ?? []), c]);
      setTarget("");
      setBusy(null);
      await publish(c);
    } catch {
      setOffline(true);
      setBusy(null);
    }
  };

  const badge = (c: StudioCollection) =>
    c.reviewState === "pending"
      ? { variant: "info" as const, label: t("traceStudio.publish.inReview") }
      : c.publishedRev === null
        ? { variant: "neutral" as const, label: t("traceStudio.publish.notPublished") }
        : c.changed
          ? { variant: "danger" as const, label: t("traceStudio.publish.changed") }
          : { variant: "success" as const, label: t("traceStudio.publish.live") };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Section title={t("traceStudio.publish.check")} aside={ready ? t("traceStudio.ready") : undefined}>
          {checks}
        </Section>
        <UIButton variant="secondary" icon={<Play className="h-4 w-4" />} onClick={onTry} disabled={!ready}>
          {t("traceStudio.publish.tryFirst")}
        </UIButton>
      </div>

      <Section title={t("traceStudio.publish.title")}>
        {!ready && <p className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{t("traceStudio.publish.fixFirst")}</p>}
        {offline && <p className="text-sm text-rose-700 dark:text-rose-300">{t("traceStudio.col.offline")}</p>}
        {cols === null && !offline && <p className="text-sm text-muted">{t("traceStudio.col.loading")}</p>}

        {/* The collections it is in: one row each, one action at most */}
        {mine.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {mine.map((c) => {
              const b = badge(c);
              const s = status[c.id];
              const noGrades = !c.ages;
              return (
                <li key={c.id} className="flex flex-col gap-2.5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{c.title}</span>
                    <UIBadge variant={b.variant}>{b.label}</UIBadge>
                    {!upToDate(c) && c.reviewState !== "pending" && (
                      <UIButton size="sm" icon={<Rocket className="h-4 w-4" />} isLoading={busy === c.id} disabled={!ready || noGrades || busy !== null} onClick={() => void publish(c)}>
                        {c.publishedRev === null ? t("traceStudio.publish.publish") : t("traceStudio.publish.publishChanges")}
                      </UIButton>
                    )}
                  </div>
                  {noGrades && (
                    <div className="flex flex-col gap-1.5 rounded-xl bg-surface-muted p-3">
                      <span className="text-xs font-semibold text-ink">{t("traceStudio.publish.gradesFirst")}</span>
                      <UIAgePicker value={c.ages} onChange={(next) => void setGrades(c, next)} />
                    </div>
                  )}
                  {s && (
                    <div role="status" className={`flex flex-col gap-1 text-sm ${s.tone === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                      <span className="flex items-center gap-1.5 font-semibold">
                        {s.tone === "good" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {s.text}
                      </span>
                      {s.problems?.map((p, i) => (
                        <span key={i} className="text-xs">
                          {p.item ? p.title : t("traceStudio.col.theCollection")}: {p.problems.join("; ")}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Put it in a collection: an existing one, or a new one made and published at once */}
        {cols !== null && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{mine.length ? t("traceStudio.publish.alsoAdd") : t("traceStudio.publish.addTo")}</span>
            <div className="flex gap-2">
              <select aria-label={t("traceStudio.publish.addTo")} className={`${inputCls} flex-1`} value={target} onChange={(e) => setTarget(e.target.value)}>
                {others.length > 0 && <option value="">{t("traceStudio.publish.pick")}</option>}
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                <option value={NEW}>{t("traceStudio.publish.newCollection")}</option>
              </select>
              {target && target !== NEW && (
                <UIButton size="sm" variant="secondary" onClick={() => void add()} isLoading={busy === "add"} disabled={busy !== null}>
                  {t("traceStudio.publish.add")}
                </UIButton>
              )}
            </div>
            {target === NEW && (
              <div className="flex flex-col gap-3 rounded-2xl border border-line p-3">
                <input className={inputCls} value={name} placeholder={t("traceStudio.publish.newTitle")} onChange={(e) => setName(e.target.value)} />
                {clash && name.trim() && <p className="-mt-1.5 text-xs text-rose-700 dark:text-rose-300">{t("traceStudio.publish.nameTaken")}</p>}
                <UIAgePicker value={ages} onChange={setAges} />
                <UIButton icon={<Rocket className="h-4 w-4" />} onClick={() => void createAndPublish()} disabled={!ready || newProblem !== null || busy !== null} isLoading={busy === "create"}>
                  {t("traceStudio.publish.createAndPublish")}
                </UIButton>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
