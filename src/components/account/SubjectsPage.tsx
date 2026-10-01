import React from "react";
import { usePermissions } from "../../lib/sync";
import { NoAccess } from "./NoAccess";
import { SubjectsPanel } from "./SubjectsPanel";

import { translate } from "../../lib/i18n";
export function SubjectsPage() {
  const { can } = usePermissions();
  if (!can("content:write")) return <NoAccess title={translate("admin.subjectsPage.subjects")} permission="content:write" what={translate("admin.subjectsPage.adminsAndDevelopersManageTheSubject")} />;
  return <div className="max-w-7xl mx-auto space-y-5">
    <div><h1 className="koda-admin-page-title">{translate("admin.subjectsPage.subjects")}</h1>
      <p className="koda-admin-label text-muted mt-1">{translate("admin.subjectsPage.organizeTheLibraryAssignSkillsAnd")}</p></div>
    <SubjectsPanel />
  </div>;
}
