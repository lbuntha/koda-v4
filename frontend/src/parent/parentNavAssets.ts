import type { CustomSvgAsset } from "../types";

export const PARENT_NAV_ASSET_IDS = {
  dashboard: "koda_parent_nav_dashboard",
  children: "koda_parent_nav_children",
  settings: "koda_parent_nav_settings",
} as const;

export const PARENT_NAV_ASSET_REFS = {
  dashboard: `svg:${PARENT_NAV_ASSET_IDS.dashboard}`,
  children: `svg:${PARENT_NAV_ASSET_IDS.children}`,
  settings: `svg:${PARENT_NAV_ASSET_IDS.settings}`,
} as const;

/** First-party artwork inserted once into the account's shared SVG Library. */
export const PARENT_NAV_ASSETS: CustomSvgAsset[] = [
  {
    id: PARENT_NAV_ASSET_IDS.dashboard,
    label: "Parent navigation — Dashboard",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="dashboardGradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#9B87F5"/><stop offset="1" stop-color="#534AB7"/></linearGradient></defs><rect x="3" y="3" width="8" height="8" rx="2.5" fill="url(#dashboardGradient)"/><rect x="13" y="3" width="8" height="5" rx="2.2" fill="#F7B955"/><rect x="13" y="10" width="8" height="11" rx="2.5" fill="url(#dashboardGradient)" opacity=".82"/><rect x="3" y="13" width="8" height="8" rx="2.5" fill="#63C8F2"/></svg>`,
  },
  {
    id: PARENT_NAV_ASSET_IDS.children,
    label: "Parent navigation — Children",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="childrenGradient" x1="5" y1="4" x2="19" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#FF8DB7"/><stop offset="1" stop-color="#805AD5"/></linearGradient></defs><circle cx="9" cy="8" r="4" fill="url(#childrenGradient)"/><circle cx="17.2" cy="9" r="3" fill="#63C8F2"/><path d="M2.8 19.4c.45-4.1 2.7-6.2 6.2-6.2s5.75 2.1 6.2 6.2c.08.75-.52 1.4-1.28 1.4H4.08c-.76 0-1.36-.65-1.28-1.4Z" fill="url(#childrenGradient)"/><path d="M14.1 14.1c.87-.7 1.92-1.05 3.1-1.05 2.62 0 4.25 1.6 4.62 4.72.08.7-.48 1.31-1.18 1.31h-3.7c-.2-2.03-1.13-3.7-2.84-4.98Z" fill="#63C8F2"/></svg>`,
  },
  {
    id: PARENT_NAV_ASSET_IDS.settings,
    label: "Parent navigation — Settings",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="settingsGradient" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#7ED8F6"/><stop offset=".48" stop-color="#7C6DD8"/><stop offset="1" stop-color="#534AB7"/></linearGradient></defs><path d="M9.9 2.8h4.2l.55 2.02c.55.22 1.08.53 1.55.9l2.03-.55 2.1 3.65-1.48 1.47c.08.57.08 1.15 0 1.72l1.48 1.47-2.1 3.65-2.03-.55c-.47.37-1 .68-1.55.9l-.55 2.02H9.9l-.55-2.02a8.4 8.4 0 0 1-1.55-.9l-2.03.55-2.1-3.65 1.48-1.47a6.2 6.2 0 0 1 0-1.72L3.67 8.82l2.1-3.65 2.03.55c.47-.37 1-.68 1.55-.9L9.9 2.8Z" fill="url(#settingsGradient)"/><circle cx="12" cy="11.15" r="3.15" fill="white" fill-opacity=".92"/><circle cx="12" cy="11.15" r="1.45" fill="#6A5AC7"/></svg>`,
  },
];
