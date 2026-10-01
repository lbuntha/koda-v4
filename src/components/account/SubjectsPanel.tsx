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

import { translate } from "../../lib/i18n";
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
        if (active) setError(translate("admin.subjectsPanel.connectToLoadSubjectSettingsBefore"));
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
      setError(e instanceof Error ? e.message : translate("admin.subjectsPanel.couldNotSaveSubjects"));
    } finally { setSaving(false); }
  };

  return <section className={themeSystem.card("default", "p-4 sm:p-5 space-y-5")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="koda-admin-section-title">{translate("admin.subjectsPanel.subjects")}</h2>
        <p className="koda-admin-label text-muted mt-1">{translate("admin.subjectsPanel.groupSkillsOnLearnNamesAnd")}</p>
      </div>
      <UIButton icon={<Save />} isLoading={saving} disabled={!loaded || !!validation || baseline === JSON.stringify(draft)} onClick={() => void save()}>
        {saving ? translate("admin.subjectsPanel.saving") : translate("admin.subjectsPanel.saveSubjects")}
      </UIButton>
    </div>
    {error && <p role="alert" className={themeSystem.flash("error")}>{error}</p>}
    {saved && <p role="status" className={themeSystem.flash("success")}>{translate("admin.subjectsPanel.subjectsSavedLearnNowUsesThese")}</p>}
    {!loaded && !error && <div className="h-32 rounded-2xl bg-surface-muted animate-pulse" aria-label={translate("admin.subjectsPanel.loadingSubjects")} />}
    {loaded && <fieldset disabled={saving} className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <div className="space-y-3">
        <h3 className="koda-admin-card-title">{translate("admin.subjectsPanel.subjectList")}</h3>
        <p className="koda-admin-label text-muted">{translate("admin.subjectsPanel.moveSubjectsUpOrDownTo")}</p>
        {draft.subjects.map((subject, index) => {
          const count = Object.values(draft.assignments).filter((id) => id === subject.id).length;
          return <div key={subject.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
            <input aria-label={translate("admin.subjectsPanel.subjectValueName", { value: index + 1 })} maxLength={60} value={subject.name}
              className={themeSystem.field("sm", "min-w-0 flex-1")}
              onChange={(event) => change({ ...draft, subjects: draft.subjects.map((row) => row.id === subject.id ? { ...row, name: event.target.value } : row) })} />
            <span className="koda-admin-chip text-muted shrink-0">{translate("admin.subjectsPanel.countSkills", { count: count })}</span>
            <div className="flex w-full justify-end gap-1">
            <UIButton variant="ghost" size="sm" icon={<ArrowUp />} disabled={index === 0} aria-label={translate("admin.subjectsPanel.moveNameUp", { name: subject.name })} onClick={() => moveSubject(index, -1)} />
            <UIButton variant="ghost" size="sm" icon={<ArrowDown />} disabled={index === draft.subjects.length - 1} aria-label={translate("admin.subjectsPanel.moveNameDown", { name: subject.name })} onClick={() => moveSubject(index, 1)} />
            <UIButton variant="ghost" size="sm" icon={<Trash2 />} disabled={count > 0}
              aria-label={translate("admin.subjectsPanel.removeName", { name: subject.name })} title={count ? translate("admin.subjectsPanel.reassignSkillsBeforeRemovingThisSubject") : translate("admin.subjectsPanel.removeSubject")}
              onClick={() => change({ ...draft, subjects: draft.subjects.filter((row) => row.id !== subject.id) })} />
            </div>
          </div>;
        })}
        <UIButton variant="secondary" size="sm" icon={<Plus />} disabled={draft.subjects.length >= 100}
          onClick={() => change({ ...draft, subjects: [...draft.subjects, { id: `subject-${crypto.randomUUID()}`, name: "" }] })}>{translate("admin.subjectsPanel.addSubject")}</UIButton>
        {validation && <p role="alert" className="text-sm text-muted">{validation}</p>}
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="koda-admin-card-title">{translate("admin.subjectsPanel.skillAssignments")}</h3>
        <p className="koda-admin-label text-muted">{translate("admin.subjectsPanel.unassignedSkillsRemainAvailableUnderFor")}</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input aria-label={translate("admin.subjectsPanel.searchSkills")} placeholder={translate("admin.subjectsPanel.searchSkills")} value={query} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setQuery(event.target.value); resetSelection(); }} />
          <select aria-label={translate("admin.subjectsPanel.filterBySubject")} value={subjectFilter} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setSubjectFilter(event.target.value); resetSelection(); }}>
            <option value="all">{translate("admin.subjectsPanel.allSubjects")}</option><option value="unassigned">{translate("admin.subjectsPanel.unassigned")}</option>
            {draft.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || translate("admin.subjectsPanel.unnamedSubject")}</option>)}
          </select>
          <input aria-label={translate("admin.subjectsPanel.filterByLearnerAge")} type="number" min={0} max={120} placeholder={translate("admin.subjectsPanel.learnerAge")} value={age} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setAge(event.target.value); resetSelection(); }} />
          <select aria-label={translate("admin.subjectsPanel.filterByPublicationStatus")} value={status} className={themeSystem.field("sm", "w-full")}
            onChange={(event) => { setStatus(event.target.value); resetSelection(); }}>
            <option value="all">{translate("admin.subjectsPanel.allStatuses")}</option><option value="published">{translate("admin.subjectsPanel.published")}</option><option value="draft">{translate("admin.subjectsPanel.draft")}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-muted p-3">
          <label className="koda-admin-label flex items-center gap-2">
            <input type="checkbox" aria-label={translate("admin.subjectsPanel.selectThisPage")} checked={visible.length > 0 && visible.every((skill) => selected.has(skill.id))}
              onChange={(event) => setSelected((prev) => {
                const next = new Set(prev);
                visible.forEach((skill) => event.target.checked ? next.add(skill.id) : next.delete(skill.id));
                return next;
              })} />{" "}{translate("admin.subjectsPanel.selectPage")}
          </label>
          <span className="koda-admin-chip">{translate("admin.subjectsPanel.sizeSelected", { size: selected.size })}</span>
          <select aria-label={translate("admin.subjectsPanel.bulkSubject")} value={bulkSubject} onChange={(event) => setBulkSubject(event.target.value)} className={themeSystem.field("sm", "min-w-32")}>
            <option value="">{translate("admin.subjectsPanel.unassigned")}</option>
            {draft.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || translate("admin.subjectsPanel.unnamedSubject")}</option>)}
          </select>
          <UIButton size="sm" variant="secondary" disabled={!selected.size} onClick={() => {
            const assignments = { ...draft.assignments };
            selected.forEach((id) => { if (bulkSubject) assignments[id] = bulkSubject; else delete assignments[id]; });
            change({ ...draft, assignments });
            setSelected(new Set());
          }}>{translate("admin.subjectsPanel.assignSubject")}</UIButton>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="koda-admin-label text-muted">{translate("admin.subjectsPanel.lengthMatchingSkillsChangesApplyWhen", { length: filtered.length })}</p>
        <select aria-label={translate("admin.subjectsPanel.sortSkills")} className={themeSystem.field("sm")} value={sortDirection} onChange={(event) => { setSortDirection(event.target.value); setPage(1); }}><option value="asc">{translate("admin.subjectsPanel.nameAZ")}</option><option value="desc">{translate("admin.subjectsPanel.nameZA")}</option></select>
        </div>
        <UIDataTable rows={visible} rowKey={(skill) => skill.id} columns={[
          { key: "select", header: "Select", render: (skill) => <input type="checkbox" aria-label={translate("admin.subjectsPanel.selectValue", { value: skillTitle(skill.name, skill) })} checked={selected.has(skill.id)} onChange={(event) => setSelected((prev) => {
            const next = new Set(prev); if (event.target.checked) next.add(skill.id); else next.delete(skill.id); return next;
          })} /> },
          { key: "skill", header: "Skill", render: (skill) => skillTitle(skill.name, skill) },
          { key: "age", header: "Ages", render: (skill) => getSkill(skill.id)?.manifest.audience.ages.join("–") ?? "—" },
          { key: "status", header: "Status", render: (skill) => SkillRegistryAPI.get(skill.id)?.status ?? getSkill(skill.id)?.manifest.status ?? "—" },
          { key: "subject", header: "Subject", render: (skill) => <select aria-label={translate("admin.subjectsPanel.subjectForValue", { value: skillTitle(skill.name, skill) })}
            className={themeSystem.field("sm", "w-full min-w-32")} value={draft.assignments[skill.id] ?? ""}
            onChange={(event) => {
              const assignments = { ...draft.assignments };
              if (event.target.value) assignments[skill.id] = event.target.value;
              else delete assignments[skill.id];
              change({ ...draft, assignments });
            }}>
            <option value="">{translate("admin.subjectsPanel.unassigned")}</option>
            {draft.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || translate("admin.subjectsPanel.unnamedSubject")}</option>)}
          </select> },
        ]} />
        <div className="flex items-center justify-between gap-2">
          <UIButton variant="ghost" size="sm" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>{translate("admin.subjectsPanel.previous")}</UIButton>
          <span className="koda-admin-label text-muted">{translate("admin.subjectsPanel.pageActivepageOfPages", { activePage: activePage, pages: pages })}</span>
          <UIButton variant="ghost" size="sm" disabled={activePage === pages} onClick={() => setPage(activePage + 1)}>{translate("admin.subjectsPanel.next")}</UIButton>
        </div>
      </div>
    </fieldset>}
  </section>;
}
