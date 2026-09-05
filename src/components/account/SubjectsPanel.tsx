import React, { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { accessToken, refreshSystem, request } from "../../lib/sync";
import { DEFAULT_SUBJECTS, parseSubjects, SUBJECT_SETTING, validateSubjects, type SubjectCatalog } from "../../lib/subjects";
import { useInstalledSkills, skillTitle } from "../../lib/skillStore";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIDataTable } from "../ui";

export function SubjectsPanel() {
  const skills = useInstalledSkills();
  const [draft, setDraft] = useState<SubjectCatalog>(DEFAULT_SUBJECTS);
  const [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const values = await request<Record<string, unknown>>("/system", { token: await accessToken() });
        if (!active) return;
        const catalog = parseSubjects(values[SUBJECT_SETTING]);
        setDraft(catalog);
        setBaseline(JSON.stringify(catalog));
        setLoaded(true);
      } catch {
        if (active) setError("Connect to load subject settings before editing. Reopen this page to retry.");
      }
    })();
    return () => { active = false; };
  }, []);

  const change = (next: SubjectCatalog) => { setDraft(next); setSaved(false); };
  const validation = validateSubjects(draft);
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await request<{ value: string }>(`/system/settings/${SUBJECT_SETTING}`, {
        method: "PATCH", token: await accessToken(), body: { value: JSON.stringify(draft) },
      });
      const catalog = parseSubjects(result.value);
      setDraft(catalog);
      setBaseline(JSON.stringify(catalog));
      await refreshSystem();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save subjects.");
    } finally { setSaving(false); }
  };

  return <section className={themeSystem.card("default", "p-4 sm:p-5 space-y-5")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="koda-admin-section-title">Subjects</h2>
        <p className="koda-admin-label text-muted mt-1">Group skills on Learn. Names and assignments apply to every learner.</p>
      </div>
      <UIButton icon={<Save />} isLoading={saving} disabled={!loaded || !!validation || baseline === JSON.stringify(draft)} onClick={() => void save()}>
        {saving ? "Saving..." : "Save subjects"}
      </UIButton>
    </div>
    {error && <p role="alert" className={themeSystem.flash("error")}>{error}</p>}
    {saved && <p role="status" className={themeSystem.flash("success")}>Subjects saved. Learn now uses these groups.</p>}
    {!loaded && !error && <div className="h-32 rounded-2xl bg-surface-muted animate-pulse" aria-label="Loading subjects" />}
    {loaded && <fieldset disabled={saving} className="space-y-5">
      <div className="space-y-2">
        {draft.subjects.map((subject, index) => {
          const count = Object.values(draft.assignments).filter((id) => id === subject.id).length;
          return <div key={subject.id} className="flex items-center gap-3">
            <input aria-label={`Subject ${index + 1} name`} maxLength={60} value={subject.name}
              className={themeSystem.field("sm", "min-w-0 flex-1")}
              onChange={(event) => change({ ...draft, subjects: draft.subjects.map((row) => row.id === subject.id ? { ...row, name: event.target.value } : row) })} />
            <span className="koda-admin-chip text-muted shrink-0">{count} skills</span>
            <UIButton variant="ghost" size="sm" icon={<Trash2 />} disabled={count > 0}
              aria-label={`Remove ${subject.name}`} title={count ? "Reassign skills before removing this subject" : "Remove subject"}
              onClick={() => change({ ...draft, subjects: draft.subjects.filter((row) => row.id !== subject.id) })} />
          </div>;
        })}
        <UIButton variant="secondary" size="sm" icon={<Plus />} disabled={draft.subjects.length >= 100}
          onClick={() => change({ ...draft, subjects: [...draft.subjects, { id: `subject-${crypto.randomUUID()}`, name: "" }] })}>Add subject</UIButton>
        {validation && <p role="alert" className="text-sm text-muted">{validation}</p>}
      </div>
      <div className="space-y-2">
        <h3 className="koda-admin-card-title">Skill assignments</h3>
        <p className="koda-admin-label text-muted">Unassigned skills remain available under For you. Reassign skills before removing a subject.</p>
        <UIDataTable rows={skills} rowKey={(skill) => skill.id} columns={[
          { key: "skill", header: "Skill", render: (skill) => skillTitle(skill.name, skill), sortValue: (skill) => skillTitle(skill.name, skill) },
          { key: "subject", header: "Subject", render: (skill) => <select aria-label={`Subject for ${skillTitle(skill.name, skill)}`}
            className={themeSystem.field("sm", "w-full min-w-32")} value={draft.assignments[skill.id] ?? ""}
            onChange={(event) => {
              const assignments = { ...draft.assignments };
              if (event.target.value) assignments[skill.id] = event.target.value;
              else delete assignments[skill.id];
              change({ ...draft, assignments });
            }}>
            <option value="">Unassigned</option>
            {draft.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || "Unnamed subject"}</option>)}
          </select> },
        ]} />
      </div>
    </fieldset>}
  </section>;
}
