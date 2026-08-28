/**
 * Plain-data navigation config.
 *
 * JSON cannot carry a component, so an entry names its icon by string and
 * `SidebarIcon` resolves it through the registry. Kept in its own module —
 * rather than beside the component that draws it — because three things read
 * these shapes now: the bundled default (`src/data/sidebarNav.json`), the
 * server's `menu_items` collection, and the Menu screen an operator edits.
 */

/** One destination. `icon` is a key into the icon registry, or `art:<id>`. */
export interface NavItemConfig {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  /** Permission the account must hold. Absent means everybody. */
  requires?: string;
  roles?: string[];
  order?: number;
}

export interface NavSectionConfig {
  id?: string;
  label?: string;
  items: NavItemConfig[];
}

export interface NavBrandConfig {
  title: string;
  subtitle?: string;
  /** Key into the icon registry. Ignored when `logoUrl` is set. */
  icon?: string;
  /** Image logo (e.g. the app favicon). Rendered bare, without an icon well. */
  logoUrl?: string;
}

export interface NavProfileConfig {
  name: string;
  role?: string;
  /** Image URL. When absent the avatar falls back to `initials`, then the name. */
  avatarUrl?: string;
  initials?: string;
}

/** Shape of a nav JSON file. Fully serializable — no components, no functions. */
export interface NavConfig {
  brand: NavBrandConfig;
  sections: NavSectionConfig[];
  profile?: NavProfileConfig;
}
