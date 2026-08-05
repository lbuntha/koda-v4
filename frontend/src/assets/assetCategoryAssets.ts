import type { CustomSvgAsset } from "../types";

export const ASSET_CATEGORY_ICON_IDS = {
  All: "koda_asset_category_all",
  Shapes: "koda_asset_category_shapes",
  Bottles: "koda_asset_category_bottles",
  Snacks: "koda_asset_category_snacks",
  Toys: "koda_asset_category_toys",
  Objects: "koda_asset_category_objects",
  Badges: "koda_asset_category_badges",
  Custom: "koda_asset_category_custom",
} as const;

/** Small, high-contrast category marks used by the shared Asset Library tabs. */
export const ASSET_CATEGORY_ICONS: CustomSvgAsset[] = [
  {
    id: ASSET_CATEGORY_ICON_IDS.All,
    label: "Asset category — All",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryAll" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#A98BFF"/><stop offset="1" stop-color="#534AB7"/></linearGradient></defs><rect x="3" y="3" width="8" height="8" rx="2.4" fill="url(#categoryAll)"/><rect x="13" y="3" width="8" height="8" rx="2.4" fill="#68D1F2"/><rect x="3" y="13" width="8" height="8" rx="2.4" fill="#FF9ABA"/><rect x="13" y="13" width="8" height="8" rx="2.4" fill="#FFD45A"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Shapes,
    label: "Asset category — Shapes",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryShapes" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#8EDCF5"/><stop offset="1" stop-color="#6250D9"/></linearGradient></defs><circle cx="8" cy="8" r="4.5" fill="#FF93B7"/><path d="M14 3.5h7v7h-7z" fill="url(#categoryShapes)"/><path d="m12.5 20 4.25-7.4L21 20h-8.5Z" fill="#FFD15C"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Bottles,
    label: "Asset category — Bottles",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryBottle" x1="7" y1="3" x2="18" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#71DCF5"/><stop offset=".55" stop-color="#58B6EB"/><stop offset="1" stop-color="#6550DB"/></linearGradient></defs><rect x="9" y="2.5" width="6" height="4" rx="1.3" fill="#6653D9"/><path d="M8.2 7.5A3.2 3.2 0 0 1 10.5 6h3a3.2 3.2 0 0 1 2.3 1.5l2.3 3.6c.27.42.4.91.4 1.4V20a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-7.5c0-.49.14-.98.4-1.4l2.3-3.6Z" fill="url(#categoryBottle)"/><path d="M7.5 15c2.9-1.2 6.1 1.6 9 0v5h-9v-5Z" fill="#70E0BE"/><path d="M8.5 10.5h7" stroke="white" stroke-opacity=".72" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Snacks,
    label: "Asset category — Snacks",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categorySnack" x1="5" y1="3" x2="19" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#FFB07B"/><stop offset="1" stop-color="#FF6E8E"/></linearGradient></defs><path d="m6 3 12 1.2-1 17.3-10-.9L6 3Z" fill="url(#categorySnack)"/><path d="M7.3 6.2 17.6 7M7.1 17.5l10 .8" stroke="#FFF1C8" stroke-width="1.2" opacity=".75"/><circle cx="12.2" cy="12.2" r="3.4" fill="#FFD45A"/><circle cx="11" cy="11" r=".65" fill="#B76A2D"/><circle cx="13.6" cy="13.1" r=".65" fill="#B76A2D"/><circle cx="13.5" cy="10.5" r=".5" fill="#B76A2D"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Toys,
    label: "Asset category — Toys",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryToy" x1="4" y1="5" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#B08BFF"/><stop offset="1" stop-color="#5B48D6"/></linearGradient></defs><rect x="4" y="8" width="16" height="12" rx="3" fill="url(#categoryToy)"/><path d="M8 8V5.5h3V8M13 8V4h3v4" stroke="#FFD45A" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="14" r="2" fill="#68D3F2"/><path d="M16 12v4M14 14h4" stroke="#FF9ABA" stroke-width="1.7" stroke-linecap="round"/><rect x="7" y="19" width="3" height="2.5" rx="1" fill="#4A39B4"/><rect x="14" y="19" width="3" height="2.5" rx="1" fill="#4A39B4"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Objects,
    label: "Asset category — Objects",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryObject" x1="4" y1="5" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#7CDDBD"/><stop offset="1" stop-color="#35A9C9"/></linearGradient></defs><path d="m4 8 8-4 8 4v9l-8 4-8-4V8Z" fill="url(#categoryObject)"/><path d="m4.5 8.2 7.5 4 7.5-4M12 12.2V21" stroke="white" stroke-opacity=".7" stroke-width="1.3"/><path d="m8 6 8 4" stroke="#FFF6BF" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Badges,
    label: "Asset category — Badges",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryBadge" x1="5" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#FFD969"/><stop offset=".45" stop-color="#FF9C5C"/><stop offset="1" stop-color="#8A5BE1"/></linearGradient></defs><path d="m8 15-2 7 6-2.8L18 22l-2-7H8Z" fill="#67CFEF"/><circle cx="12" cy="10" r="8" fill="url(#categoryBadge)"/><path d="m12 5.3 1.45 2.95 3.25.47-2.35 2.3.55 3.24L12 12.72l-2.9 1.54.55-3.24-2.35-2.3 3.25-.47L12 5.3Z" fill="white" fill-opacity=".9"/></svg>`,
  },
  {
    id: ASSET_CATEGORY_ICON_IDS.Custom,
    label: "Asset category — Custom",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="categoryCustom" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#B08BFF"/><stop offset=".55" stop-color="#7757E5"/><stop offset="1" stop-color="#5140BC"/></linearGradient></defs><path d="M12 3.2a8.8 8.8 0 1 0 0 17.6h1.2a1.7 1.7 0 0 0 1.12-2.98l-.35-.3a1.35 1.35 0 0 1 .88-2.37h2.45A3.7 3.7 0 0 0 21 11.45C21 6.85 17 3.2 12 3.2Z" fill="url(#categoryCustom)"/><circle cx="8" cy="9" r="1.45" fill="#68D5F3"/><circle cx="12" cy="6.9" r="1.45" fill="#FFD45A"/><circle cx="16" cy="9" r="1.45" fill="#FF95B8"/><circle cx="8.8" cy="14" r="1.45" fill="#75E0BB"/><path d="m18.3 15.2 2.5 2.5-5.5 5.5-3 .5.5-3 5.5-5.5Z" fill="#FFD45A"/><path d="m17.2 16.3 2.5 2.5" stroke="white" stroke-width="1"/></svg>`,
  },
];
