import React, { useState } from "react";
import { accessToken, request, usePermissions } from "../../lib/sync";
import { cacheSystemSetting } from "../../lib/sync/system";
import { parseSubjects, SUBJECT_SETTING, useSubjects } from "../../lib/subjects";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../ui";

import { translate } from "../../lib/i18n";
export function SkillSubjectEditor({ skillId }: { skillId: string }) {
  const { can } = usePermissions();
  const catalog = useSubjects();
  const [choice, setChoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!can("content:write")) return null;
  const value = choice ?? catalog.assignments[skillId] ?? "";
  const save = async () => {
    setSaving(true); setError("");
    try {
      const token = await accessToken();
      // Read the latest catalog so editing one skill preserves other assignments.
      const settings = await request<Record<string, unknown>>("/system", { token });
      const latest = parseSubjects(settings[SUBJECT_SETTING]);
      if (value && !latest.subjects.some((subject) => subject.id === value)) throw new Error(translate("admin.skillSubjectEditor.thatSubjectWasRemovedReopenThe"));
      const assignments = { ...latest.assignments };
      if (value) assignments[skillId] = value; else delete assignments[skillId];
      const result = await request<{ value: string }>("/system/subjects", {
        method: "PATCH", token, body: { value: JSON.stringify({ ...latest, assignments }) },
      });
      cacheSystemSetting(SUBJECT_SETTING, result.value);
      setChoice(null);
    } catch (e) { setError(e instanceof Error ? e.message : translate("admin.skillSubjectEditor.couldNotSaveSubject")); }
    finally { setSaving(false); }
  };
  return <div className="space-y-2">
    <label className="koda-admin-label block" htmlFor={`subject-${skillId}`}>{translate("admin.skillSubjectEditor.subject")}</label>
    <div className="flex flex-wrap gap-2">
      <select id={`subject-${skillId}`} value={value} disabled={saving} onChange={(event) => setChoice(event.target.value)} className={themeSystem.field("sm", "flex-1 min-w-40")}>
        <option value="">{translate("admin.skillSubjectEditor.unassigned")}</option>
        {catalog.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
      <UIButton size="sm" isLoading={saving} disabled={choice === null || value === (catalog.assignments[skillId] ?? "")} onClick={() => void save()}>{saving ? translate("admin.skillSubjectEditor.saving") : translate("admin.skillSubjectEditor.saveSubject")}</UIButton>
    </div>
    <p className="koda-admin-label text-muted">{translate("admin.skillSubjectEditor.chooseWhereThisSkillAppearsOn")}</p>
    {error && <p role="alert" className={themeSystem.flash("error")}>{error}</p>}
  </div>;
}
