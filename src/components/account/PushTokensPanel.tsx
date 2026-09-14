import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIDataTable, UISectionHeader } from "../ui";
import { pushTokenReport, type PushTokenReport, type PushTokenRow } from "../../lib/push";

/**
 * Every FCM registration token, by user. Platform admins only.
 *
 * A token is the ability to ring one browser, so each one stays masked until
 * somebody asks to see it, and copying is a deliberate tap.
 */

const mask = (token: string) => `${token.slice(0, 8)}…${token.slice(-6)}`;

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

const who = (row: PushTokenRow) => row.name || row.email || row.userId || "Unknown account";

const matches = (row: PushTokenRow, query: string) => {
  if (!query) return true;
  const haystack = [row.name, row.email, row.familyName, row.userId, row.platform]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const TokenCell: React.FC<{ token: string }> = ({ token }) => {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (insecure origin or permission); revealing still works.
      setShown(true);
    }
  };

  return (
    <div className="min-w-48 space-y-1">
      <code className={`block font-mono text-[10px] text-ink ${shown ? "break-all" : "truncate"}`}>
        {shown ? token : mask(token)}
      </code>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShown((value) => !value);
          }}
          className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
        >
          {shown ? "Hide" : "Reveal"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void copy();
          }}
          className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};

export const PushTokensPanel: React.FC = () => {
  const [report, setReport] = useState<PushTokenReport | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await pushTokenReport());
    } catch {
      setError("Could not read the tokens. This report is for platform admins only.");
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (report?.rows ?? []).filter((row) => matches(row, query.trim())),
    [report, query],
  );
  const people = useMemo(() => new Set(rows.map((row) => row.userId)).size, [rows]);

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Push tokens"
        subtitle="Every FCM registration token, by user — masked until revealed"
        icon={<KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {report && (
        <p className="text-xs text-muted">
          {rows.length} {rows.length === 1 ? "token" : "tokens"} across {people}{" "}
          {people === 1 ? "person" : "people"}
          {report.truncated && " · only the most recent 2,000 registrations are shown"}
        </p>
      )}

      {report && report.rows.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, email, family or device"
          aria-label="Filter tokens"
          className="w-full bg-surface border border-line rounded-2xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
        />
      )}

      {rows.length > 0 && (
        <UIDataTable<PushTokenRow>
          caption="Push tokens by user"
          rows={rows}
          rowKey={(row) => row.token}
          pageSize={20}
          defaultSort={{ key: "user", direction: "asc" }}
          columns={[
            {
              key: "user",
              header: "User",
              render: (row) => (
                <div className="min-w-40">
                  <p className="font-semibold text-ink truncate">{who(row)}</p>
                  <p className="text-[11px] text-muted truncate">
                    {row.email}
                    {row.familyName && ` · ${row.familyName}`}
                    {row.role && ` · ${row.role}`}
                  </p>
                </div>
              ),
              sortValue: (row) => who(row).toLowerCase(),
            },
            {
              key: "device",
              header: "Device",
              render: (row) => (
                <span title={row.ua ?? undefined}>{row.platform || "Unknown device"}</span>
              ),
              sortValue: (row) => row.platform || "",
              muted: true,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <span
                  className={
                    row.retired
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-700 dark:text-emerald-300"
                  }
                >
                  {row.retired ? "retired" : row.failures > 0 ? `live · ${row.failures} failed` : "live"}
                </span>
              ),
              sortValue: (row) => (row.retired ? 1 : 0),
              nowrap: true,
            },
            {
              key: "token",
              header: "Token",
              render: (row) => <TokenCell token={row.token} />,
            },
            {
              key: "seen",
              header: "Last seen",
              render: (row) => when(row.refreshedAt),
              sortValue: (row) => row.refreshedAt || "",
              muted: true,
              nowrap: true,
            },
          ]}
        />
      )}

      {report && report.rows.length === 0 && !error && (
        <p className="text-xs text-muted">No browser has registered for notifications yet.</p>
      )}
      {report && report.rows.length > 0 && rows.length === 0 && (
        <p className="text-xs text-muted">Nothing matches that filter.</p>
      )}
      {!report && !error && <p className="text-xs text-muted">Reading…</p>}
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
