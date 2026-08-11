import type { CustomSvgAsset } from "../types";

export const PARENT_NAV_ASSET_IDS = {
  dashboard: "koda_parent_nav_dashboard",
  children: "koda_parent_nav_children",
  settings: "koda_parent_nav_settings",
  profile: "koda_parent_menu_profile",
  logout: "koda_parent_menu_logout",
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
  {
    id: PARENT_NAV_ASSET_IDS.profile,
    label: "Parent menu — Profile",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="parentProfileGradient" x1="5" y1="3" x2="20" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#B89BFF"/><stop offset=".5" stop-color="#8068ED"/><stop offset="1" stop-color="#534AB7"/></linearGradient><linearGradient id="parentProfileAccent" x1="15" y1="4" x2="21" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#FF9BC0"/><stop offset="1" stop-color="#FF6F9F"/></linearGradient></defs><circle cx="12" cy="8" r="4.35" fill="url(#parentProfileGradient)"/><path d="M3.55 20.35c.52-5.05 3.42-7.6 8.45-7.6s7.93 2.55 8.45 7.6c.08.8-.55 1.5-1.36 1.5H4.91c-.81 0-1.44-.7-1.36-1.5Z" fill="url(#parentProfileGradient)"/><path d="M7.1 18.8c.6-2.45 2.25-3.7 4.9-3.7" stroke="#FFF" stroke-opacity=".58" stroke-width="1.3" stroke-linecap="round"/><circle cx="18.7" cy="5.3" r="2.45" fill="url(#parentProfileAccent)"/><circle cx="18.7" cy="5.3" r=".9" fill="#FFF" fill-opacity=".9"/></svg>`,
  },
  {
    id: PARENT_NAV_ASSET_IDS.logout,
    label: "Parent menu — Log out",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="parentLogoutGradient" x1="4" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#FF9E7A"/><stop offset=".48" stop-color="#FF678F"/><stop offset="1" stop-color="#E93F72"/></linearGradient></defs><path d="M10.25 3.2H6.1A2.6 2.6 0 0 0 3.5 5.8v12.4a2.6 2.6 0 0 0 2.6 2.6h4.15" stroke="url(#parentLogoutGradient)" stroke-width="2.25" stroke-linecap="round"/><path d="M13.1 7.2 17.9 12l-4.8 4.8M17.45 12H8.2" stroke="url(#parentLogoutGradient)" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19.55" cy="5.1" r="1.55" fill="#FFBE55"/></svg>`,
  },
];
