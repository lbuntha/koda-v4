import React from "react";
import { Lock } from "lucide-react";

import { themeSystem } from "../../lib/themeSystem";

/**
 * What a page says when the account may not have it.
 *
 * The menu already hides these entries, so almost nobody sees this — it is for
 * the account whose rights changed while the tab was open, and for the direct
 * link. It names the right rather than apologising, because "ask an owner for
 * *this*" is the only useful thing it can say.
 */
export const NoAccess: React.FC<{ title: string; permission: string; what: string }> = ({
  title,
  permission,
  what,
}) => (
  <div className={"max-w-3xl mx-auto"}>
    <section
      className={themeSystem.card("default", `${themeSystem.spacing.card} flex items-start gap-4`)}
    >
      <div className="w-10 h-10 rounded-xl bg-surface-muted border border-line flex items-center justify-center shrink-0">
        <Lock className="w-5 h-5 text-muted" />
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-ink font-mono">{title}</h2>
        <p className="text-sm text-muted mt-1">
          {what} This takes <span className="font-mono text-ink">{permission}</span>, which the
          family owner can grant you on the Roles page.
        </p>
      </div>
    </section>
  </div>
);
