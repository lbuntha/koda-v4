/**
 * The menu record, read once for both shells.
 *
 * Koda draws its navigation two ways — a sidebar rail from `rail:` up, a tab
 * bar below it — and neither is allowed to have its own opinion of what the
 * destinations are. The permission filter, the live counts and the
 * decision about which entries a thumb reaches directly all live here, so the
 * phone and the tablet can never drift into offering different things.
 */

import { useMenu, usePermissions, useSession } from "../lib/sync";
import type { NavConfig, NavItemConfig } from "./ui";
import sidebarNav from "../data/sidebarNav.json";
import { getCourseLessons } from "../curriculum";
import { useAudienceViewer } from "../skills/viewer";
import { svgAssetIds } from "../assets/svg";
import { BASE_LANGUAGE, hasMessage, useT } from "../lib/i18n";

export const navDefaults = sidebarNav as NavConfig;

/**
 * Live numbers, without taking the wording off the menu record.
 *
 * Three entries used to be rewritten on the way past — forcing System's label,
 * and replacing Learn's and Art's badges with counts — which quietly threw away
 * whatever the Menu screen had saved for them. A count is still worth more than
 * static text, so the record asks for one instead: a badge of
 * `"{lessons} Levels"` keeps the number live and leaves the wording, the order
 * and the decision to have a badge at all where an operator can edit them.
 */
export const withCounts = <T extends string | null | undefined>(
  text: T,
  counts: { lessons: number; art: number },
): T =>
  (typeof text === "string"
    ? text
        .replace(/\{lessons\}/g, String(counts.lessons))
        .replace(/\{art\}/g, String(counts.art))
    : text) as T;

/**
 * The destinations the phone's tab bar carries, in the order it carries them.
 *
 * Five names, fixed — as many as a phone's bar holds before the targets stop
 * being comfortable under a thumb, and short words, so none is cut off. These
 * are the places a child goes every day: where they are, what to play, books to
 * read, letters to trace, and the switches. Naming them means an operator adding
 * "Roles" to the menu can never push "Learn" off the bar — the tabs a
 * five-year-old needs are not something an admin has to remember to keep at the
 * top of a list.
 *
 * The leaderboard and Children stay one tap away in Settings, which lists
 * everything the bar has no room for.
 *
 * The rail has no such limit and lists the record in full, which is the whole
 * reason it is still the layout for a screen with room for it.
 */
export const MOBILE_TABS = ["home", "game", "library", "trace", "settings"] as const;

export interface TabSplit {
  /** Drawn as tabs, in `MOBILE_TABS` order. */
  primary: NavItemConfig[];
  /** Everything else — Profile included. Reached from inside Settings. */
  overflow: NavItemConfig[];
}

/**
 * Which allowed destinations become tabs on a phone, and which do not.
 *
 * What does not is not lost: Settings lists it. That is one tap further than an
 * overflow sheet hanging off the bar, and it is the right tap — Profile and the
 * management pages are places an adult goes deliberately, not places a thumb
 * lands on the way past.
 */
export const splitTabs = (items: NavItemConfig[]): TabSplit => {
  const byId = new Map(items.map((item) => [item.id, item]));

  const primary = MOBILE_TABS.map((id) => byId.get(id)).filter(
    (item): item is NavItemConfig => Boolean(item),
  );

  return {
    primary,
    overflow: items.filter((item) => !primary.includes(item)),
  };
};

/** A family's own nav, applied by `apply.ts` when one is pulled. */
export function readNavOverride(): NavConfig | null {
  try {
    const raw = localStorage.getItem("koda_sidebar_nav_v1");
    const parsed = raw ? (JSON.parse(raw) as NavConfig) : null;
    return parsed?.sections?.length ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The destinations this account may actually reach, in the operator's order.
 *
 * The server's role-filtered list is authoritative. A matching scoped cache can
 * draw immediately; without one, an authenticated nav stays empty until the
 * response arrives instead of guessing and exposing a hidden item.
 */
export const useNavItems = (): NavItemConfig[] => {
  const viewer = useAudienceViewer();
  const session = useSession();
  const { can, known } = usePermissions();
  const fromServer = useMenu();
  const { t, language } = useT();
  /*
   * An entry's wording, in the language on screen. Looked up in this order:
   *
   * 1. The entry's own translation (`labels[lang]`), typed on the Menu screen.
   *    It is the operator's, like the English label, so it wins.
   * 2. In the base language, the record's `label` — an operator may have
   *    renamed an entry, and that choice stands.
   * 3. In any other language, the app catalog's `nav.<id>`, so a shipped entry
   *    reads right before anybody translates it by hand.
   * 4. The record's `label` — a new entry nobody has translated yet shows its
   *    English rather than nothing.
   */
  const labelFor = (item: NavItemConfig): string =>
    item.labels?.[language] ||
    (language !== BASE_LANGUAGE && hasMessage(`nav.${item.id}`, language) ? t(`nav.${item.id}`) : item.label);
  const badgeFor = (item: NavItemConfig): string | undefined => {
    if (!item.badge) return undefined;
    return (
      item.badges?.[language] ||
      (language !== BASE_LANGUAGE && hasMessage(`navBadge.${item.id}`, language) ? t(`navBadge.${item.id}`) : item.badge)
    );
  };

  const source: NavConfig =
    fromServer !== null
      ? { ...navDefaults, sections: [{ ...navDefaults.sections[0], items: fromServer }] }
      : session
        ? { ...navDefaults, sections: [{ ...navDefaults.sections[0], items: [] }] }
        : (readNavOverride() ?? navDefaults);

  // Each item names the permission it needs, so hiding one is data rather than
  // a set of ids in this file. Hidden while the table is unknown: a parent-only
  // entry must never flash up on a child's tablet.
  const allowed = (item: { requires?: string | null }) =>
    !item.requires || (known && can(item.requires));

  const counts = { lessons: getCourseLessons(viewer).length, art: svgAssetIds.length };

  return source.sections
    .flatMap((section) => section.items)
    .map((item) => ({
      ...item,
      label: withCounts(labelFor(item), counts),
      badge: withCounts(badgeFor(item), counts),
    }))
    // Not presentation: an entry with nothing behind it leads to an empty page,
    // so it is dropped however the record words it.
    .filter((item) => item.id !== "game" || counts.lessons > 0)
    .filter(allowed);
};
