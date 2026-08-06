import type { CustomSvgAsset } from "../types";

export const FAMILY_SUMMARY_ASSET_IDS = {
  lessons: "koda_parent_family_summary_lessons_gradient_v3",
  practiceTime: "koda_parent_family_summary_practice_time_gradient_v3",
  skills: "koda_parent_family_summary_skills_gradient_v3",
} as const;

/** First-party artwork used by the parent dashboard's family summary cards. */
export const FAMILY_SUMMARY_ASSETS: CustomSvgAsset[] = [
  {
    id: FAMILY_SUMMARY_ASSET_IDS.lessons,
    label: "Family summary — Lessons",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="lessonLeft" x1="3" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#9C8BFF"/><stop offset="1" stop-color="#5641D8"/></linearGradient><linearGradient id="lessonRight" x1="12" y1="5" x2="21" y2="19" gradientUnits="userSpaceOnUse"><stop stop-color="#C7A7FF"/><stop offset="1" stop-color="#7450E9"/></linearGradient></defs><g><path d="M3.25 5.65A1.65 1.65 0 0 1 5.1 4.02l2.98.36A4.45 4.45 0 0 1 12 8.8v10.7a5.5 5.5 0 0 0-4.15-2.3H5.1a1.85 1.85 0 0 1-1.85-1.85v-9.7Z" fill="url(#lessonLeft)"/><path d="M20.75 5.65a1.65 1.65 0 0 0-1.85-1.63l-2.98.36A4.45 4.45 0 0 0 12 8.8v10.7a5.5 5.5 0 0 1 4.15-2.3h2.75a1.85 1.85 0 0 0 1.85-1.85v-9.7Z" fill="url(#lessonRight)"/><path d="M12 8.8v10.7" stroke="#F0E9FF" stroke-width="1.1" stroke-linecap="round" opacity=".85"/><path d="M5.7 7.1 8.2 7.4M5.7 9.7l3.35.4M18.3 7.1l-2.5.3M18.3 9.7l-3.35.4" stroke="white" stroke-width="1" stroke-linecap="round" opacity=".72"/><path d="M4.25 5.65A.65 .65 0 0 1 4.98 5l2.98.36" stroke="white" stroke-width=".8" stroke-linecap="round" opacity=".6"/></g></svg>`,
  },
  {
    id: FAMILY_SUMMARY_ASSET_IDS.practiceTime,
    label: "Family summary — Practice time",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="clockRim" x1="4" y1="3" x2="20" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#62C8FF"/><stop offset=".5" stop-color="#2580FF"/><stop offset="1" stop-color="#3150D9"/></linearGradient><linearGradient id="clockFace" x1="8" y1="7" x2="17" y2="18" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCEBFF"/></linearGradient></defs><g><circle cx="12" cy="12" r="9.2" fill="url(#clockRim)"/><circle cx="12" cy="12" r="6.75" fill="url(#clockFace)"/><circle cx="12" cy="12" r="1.05" fill="#3155D8"/><path d="M12 7.65v4.4l3.5 1.75" stroke="#3155D8" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.55 8.3A6.8 6.8 0 0 1 11 5.35" stroke="white" stroke-width="1.25" stroke-linecap="round" opacity=".72"/><circle cx="17.9" cy="6.1" r="1.05" fill="#87E4FF" opacity=".9"/></g></svg>`,
  },
  {
    id: FAMILY_SUMMARY_ASSET_IDS.skills,
    label: "Family summary — Skills",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="trophyCup" x1="7" y1="3" x2="17" y2="15" gradientUnits="userSpaceOnUse"><stop stop-color="#D292FF"/><stop offset=".48" stop-color="#8B4CF5"/><stop offset="1" stop-color="#5523C8"/></linearGradient><linearGradient id="trophyBase" x1="8" y1="16" x2="17" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#A86CFF"/><stop offset="1" stop-color="#5B2AD1"/></linearGradient><linearGradient id="trophyShine" x1="9" y1="4" x2="13" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF" stop-opacity=".9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><g><path d="M7.25 5.1H3.8v2.1a4.65 4.65 0 0 0 4.65 4.65V9.9A2.7 2.7 0 0 1 5.75 7.2v-.15h1.5V5.1ZM16.75 5.1h3.45v2.1a4.65 4.65 0 0 1-4.65 4.65V9.9a2.7 2.7 0 0 0 2.7-2.7v-.15h-1.5V5.1Z" fill="#7040D8"/><path d="M7 3.2h10v5.1a5 5 0 0 1-10 0V3.2Z" fill="url(#trophyCup)"/><path d="M8.45 4.25h2.5c-.8 2.2-.75 5.35 1.15 7.45-2.45.05-3.65-1.65-3.65-3.6V4.25Z" fill="url(#trophyShine)" opacity=".65"/><path d="M11 12.9h2v4.25h-2z" fill="#7440DB"/><rect x="8.35" y="16.3" width="7.3" height="2.25" rx="1.1" fill="url(#trophyBase)"/><rect x="6.75" y="18.35" width="10.5" height="2.55" rx="1.25" fill="url(#trophyBase)"/><path d="M8.35 19.15h7.3" stroke="white" stroke-width=".7" stroke-linecap="round" opacity=".42"/><circle cx="15.8" cy="4.55" r=".75" fill="#F6C8FF" opacity=".9"/></g></svg>`,
  },
];
