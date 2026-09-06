import React from "react";
import { usePermissions } from "../../lib/sync";
import { NoAccess } from "./NoAccess";
import { SubjectsPanel } from "./SubjectsPanel";

export function SubjectsPage() {
  const { can } = usePermissions();
  if (!can("content:write")) return <NoAccess title="Subjects" permission="content:write" what="Admins and developers manage the subject catalog for every learner." />;
  return <div className="max-w-7xl mx-auto space-y-5">
    <div><h1 className="koda-admin-page-title">Subjects</h1>
      <p className="koda-admin-label text-muted mt-1">Organize the library, assign skills, and choose the order learners see.</p></div>
    <SubjectsPanel />
  </div>;
}
