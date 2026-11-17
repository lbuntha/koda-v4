import React, { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, FolderOpen } from "lucide-react";
import { ApiError, accessToken, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIDialog, UISectionHeader } from "../ui";
import { UISelect } from "../ui/UIForm";
import { translate } from "../../lib/i18n";

type Kind = "book" | "puzzle" | "traceItem" | "traceCollection" | "art";
type Counts = Partial<Record<Kind, number>>;

interface Owner {
  id: string;
  email: string;
  name: string;
  role: string;
  counts: Counts;
}

interface OwnersReply {
  owners: Owner[];
  unowned: Counts;
  orphaned: Counts;
  orphanOwners: string[];
}

const KINDS: Kind[] = ["book", "puzzle", "traceItem", "traceCollection", "art"];
const kindLabel = (kind: Kind) => translate(`admin.contentOwners.kind.${kind}`);
const total = (counts: Counts) => KINDS.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0);

/** A "from" the server understands: a person, content from before owners, or a deleted account. */
type Source = { key: string; label: string; counts: Counts; from: string[] };

/**
 * Admin → Content owners: who owns how much Studio content, and handing it over.
 *
 * Content belongs to whoever made it, and a Content creator sees only their
 * own; this is where the admin moves it — everything a person made, when they
 * leave or change role — without opening each Studio.
 */
export const ContentOwnersPanel: React.FC = () => {
  const [data, setData] = useState<OwnersReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ source: Source; to: Owner } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await accessToken();
      setData(await request<OwnersReply>("/admin/content/owners", { token }));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (source: Source, to: Owner) => {
    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      let moved = 0;
      for (const from of source.from) {
        const reply = await request<{ moved: Counts }>("/admin/content/reassign", {
          method: "POST",
          token,
          body: { kind: "all", from, to: to.id },
        });
        moved += total(reply.moved);
      }
      setNotice(translate("admin.contentOwners.moved", { count: moved, name: to.name }));
      setTargets({});
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const sources: Source[] = data
    ? [
        ...data.owners.map((o) => ({ key: o.id, label: o.name === o.email ? o.email : `${o.name} · ${o.email}`, counts: o.counts, from: [o.id] })),
        ...(total(data.unowned) ? [{ key: "none", label: translate("admin.contentOwners.unowned"), counts: data.unowned, from: ["none"] }] : []),
        ...(total(data.orphaned)
          ? [{ key: "orphaned", label: translate("admin.contentOwners.orphaned"), counts: data.orphaned, from: data.orphanOwners }]
          : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      <UISectionHeader
        title={translate("admin.contentOwners.title")}
        subtitle={translate("admin.contentOwners.subtitle")}
        icon={<FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />
      {error && <p className={themeSystem.flash("warning")}>{error}</p>}
      {notice && <p className={themeSystem.flash("success")}>{notice}</p>}
      {!data ? (
        <div className={themeSystem.card("default", "p-6 animate-pulse")} aria-busy="true">
          <div className="h-4 w-48 rounded bg-surface-muted" />
        </div>
      ) : (
        <ul className="space-y-3">
          {sources.map((source) => {
            const others = data.owners.filter((o) => o.id !== source.key);
            const chosen = others.find((o) => o.id === targets[source.key]);
            const owns = total(source.counts);
            const owner = data.owners.find((o) => o.id === source.key);
            return (
              <li key={source.key} className={themeSystem.card("default", "p-4 space-y-3")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate font-bold text-ink">{source.label}</p>
                  {owner && <span className="text-xs font-semibold uppercase tracking-wide text-muted">{owner.role}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {owns === 0 ? (
                    <span className="text-sm text-muted">{translate("admin.contentOwners.nothingYet")}</span>
                  ) : (
                    KINDS.filter((kind) => source.counts[kind]).map((kind) => (
                      <span key={kind} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                        {source.counts[kind]} {kindLabel(kind)}
                      </span>
                    ))
                  )}
                </div>
                {owns > 0 && others.length > 0 && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <UISelect
                      value={targets[source.key] ?? ""}
                      onChange={(event) => setTargets({ ...targets, [source.key]: event.target.value })}
                      aria-label={translate("admin.contentOwners.moveTo")}
                      className="sm:max-w-xs"
                    >
                      <option value="">{translate("admin.contentOwners.moveTo")}</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.email}
                        </option>
                      ))}
                    </UISelect>
                    <UIButton
                      variant="secondary"
                      size="sm"
                      icon={<ArrowRightLeft />}
                      disabled={!chosen || busy}
                      onClick={() => chosen && setConfirm({ source, to: chosen })}
                    >
                      {translate("admin.contentOwners.moveAll")}
                    </UIButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <UIDialog
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={translate("admin.contentOwners.confirmTitle")}
        description={
          confirm
            ? translate("admin.contentOwners.confirmBody", {
                count: total(confirm.source.counts),
                from: confirm.source.label,
                to: confirm.to.email,
              })
            : ""
        }
        confirmText={translate("admin.contentOwners.moveAll")}
        onConfirm={() => {
          if (confirm) void move(confirm.source, confirm.to);
        }}
      />
    </div>
  );
};
