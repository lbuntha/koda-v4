/**
 * The drawings behind every puzzle, and a way to fix the ones that look bad.
 *
 * Opens the Art page's own SVG editor (paste or edit the markup, see what the
 * sanitiser kept, or have a model redraw it) and saves into the Art library
 * under the same id, `rebus-<name>`. That wins over the built-in drawing on
 * every device with no release, and the built-in one stays underneath, so
 * "back to the built-in" is simply removing the override. A drawing added here
 * that has no built-in version becomes available to puzzles at once.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { SvgMarkup } from "../../assets/svg";
import { SvgAssetEditorModal } from "../../components/SvgAssetEditorModal";
import { UIBadge, UIButton, UISearchInput, UITabs } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { SharedArtStore } from "../../lib/sharedArtStore";
import { deleteSvgAsset, listSvgAssets } from "../../lib/svgAssetsApi";
import { ArtStore } from "../../lib/sync/artStore";
import { themeSystem } from "../../lib/themeSystem";
import { ICON_PREFIX } from "../icons/library";
import { REBUS_ART_CATEGORY, useRebusIcons, type RebusIcon } from "../icons/useRebusIcons";
import { PuzzleCard } from "./PuzzleCard";
import { StudioAPI, type StudioPuzzle } from "./studioApi";
import { messageOf, useStudioAction } from "./useStudioAction";

type Filter = "all" | "edited" | "added";

export const DrawingsPanel: React.FC = () => {
  const { t } = useT();
  const icons = useRebusIcons();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editor, setEditor] = useState<{ icon: RebusIcon | null } | null>(null);
  const [done, setDone] = useState("");
  const [usage, setUsage] = useState<Record<string, { count: number; answers: string[] }>>({});
  /** The drawing whose puzzles are being looked at, if any. */
  const [using, setUsing] = useState<RebusIcon | null>(null);
  const action = useStudioAction();

  const loadUsage = useCallback(async () => {
    try {
      setUsage((await StudioAPI.iconUsage()).usage);
    } catch {
      /* Counts are a convenience; the drawings are still editable without them. */
    }
  }, []);
  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const shown = useMemo(
    () =>
      icons.filter((i) => i.name.includes(query.trim().toLowerCase())).filter((i) => (filter === "all" ? true : filter === "edited" ? i.inArt && i.builtIn : !i.builtIn)),
    [icons, query, filter],
  );
  const edited = icons.filter((i) => i.inArt && i.builtIn).length;
  const added = icons.filter((i) => !i.builtIn).length;

  const artIds = [...new Set([...SharedArtStore.all().map((a) => a.id), ...ArtStore.all().keys()])];

  const refresh = async () => {
    try {
      await listSvgAssets();
    } catch {
      /* The save itself worked; the list catches up on the next sync. */
    }
  };

  const removeOverride = (icon: RebusIcon) =>
    void action
      .run(async () => {
        await deleteSvgAsset(icon.id);
        await ArtStore.remove(icon.id);
        await refresh();
      })
      .then((ok) => ok && setDone(icon.builtIn ? t("rebus.studio.backToBuiltIn", { name: icon.name }) : t("rebus.studio.drawingDeleted", { name: icon.name })));

  const editorModal = editor && (
    <SvgAssetEditorModal
      editingId={editor.icon?.inArt ? editor.icon.id : null}
      initialId={editor.icon?.id ?? ICON_PREFIX}
      initialMarkup={editor.icon?.markup ?? ""}
      initialCategory={REBUS_ART_CATEGORY}
      existingIds={artIds}
      existingCategories={[REBUS_ART_CATEGORY]}
      onClose={() => setEditor(null)}
      onSaved={(id) => {
        setEditor(null);
        setDone(t("rebus.studio.drawingSaved", { name: id.replace(ICON_PREFIX, "") }));
        void refresh();
        void loadUsage();
      }}
    />
  );

  if (using) {
    // Look the drawing up again by id, so the page shows its current version after an edit.
    const current = icons.find((i) => i.id === using.id) ?? using;
    return (
      <>
        <UsedIn icon={current} onBack={() => setUsing(null)} onEdit={() => setEditor({ icon: current })} />
        {editorModal}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.tabDrawings")}>
      <div>
        <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.drawingsTitle")}</h3>
        <p className={themeSystem.typography("body-sm", "mt-1")}>{t("rebus.studio.drawingsText")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <UISearchInput size="sm" label={t("rebus.studio.searchIcons")} className="min-w-48 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} />
        <UITabs
          label={t("rebus.studio.tabDrawings")}
          items={[
            { id: "all", label: t("rebus.studio.all"), count: icons.length },
            { id: "edited", label: t("rebus.studio.drawingsEdited"), count: edited },
            { id: "added", label: t("rebus.studio.drawingsAdded"), count: added },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
        />
        <UIButton icon={<Plus />} onClick={() => setEditor({ icon: null })}>
          {t("rebus.studio.newDrawing")}
        </UIButton>
      </div>

      {done && (
        <p role="status" className={themeSystem.flash("success")}>
          {done}
        </p>
      )}
      {action.error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {action.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {shown.map((icon) => (
          <article key={icon.id} aria-label={icon.name} className={themeSystem.card("default", "flex flex-col items-center gap-2 p-3")}>
            <div className="aspect-square w-full max-w-28 rounded-2xl border border-line bg-white p-2">
              <SvgMarkup markup={icon.markup} raw size="100%" />
            </div>
            <div className="text-center">
              <div className="font-black text-ink">{icon.name}</div>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {icon.inArt && icon.builtIn && <UIBadge variant="primary">{t("rebus.studio.edited")}</UIBadge>}
                {!icon.builtIn && <UIBadge variant="info">{t("rebus.studio.added")}</UIBadge>}
                {!icon.inArt && <UIBadge variant="neutral">{t("rebus.studio.builtIn")}</UIBadge>}
              </div>
            </div>
            <UIButton size="sm" variant="ghost" onClick={() => setUsing(icon)} aria-label={t("rebus.studio.usedInAria", { name: icon.name })}>
              {usage[icon.id]?.count ? t("rebus.studio.usedIn", { count: usage[icon.id].count }) : t("rebus.studio.notUsed")}
            </UIButton>
            <div className="flex flex-wrap justify-center gap-1.5">
              <UIButton size="sm" variant="secondary" icon={<Pencil />} onClick={() => setEditor({ icon })}>
                {t("rebus.studio.editDrawing")}
              </UIButton>
              {icon.inArt && (
                <UIButton size="sm" variant="ghost" icon={icon.builtIn ? <RotateCcw /> : <Trash2 />} disabled={action.busy} onClick={() => removeOverride(icon)}>
                  {icon.builtIn ? t("rebus.studio.useBuiltIn") : t("rebus.studio.delete")}
                </UIButton>
              )}
            </div>
          </article>
        ))}
        {shown.length === 0 && <p className="col-span-full text-sm text-muted">{t("rebus.studio.noIcons")}</p>}
      </div>

      {editorModal}
    </section>
  );
};


/**
 * Every puzzle that uses one drawing, drawn as a child would see it, with the
 * way to edit the drawing on the same screen. Looking before saving is how an
 * admin finds that a change to `fire` touches "hot dog", "firefly" and
 * "hot air" all at once; looking after saving shows the result in place.
 */
const UsedIn: React.FC<{ icon: RebusIcon; onBack(): void; onEdit(): void }> = ({ icon, onBack, onEdit }) => {
  const { t } = useT();
  const [rows, setRows] = useState<StudioPuzzle[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    StudioAPI.list({ icon: icon.id, limit: 100 })
      .then((out) => {
        if (!live) return;
        setRows(out.puzzles);
        setTotal(out.total);
      })
      .catch((e) => live && setError(messageOf(e)));
    return () => {
      live = false;
    };
  }, [icon.id]);

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.usedInTitle", { name: icon.name })}>
      <div className="flex flex-wrap items-center gap-3">
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
          {t("rebus.studio.backToDrawings")}
        </UIButton>
        <div className="h-16 w-16 rounded-2xl border border-line bg-white p-1.5">
          <SvgMarkup markup={icon.markup} raw size="100%" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.usedInTitle", { name: icon.name })}</h3>
          <p className={themeSystem.typography("caption")}>{rows ? t("rebus.studio.usedInCount", { count: total }) : t("rebus.studio.loading")}</p>
        </div>
        <UIButton icon={<Pencil />} onClick={onEdit}>
          {t("rebus.studio.editDrawing")}
        </UIButton>
      </div>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {rows && rows.length === 0 && <p className={themeSystem.typography("body-sm")}>{t("rebus.studio.usedInNone")}</p>}
      {rows && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <PuzzleCard key={p.id} puzzle={p} />
          ))}
        </div>
      )}
    </section>
  );
};
