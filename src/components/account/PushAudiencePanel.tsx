import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIDataTable, UISectionHeader } from "../ui";
import { notificationAudience, type AudiencePerson, type PushAudience } from "../../lib/push";

/**
 * Who has turned notifications on.
 *
 * The question the send log cannot answer: it records what went out, and a
 * person who switched notifications on and has not been sent anything yet is
 * invisible there. This lists every registration, grouped by person, with the
 * kinds they accept and the hour a reminder would reach them.
 *
 * The tokens themselves never reach this screen — holding one is the ability
 * to ring that browser.
 */

const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** UTC offset the browser last reported, e.g. "UTC+7". */
const offset = (minutes: number | null) => {
  if (minutes === null) return "timezone unknown";
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const mins = abs % 60;
  return `UTC${sign}${Math.floor(abs / 60)}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
};

const matches = (person: AudiencePerson, query: string) => {
  if (!query) return true;
  const haystack = [person.name, person.email, person.familyName, person.role]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const PushAudiencePanel: React.FC = () => {
  const [audience, setAudience] = useState<PushAudience | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setAudience(await notificationAudience());
    } catch {
      setError("Could not read who has notifications on. This needs permission to manage users.");
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (audience?.rows ?? []).filter((person) => matches(person, query.trim())),
    [audience, query],
  );

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Who can be notified"
        subtitle="Everyone who turned notifications on, and on which browsers"
        icon={<Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
      />

      {audience && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["People", audience.people],
            ["Families", audience.families],
            ["Live browsers", audience.liveDevices],
            ["Retired", audience.retiredDevices],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface-muted border border-line rounded-2xl px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted">{label}</p>
              <p className="text-lg font-black text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      {audience?.truncated && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          Only the most recent 2,000 registrations are shown.
        </p>
      )}

      {audience && audience.people > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, email or family"
          aria-label="Filter people"
          className="w-full bg-surface border border-line rounded-2xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
        />
      )}

      <div>
        {rows.length > 0 && (
          <UIDataTable<AudiencePerson>
            caption="Notification audience"
            rows={rows}
            rowKey={(person) => person.userId}
            pageSize={10}
            defaultSort={{ key: "person", direction: "asc" }}
            columns={[
              {
                key: "person",
                header: "Person",
                render: (person) => (
                  <div className="min-w-40">
                    <p className="font-semibold text-ink truncate">
                      {person.name || person.email || person.userId}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {person.email}
                      {person.familyName && ` · ${person.familyName}`}
                    </p>
                  </div>
                ),
                sortValue: (person) => person.name || person.email || person.userId,
              },
              {
                key: "devices",
                header: "Browsers",
                render: (person) => (
                  <span className={person.liveDevices > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-400"}>
                    {person.liveDevices}/{person.devices.length} live
                  </span>
                ),
                sortValue: (person) => person.liveDevices,
                nowrap: true,
              },
              {
                key: "kinds",
                header: "Kinds",
                render: (person) => person.kinds.length > 0 ? person.kinds.join(" · ") : "None",
                muted: true,
              },
              {
                key: "schedule",
                header: "Schedule",
                render: (person) => (
                  <span className="font-mono text-[10px]">
                    {hour(person.reminderHour)} · quiet {hour(person.quietFrom)}–{hour(person.quietTo)} · {offset(person.tzOffsetMinutes)}
                  </span>
                ),
                muted: true,
                nowrap: true,
              },
            ]}
          />
        )}
        {audience && audience.people === 0 && !error && (
          <p className="text-xs text-muted">
            Nobody has turned notifications on yet. A parent does it from the switch in Settings.
          </p>
        )}
        {audience && audience.people > 0 && rows.length === 0 && (
          <p className="text-xs text-muted">Nobody matches that filter.</p>
        )}
        {!audience && !error && <p className="text-xs text-muted">Reading…</p>}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <button
        disabled={busy}
        onClick={() => void load()}
        className={themeSystem.button("secondary", "sm")}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        {busy ? "Reading…" : "Refresh"}
      </button>
    </section>
  );
};
