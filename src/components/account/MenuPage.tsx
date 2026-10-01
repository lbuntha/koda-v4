import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  ListOrdered,
  Search,
  RotateCcw,
  Baby,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ApiError, accessToken, Menu, refreshMenu, request, useMenu } from "../../lib/sync";
import { listSvgAssets, type SvgAssetRecord } from "../../lib/svgAssetsApi";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UISectionHeader, sidebarIcons } from "../ui";
import { ART_ICON_PREFIX, SidebarIcon } from "../ui/sidebarIcon";
import { UIIconPicker } from "../ui/UIIconPicker";
import { BASE_LANGUAGE, availableLanguages, hasMessage, translate } from "../../lib/i18n";

/**
 * The sidebar, as an editable list.
 *
 * Entries come from the `menu_items` collection: rows shipped with the service
 * are the defaults, and what is saved here is this family's override of one
 * entry. That is why nothing can be *created* on this page — a menu item needs
 * a page behind it, which is a release, not a setting.
 *
 * Renaming, reordering, hiding and *who sees it* are the four things that do
 * not need code, so they are the four things offered.
 */

interface Item {
  id: string;
  label: string;
  icon: string;
  badge?: string | null;
  labels?: Record<string, string> | null;
  badges?: Record<string, string> | null;
  requires?: string | null;
  roles?: string[] | null;
  order: number;
  enabled: boolean;
}

/**
 * What the sidebar shows in a language when this entry has no translation of
 * its own — the app catalog's wording, else the English. Shown as the field's
 * placeholder, so an empty box says what will actually appear.
 */
const fallbackWording = (item: Item, field: "label" | "badge", code: string): string => {
  const key = field === "label" ? `nav.${item.id}` : `navBadge.${item.id}`;
  return hasMessage(key, code) ? translate(key, undefined, code) : ((field === "label" ? item.label : item.badge) ?? "");
};

/** The roles an entry can be assigned to. Fetched, so a new one appears here. */
interface Matrix {
  permissions: string[];
  roles: Record<string, string[]>;
}

const ROLE_ORDER = ["owner", "parent", "caregiver", "student", "child"];

const MENU_GROUPS = [
  { id: "admin", get label() { return translate("admin.menuPage.admin"); }, get description() { return translate("admin.menuPage.controlFeaturesAndAccessForEnd"); }, icon: ShieldCheck },
  { id: "parents", get label() { return translate("admin.menuPage.parents"); }, get description() { return translate("admin.menuPage.familyAndAdultNavigation"); }, icon: Users },
  { id: "child", get label() { return translate("admin.menuPage.child"); }, get description() { return translate("admin.menuPage.childFacingNavigation"); }, icon: Baby },
  { id: "students", get label() { return translate("admin.menuPage.students"); }, get description() { return translate("admin.menuPage.studentFacingNavigation"); }, icon: GraduationCap },
] as const;

/** The family roles each audience tab stands for. Operators are not here: an
 *  entry lands in "Admin" precisely when no family role can reach it. */
const AUDIENCE_ROLES: Record<string, string[]> = {
  parents: ["owner", "parent", "caregiver"],
  child: ["child"],
  students: ["student"],
};

/** Would this role be shown this entry? The same two questions the server asks. */
const roleSees = (item: Item, role: string, matrix: Matrix): boolean => {
  if (item.roles?.length && !item.roles.includes(role)) return false;
  return !item.requires || (matrix.roles[role] ?? []).includes(item.requires);
};

/**
 * Which audiences actually see an entry, answered from the live role table.
 *
 * This used to be a guess — "has a `requires` ⇒ Admin" — and the guess was
 * wrong for every capability a parent genuinely holds. Children, Skills and
 * Scoring are gated on `learner:create`, `settings:write` and `scoring:write`,
 * all of which an owner has, so all three sat under Admin while the sidebar
 * correctly showed them to parents. The page said a parent had four entries
 * and the rail drew seven, and the rail was right.
 *
 * `matrix` is the server's own role → permission table, already loaded on this
 * page for the visibility editor, so there is no second source to disagree with.
 */
const groupsForItem = (item: Item, matrix: Matrix): string[] => {
  const groups = Object.entries(AUDIENCE_ROLES)
    .filter(([, roles]) => roles.some((role) => roleSees(item, role, matrix)))
    .map(([group]) => group);
  // Nothing in a family can reach it, so it belongs to whoever runs the service.
  return groups.length ? groups : ["admin"];
};

