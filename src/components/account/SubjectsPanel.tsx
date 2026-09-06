import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { getSkill } from "../../skills/registry";
import { SkillRegistryAPI, useSkillRegistryVersion } from "../../lib/skillRegistryApi";
import { accessToken, request } from "../../lib/sync";
import { cacheSystemSetting } from "../../lib/sync/system";
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
  useSkillRegistryVersion();
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [age, setAge] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSubject, setBulkSubject] = useState("");
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState("asc");
  const filtered = skills.filter((skill) => {
    const manifest = getSkill(skill.id)?.manifest;
    const ages = manifest?.audience.ages;
    const release = SkillRegistryAPI.get(skill.id)?.status ?? manifest?.status;
    return (!query.trim() || `${skillTitle(skill.name, skill)} ${skill.id}`.toLowerCase().includes(query.trim().toLowerCase()))
      && (subjectFilter === "all" || (subjectFilter === "unassigned" ? !draft.assignments[skill.id] : draft.assignments[skill.id] === subjectFilter))
      && (!age || (!!ages && Number(age) >= ages[0] && Number(age) <= ages[1]))
      && (status === "all" || release === status);
  }).sort((a, b) => (sortDirection === "asc" ? 1 : -1) * skillTitle(a.name, a).localeCompare(skillTitle(b.name, b)));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * 20, activePage * 20);
  const resetSelection = () => { setSelected(new Set()); setPage(1); };
  const moveSubject = (index: number, direction: number) => {
    const subjects = [...draft.subjects];
    [subjects[index], subjects[index + direction]] = [subjects[index + direction], subjects[index]];
    change({ ...draft, subjects });
  };

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
      const result = await request<{ value: string }>("/system/subjects", {
        method: "PATCH", token: await accessToken(), body: { value: JSON.stringify(draft) },
      });
      const catalog = parseSubjects(result.value);
      setDraft(catalog);
      setBaseline(JSON.stringify(catalog));
      cacheSystemSetting(SUBJECT_SETTING, result.value);
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
    {loaded && <fieldset disabled={saving} className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <div className="space-y-3">
        <h3 className="koda-admin-card-title">Subject list</h3>
        <p className="koda-admin-label text-muted">Move subjects up or down to set their order on Learn.</p>
        {draft.subjects.map((subject, index) => {
          const count = Object.values(draft.assignments).filter((id) => id === subject.id).length;
          return <div key={subject.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
            <input aria-label={`Subject ${index + 1} name`} maxLength={60} value={subject.name}
              className={themeSystem.field("sm", "min-w-0 flex-1")}
              onChange={(event) => change({ ...draft, subjects: draft.subjects.map((row) => row.id === subject.id ? { ...row, name: event.target.value } : row) })} />
            <span className="koda-admin-chip text-muted shrink-0">{count} skills</span>
            <div className="flex w-full justify-end gap-1">
            <UIButton variant="ghost" size="sm" icon={<ArrowUp />} disabled={index === 0} aria-label={`Move ${subject.name} up`} onClick={() => moveSubject(index, -1)} />
            <UIButton variant="ghost" size="sm" icon={<ArrowDown />} disabled={index === draft.subjects.length - 1} aria-label={`Move ${subject.name} down`} onClick={() => moveSubject(index, 1)} />
            <UIButton variant="ghost" size="sm" icon={<Trash2 />} disabled={count > 0}
              aria-label={`Remove ${subject.name}`} title={count ? "Reassign skills before removing this subject" : "Remove subject"}
              onClick={() => change({ ...draft, subjects: draft.subjects.filter((row) => row.id !== subject.id) })} />
            </div>
          </div>;
        })}
        <UIButton variant="secondary" size="sm" icon={<Plus />} disabled={draft.subjects.length >= 100}
          onClick={() => change({ ...draft, subjects: [...draft.subjects, { id: `subject-${crypto.randomUUID()}`, name: "" }] })}>Add subject</UIButton>
        {validation && <p role="alert" className="text-sm text-muted">{validation}</p>}
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="koda-admin-card-title">Skill assignments</h3>
        <p className="koda-admin-label text-muted">Unassigned skills remain available under For you. Reassign skills before removing a subject.</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input aria-label="Search skills" placeholder="Search skills" value={query} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setQuery(event.target.value); resetSelection(); }} />
          <select aria-label="Filter by subject" value={subjectFilter} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setSubjectFilter(event.target.value); resetSelection(); }}>
            <option value="all">All subjects</option><option value="unassigned">Unassigned</option>
            {draft.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || "Unnamed subject"}</option>)}
          </select>
          <input aria-label="Filter by learner age" type="number" min={0} max={120} placeholder="Learner age" value={age} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setAge(event.target.value); resetSelection(); }} />
          <select aria-label="Filter by publication status" value={status} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setStatus(event.target.value); resetSelection(); }}>
            <option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-muted p-3">
          <label className="koda-admin-label flex items-center gap-2">
            <input type="checkbox" aria-label="Select this page" checked={visible.length > 0 && visible.every((skill) => selected.has(skill.id))}
              onChange={(event) => setSelected((prev) => {
                const next = new Set(prev);
                visible.forEach((skill) => event.target.checked ? next.add(skill.id) : next.delete(skill.id));
                return next;
              })} /> Select page
          </label>
          <span className="koda-admin-chip">{selected.size} selected</span>
          <select aria-label="Bulk subject" value={bulkSubject} onChange={(event) => setBulkSubject(event.target.value)} className={themeSystem.field("sm", "min-w-32")}>
            <option value="">Unassigned</option>
            {draft.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || "Unnamed subject"}</option>)}
          </select>
          <UIButton size="sm" variant="secondary" disabled={!selected.size} onClick={() => {
            const assignments = { ...draft.assignments };
            selected.forEach((id) => { if (bulkSubject) assignments[id] = bulkSubject; else delete assignments[id]; });
            change({ ...draft, assignments });
            setSelected(new Set());
          }}>Assign subject</UIButton>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="koda-admin-label text-muted">{filtered.length} matching skills · Changes apply when you save subjects.</p>
        <select aria-label="Sort skills" className={themeSystem.field("sm")} value={sortDirection} onChange={(event) => { setSortDirection(event.target.value); setPage(1); }}><option value="asc">Name A–Z</option><option value="desc">Name Z–A</option></select>
        </div>
        <UIDataTable rows={visible} rowKey={(skill) => skill.id} columns={[
          { key: "select", header: "Select", render: (skill) => <input type="checkbox" aria-label={`Select ${skillTitle(skill.name, skill)}`} checked={selected.has(skill.id)} onChange={(event) => setSelected((prev) => {
            const next = new Set(prev); if (event.target.checked) next.add(skill.id); else next.delete(skill.id); return next;
          })} /> },
          { key: "skill", header: "Skill", render: (skill) => skillTitle(skill.name, skill) },
          { key: "age", header: "Ages", render: (skill) => getSkill(skill.id)?.manifest.audience.ages.join("–") ?? "—" },
          { key: "status", header: "Status", render: (skill) => SkillRegistryAPI.get(skill.id)?.status ?? getSkill(skill.id)?.manifest.status ?? "—" },
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
        <div className="flex items-center justify-between gap-2">
          <UIButton variant="ghost" size="sm" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Previous</UIButton>
          <span className="koda-admin-label text-muted">Page {activePage} of {pages}</span>
          <UIButton variant="ghost" size="sm" disabled={activePage === pages} onClick={() => setPage(activePage + 1)}>Next</UIButton>
        </div>
      </div>
    </fieldset>}
  </section>;
}
