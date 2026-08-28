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
 * Four names, fixed. A tab bar holds about four before the targets stop being
 * comfortable under a thumb, and these are the four a family reaches for on a
 * phone: where they are, what to play, the children being looked after, and the
 * switches. Naming them means an operator adding "Roles" to the menu can never
 * push "Learn" off the bar — the tabs a five-year-old needs are not something
 * an admin has to remember to keep at the top of a list.
 *
 * `children` is in the record only for an account holding `learner:create`, so
 * a child's own tablet simply shows three tabs. That is deliberate: a short bar
 * is honest, and padding it out with whatever came next in the record would put
 * an admin page under a learner's thumb.
 *
 * The rail has no such limit and lists the record in full, which is the whole
 * reason it is still the layout for a screen with room for it.
 */
export const MOBILE_TABS = ["home", "game", "children", "settings"] as const;

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
      label: withCounts(item.label, counts),
      badge: withCounts(item.badge ?? undefined, counts),
    }))
    // Not presentation: an entry with nothing behind it leads to an empty page,
    // so it is dropped however the record words it.
    .filter((item) => item.id !== "game" || counts.lessons > 0)
    .filter(allowed);
};