/** One grid for the header and every row — the reason the columns line up. */
const FIELD =
  themeSystem.field("lg", "font-mono");

/**
 * A capability in the fewest words that stay true.
 *
 * Short enough to read in a column: "Can change settings" says the same thing
 * as "whoever is allowed to change settings" and fits where the longer phrase
 * truncated to "Whoever can c…", which said nothing at all.
 */
const CAPABILITY_HINT: Record<string, string> = {
  "settings:write": "Can change settings",
  "settings:read": "Can see settings",
  "member:list": "Can see the family",
  "member:role": "Can change roles",
  "learner_data:read": "Can see records",
  "learner:read": "Can see the children",
  "device:list": "Can see devices",
};

/** The visibility rule as one readable line. */
const summarise = (item: Item): string => {
  const roles = item.roles?.length ? item.roles.join(", ") : null;
  const capability = item.requires ? (CAPABILITY_HINT[item.requires] ?? item.requires) : null;
  if (roles && capability) return `${roles} · ${capability.toLowerCase()}`;
  return roles ?? capability ?? "everyone";
};

export const MenuPage: React.FC = () => {
  useMenu();
  const [items, setItems] = useState<Item[] | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [artAssets, setArtAssets] = useState<SvgAssetRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which row has its visibility rule open. One at a time keeps the list scannable. */
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MENU_GROUPS.map((group) => [group.id, true])),
  );
  const [iconPickerItem, setIconPickerItem] = useState<string | null>(null);

  /** Every entry, hidden ones included — the sidebar's list would not show those. */
  const load = async () => {
    const token = await accessToken();
    const [all, table, art] = await Promise.all([
      request<{ items: Item[] }>("/menu/all", { token }),
      request<Matrix>("/family/permissions", { token }),
      listSvgAssets().catch(() => []),
    ]);
    setItems(all.items);
    setMatrix(table);
    setArtAssets(art);
  };

  useEffect(() => {
    load().catch((err) => {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? translate("admin.menuPage.offlineTheMenuLivesOnThe")
          : problem.message,
      );
    });
  }, []);

  const save = async (
    item: Item,
    patch: Record<string, unknown>,
  ) => {
    setBusy(item.id);
    setError(null);
    try {
      const token = await accessToken();
      await request(`/menu/${item.id}`, { method: "PATCH", token, body: patch });
      Menu.update(item.id, patch as Partial<Item>);
      await Promise.all([load(), refreshMenu()]);
      playSound("pop");
    } catch (err) {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? translate("admin.menuPage.offlineTheMenuIsStoredOn")
          : problem.message,
      );
    } finally {
      setBusy(null);
    }
  };

  /** Forget this family's changes to one entry, so the shipped default applies. */
  const reset = async (item: Item) => {
    setBusy(item.id);
    setError(null);
    try {
      const token = await accessToken();
      await request(`/menu/${item.id}`, { method: "DELETE", token });
      await Promise.all([load(), refreshMenu()]);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  /** Swaps two entries' order values, which is what "move up" means here. */
  const move = async (index: number, direction: -1 | 1) => {
    if (!items) return;
    const other = items[index + direction];
    const item = items[index];
    if (!other) return;

    setBusy(item.id);
    try {
      const token = await accessToken();
      await Promise.all([
        request(`/menu/${item.id}`, { method: "PATCH", token, body: { order: other.order } }),
        request(`/menu/${other.id}`, { method: "PATCH", token, body: { order: item.order } }),
      ]);
      await Promise.all([load(), refreshMenu()]);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const moveTo = async (fromId: string, toId: string) => {
    if (!items || fromId === toId) return;
    const from = items.findIndex((item) => item.id === fromId);
    const to = items.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    setBusy(fromId);
    try {
      const token = await accessToken();
      await Promise.all([
        request(`/menu/${items[from].id}`, { method: "PATCH", token, body: { order: items[to].order } }),
        request(`/menu/${items[to].id}`, { method: "PATCH", token, body: { order: items[from].order } }),
      ]);
      await Promise.all([load(), refreshMenu()]);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
      setDraggedId(null);
    }
  };

  const resetAll = async () => {
    if (!items) return;
    if (!window.confirm("Reset all menu entries to their defaults?")) return;
    setBusy("__all__");
    setError(null);
    try {
      const token = await accessToken();
      await Promise.all(items.map((item) => request(`/menu/${item.id}`, { method: "DELETE", token })));
      await Promise.all([load(), refreshMenu()]);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  // Both arrive from the same request; grouping is meaningless without the
  // role table, and guessing while it loads is what this page did before.
  if (!items || !matrix) {
    return (
      <div className={"max-w-5xl mx-auto space-y-4"} aria-label={translate("admin.menuPage.loadingMenu")} aria-busy="true">
        <div className="h-8 w-40 rounded-lg bg-surface-muted animate-pulse" />
        <div className={themeSystem.card("default", "p-5 space-y-4")}>
          {[0, 1, 2, 3].map((row) => <div key={row} className="h-20 rounded-2xl bg-surface-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const visibleItems = items.filter((item) =>
    (showHidden || item.enabled) &&
    (!needle || item.label.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle)),
  );
  const groupedItems = MENU_GROUPS.map((group) => ({
    ...group,
    items: visibleItems.filter((item) => groupsForItem(item, matrix).includes(group.id)),
  }));

  return (
    <div className={"max-w-5xl mx-auto space-y-6"}>
      <div>
        <h2 className={themeSystem.typography("h2")}>{translate("admin.menuPage.menu")}</h2>
        <p className={themeSystem.typography("body-sm", "mt-1")}>
          {translate("admin.menuPage.whatTheSidebarShowsAndIn")}
        </p>
      </div>

      {error && <p className={themeSystem.flash("warning")}>{error}</p>}

      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-2`)}>
        <UISectionHeader
          title={translate("admin.menuPage.sidebarEntries")}
          subtitle={translate("admin.menuPage.lengthShownOfLength2", { length: items.filter((i) => i.enabled).length, length2: items.length })}
          icon={<ListOrdered className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          action={
            <button onClick={() => void resetAll()} disabled={busy !== null} className={themeSystem.button("secondary", "sm")}>
              <RotateCcw />
              {translate("admin.menuPage.resetAll")}
            </button>
          }
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] items-start py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={translate("admin.menuPage.searchMenuEntries")}
              aria-label={translate("admin.menuPage.searchMenuEntries")}
              className={`${FIELD} w-full pl-10`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-body px-1">
            <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} className="h-4 w-4 accent-indigo-600" />
            {translate("admin.menuPage.includeHiddenEntries")}
          </label>
        </div>

        <div className="space-y-6">
          {groupedItems.map((group) => (
            <section key={group.id} className="space-y-3" aria-labelledby={`menu-group-${group.id}`}>
              <button
                type="button"
                onClick={() => setCollapsedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
                aria-expanded={!collapsedGroups[group.id]}
                className="flex items-center justify-between gap-3 w-full px-1 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border-2 border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <group.icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 id={`menu-group-${group.id}`} className="text-base font-bold text-ink">{group.label}</h3>
                    <p className="text-xs text-muted truncate">{group.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <UIBadge variant="neutral">{group.items.length}</UIBadge>
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform ${collapsedGroups[group.id] ? "-rotate-90" : ""}`} aria-hidden="true" />
                </div>
              </button>

              {!collapsedGroups[group.id] && (
                <>
                  {group.id === "admin" && (
                    <p className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50/70 dark:bg-indigo-500/10 px-3 py-2 text-xs text-body">
                      {translate("admin.menuPage.use")}{" "}<span className="font-semibold text-indigo-700 dark:text-indigo-300">{translate("admin.menuPage.visibility")}</span>{" "}{translate("admin.menuPage.onEachFeatureToChooseWhether")}
                    </p>
                  )}

                  {group.items.length ? group.items.map((item) => {
                const index = items.findIndex((entry) => entry.id === item.id);
                const ruleOpen = openRule === item.id;

                return (
                  <div
                    key={`${group.id}-${item.id}`}
                    draggable={busy === null}
                    onDragStart={() => setDraggedId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => draggedId && void moveTo(draggedId, item.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`${themeSystem.card("default", "p-4 sm:p-5 space-y-4 cursor-grab active:cursor-grabbing")} ${item.enabled ? "" : "opacity-60"}`}
                  >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <GripVertical className="w-4 h-4 shrink-0 text-muted" aria-hidden="true" />
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border-2 border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                      <SidebarIcon name={item.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-ink truncate">{item.label}</span>
                        <UIBadge variant={item.enabled ? "success" : "neutral"}>
                          {item.enabled ? translate("admin.menuPage.visible") : translate("admin.menuPage.hidden")}
                        </UIBadge>
                      </div>
                      <span className="block mt-0.5 text-xs font-mono text-muted truncate">{item.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => void move(index, -1)}
                      disabled={index === 0 || busy !== null}
                      aria-label={translate("admin.menuPage.moveLabelUp", { label: item.label })}
                      className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void move(index, 1)}
                      disabled={index === items.length - 1 || busy !== null}
                      aria-label={translate("admin.menuPage.moveLabelDown", { label: item.label })}
                      className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void save(item, { enabled: !item.enabled })}
                      disabled={busy !== null}
                      title={item.enabled ? translate("admin.menuPage.hideThisEntryForEveryone") : translate("admin.menuPage.showItAgain")}
                      aria-label={item.enabled ? translate("admin.menuPage.hideLabel", { label: item.label }) : translate("admin.menuPage.showLabel", { label: item.label })}
                      className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                    >
                      {item.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => void reset(item)}
                      disabled={busy !== null}
                      title={translate("admin.menuPage.forgetThisFamilySChangesTo")}
                      aria-label={translate("admin.menuPage.resetLabel", { label: item.label })}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-body">{translate("admin.menuPage.icon")}</span>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      // Which tab opens and what the search box holds are the
                      // picker's own state, initialised from the icon it is
                      // handed — this used to set them from here, against
                      // setters that no longer exist, so opening the picker
                      // threw. It is mounted fresh on every open, so there is
                      // nothing left here to reset.
                      onClick={() => setIconPickerItem(item.id)}
                      aria-label={translate("admin.menuPage.changeIconForId", { id: item.id })}
                      className={`${FIELD} w-full flex items-center gap-2 text-left cursor-pointer`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <SidebarIcon name={item.icon} className="w-5 h-5" />
                      </span>
                      <span className="truncate">{item.icon.startsWith(ART_ICON_PREFIX) ? item.icon.slice(ART_ICON_PREFIX.length) : item.icon}</span>
                    </button>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-body">{translate("admin.menuPage.labelEnglish")}</span>
                    <input
                      defaultValue={item.label}
                      disabled={busy === item.id}
                      onBlur={(e) => {
                        const label = e.target.value.trim();
                        if (label && label !== item.label) void save(item, { label });
                      }}
                      aria-label={translate("admin.menuPage.labelForId", { id: item.id })}
                      className={`${FIELD} w-full font-semibold`}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-body">{translate("admin.menuPage.badgeEnglish")}</span>
                    <input
                      defaultValue={item.badge ?? ""}
                      placeholder={translate("admin.menuPage.optional")}
                      disabled={busy === item.id}
                      onBlur={(e) => {
                        const badge = e.target.value.trim();
                        if (badge !== (item.badge ?? "")) void save(item, { badge });
                      }}
                      aria-label={translate("admin.menuPage.badgeForId", { id: item.id })}
                      className={`${FIELD} w-full`}
                    />
                  </label>
                </div>

                {/*
                  * The same entry in every other language the app ships.
                  *
                  * One row per catalog, so a language added to the app shows up
                  * here with no change to this page. Empty means "use the
                  * default", and the placeholder says what that default is.
                  */}
                {availableLanguages()
                  .filter((lang) => lang.code !== BASE_LANGUAGE)
                  .map((lang) => (
                    <div key={lang.code} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <span className="hidden lg:flex items-end pb-2.5 text-xs font-semibold text-muted">
                        {lang.name} · {lang.englishName}
                      </span>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-body">
                          {translate("admin.menuPage.label")}{" "}<span lang={lang.code}>{lang.name}</span>
                        </span>
                        <input
                          lang={lang.code}
                          defaultValue={item.labels?.[lang.code] ?? ""}
                          placeholder={fallbackWording(item, "label", lang.code)}
                          disabled={busy === item.id}
                          onBlur={(e) => {
                            const text = e.target.value.trim();
                            if (text !== (item.labels?.[lang.code] ?? "")) {
                              void save(item, { labels: { ...item.labels, [lang.code]: text } });
                            }
                          }}
                          aria-label={translate("admin.menuPage.englishnameLabelForId", { englishName: lang.englishName, id: item.id })}
                          className={`${FIELD} w-full font-semibold`}
                        />
                      </label>
                      {item.badge ? (
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-body">
                            {translate("admin.menuPage.badge")}{" "}<span lang={lang.code}>{lang.name}</span>
                          </span>
                          <input
                            lang={lang.code}
                            defaultValue={item.badges?.[lang.code] ?? ""}
                            placeholder={fallbackWording(item, "badge", lang.code)}
                            disabled={busy === item.id}
                            onBlur={(e) => {
                              const text = e.target.value.trim();
                              if (text !== (item.badges?.[lang.code] ?? "")) {
                                void save(item, { badges: { ...item.badges, [lang.code]: text } });
                              }
                            }}
                            aria-label={translate("admin.menuPage.englishnameBadgeForId", { englishName: lang.englishName, id: item.id })}
                            className={`${FIELD} w-full`}
                          />
                        </label>
                      ) : null}
                    </div>
                  ))}

                <button
                  onClick={() => {
                    playSound("pop");
                    setOpenRule(ruleOpen ? null : item.id);
                  }}
                  aria-expanded={ruleOpen}
                  className="flex items-center justify-between gap-2 w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-left cursor-pointer group"
                >
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{translate("admin.menuPage.visibility")}</span>
                    <span className="block mt-0.5 text-sm text-body group-hover:text-indigo-600">{summarise(item)}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-muted transition ${ruleOpen ? "rotate-180" : ""}`} />
                </button>

                {ruleOpen && matrix && (
                  <Visibility item={item} matrix={matrix} busy={busy !== null} onSave={save} />
                )}
                  </div>
                );
                  }) : (
                    <div className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted">
                      {translate("admin.menuPage.noEntriesInThisAudience")}
                    </div>
                  )}
                </>
              )}
            </section>
          ))}
        </div>

      </section>

      {iconPickerItem && (() => {
        const item = items.find((entry) => entry.id === iconPickerItem);
        return item ? <UIIconPicker value={item.icon} artIds={artAssets.map((asset) => asset.id)} onClose={() => setIconPickerItem(null)} onSelect={(value) => { setIconPickerItem(null); void save(item, { icon: value }); }} /> : null;
      })()}
    </div>
  );
};

/**
 * Who sees an entry.
 *
 * Two ways to say it, and they answer different questions:
 *
 * * **By what someone can do** — "whoever can change settings". Survives a role
 *   being added or renamed, and never shows a page the API then refuses.
 * * **By role** — an explicit list, for the cases a capability cannot express:
 *   hiding Learn from a grandparent who *could* open it but has no reason to.
 *
 * A role list only ever *narrows*. It cannot grant access — the routes still
 * check permissions — so the worst a wrong list does is hide something.
 */
const Visibility: React.FC<{
  item: Item;
  matrix: Matrix;
  busy: boolean;
  onSave: (item: Item, patch: Record<string, unknown>) => void;
}> = ({ item, matrix, busy, onSave }) => {
  const roles = ROLE_ORDER.filter((r) => matrix.roles[r]);
  const assigned = item.roles ?? [];

  const toggleRole = (role: string) => {
    const next = assigned.includes(role)
      ? assigned.filter((r) => r !== role)
      : [...assigned, role];
    onSave(item, next.length ? { roles: next } : { clearRoles: true });
  };

  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {translate("admin.menuPage.shownTo")}
        </span>
        {!assigned.length && !item.requires && <UIBadge variant="neutral">{translate("admin.menuPage.everyone")}</UIBadge>}
        {item.requires && (
          <UIBadge variant="primary">
            {CAPABILITY_HINT[item.requires] ?? item.requires}
          </UIBadge>
        )}
        {assigned.map((role) => (
          <UIBadge key={role} variant="warning">
            {role}
          </UIBadge>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {roles.map((role) => (
          <button
            key={role}
            disabled={busy}
            onClick={() => toggleRole(role)}
            aria-pressed={assigned.includes(role)}
            className={themeSystem.button(assigned.includes(role) ? "primary" : "secondary", "sm")}
          >
            {role}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {translate("admin.menuPage.andOnlyIfTheyCan")}
        </label>
        <select
          value={item.requires ?? ""}
          disabled={busy}
          onChange={(e) =>
            onSave(item, e.target.value ? { requires: e.target.value } : { clearRequires: true })
          }
          className={themeSystem.field("sm", "font-mono")}
        >
          <option value="">{translate("admin.menuPage.anything")}</option>
          {matrix.permissions.map((permission) => (
            <option key={permission} value={permission}>
              {permission}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {translate("admin.menuPage.rolesNarrowTheyNeverGrantThe")}
      </p>
    </div>
  );
};
