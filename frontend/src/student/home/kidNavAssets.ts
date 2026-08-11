import type { CustomSvgAsset } from "../../types";

export const KID_NAV_ASSET_IDS = {
  home: "koda_kid_nav_home",
  skills: "koda_kid_nav_skills",
  quests: "koda_kid_nav_quests",
  rewards: "koda_kid_nav_rewards",
  xp: "koda_kid_stat_xp",
  streak: "koda_kid_stat_streak_star",
  mastery: "koda_kid_stat_mastery",
  notification: "koda_kid_action_notification",
  themeDark: "koda_kid_action_theme_dark",
  themeLight: "koda_kid_action_theme_light",
} as const;

/** Learner navigation artwork stored in the shared SVG Library by stable id. */
export const KID_NAV_ASSETS: CustomSvgAsset[] = [
  {
    id: KID_NAV_ASSET_IDS.home,
    label: "Learner navigation — Home",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidHomeGradient" x1="5" y1="4" x2="27" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#A98BFF"/><stop offset="1" stop-color="#6045E8"/></linearGradient></defs><path d="M4.5 15.2 14.1 6a2.75 2.75 0 0 1 3.8 0l9.6 9.2a2 2 0 0 1-1.38 3.45h-1.2v7.1A2.25 2.25 0 0 1 22.67 28H9.33a2.25 2.25 0 0 1-2.25-2.25v-7.1h-1.2A2 2 0 0 1 4.5 15.2Z" fill="url(#kidHomeGradient)"/><path d="M12.1 27.9v-7.45a2.15 2.15 0 0 1 2.15-2.15h3.5a2.15 2.15 0 0 1 2.15 2.15v7.45" fill="#FFF" fill-opacity=".92"/><circle cx="22.5" cy="10" r="2.35" fill="#FFD65A"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.skills,
    label: "Learner navigation — Skills",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidSkillsLeft" x1="3" y1="5" x2="16" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#66D8F5"/><stop offset="1" stop-color="#4B71E8"/></linearGradient><linearGradient id="kidSkillsRight" x1="16" y1="5" x2="29" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#B28BFF"/><stop offset="1" stop-color="#6746DF"/></linearGradient></defs><path d="M4 6.8c0-1.15.95-2.05 2.1-1.93 4.8.48 8.1 2.1 9.9 4.85V28c-2.45-2.08-5.78-3.25-10.1-3.52A2 2 0 0 1 4 22.5V6.8Z" fill="url(#kidSkillsLeft)"/><path d="M28 6.8c0-1.15-.95-2.05-2.1-1.93-4.8.48-8.1 2.1-9.9 4.85V28c2.45-2.08 5.78-3.25 10.1-3.52A2 2 0 0 0 28 22.5V6.8Z" fill="url(#kidSkillsRight)"/><path d="M7.5 10.25c2.15.38 3.9 1.02 5.25 1.92M7.5 14.2c2.15.38 3.9 1.02 5.25 1.92M24.5 10.25c-2.15.38-3.9 1.02-5.25 1.92" stroke="white" stroke-width="1.7" stroke-linecap="round" opacity=".82"/><circle cx="24.5" cy="20.5" r="3" fill="#FFD45A"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.quests,
    label: "Learner navigation — Quests",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidQuestGradient" x1="4" y1="5" x2="28" y2="27" gradientUnits="userSpaceOnUse"><stop stop-color="#5EDDB1"/><stop offset=".5" stop-color="#50BCEB"/><stop offset="1" stop-color="#6B4AE8"/></linearGradient></defs><path d="M4.75 7.35 12 4.5l8 3 7.25-2.85A1.3 1.3 0 0 1 29 5.86v18.2c0 .54-.33 1.03-.83 1.23L20 28.5l-8-3-7.25 2.85A1.3 1.3 0 0 1 3 27.14V8.56c0-.54.33-1.03.83-1.23l.92.02Z" fill="url(#kidQuestGradient)"/><path d="M12 4.5v21M20 7.5v21" stroke="white" stroke-width="1.5" opacity=".72"/><path d="M8.1 11.2c2.5 1.2 3.1 3.15 4.65 4.35 1.7 1.3 3.55.15 4.9 1.5 1.1 1.1.7 2.65 2.1 3.75" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2.4 2.8"/><circle cx="8" cy="10.8" r="2.3" fill="#FFD45A"/><path d="m22.4 19.4.8 1.62 1.8.26-1.3 1.27.3 1.8-1.6-.85-1.6.85.3-1.8-1.3-1.27 1.8-.26.8-1.62Z" fill="#FF91BA"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.rewards,
    label: "Learner navigation — Rewards",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidRewardsGradient" x1="5" y1="9" x2="27" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#FF91BA"/><stop offset=".5" stop-color="#A56CF2"/><stop offset="1" stop-color="#6646DF"/></linearGradient></defs><path d="M5 14h22v12.1a2.4 2.4 0 0 1-2.4 2.4H7.4A2.4 2.4 0 0 1 5 26.1V14Z" fill="url(#kidRewardsGradient)"/><rect x="3.5" y="10" width="25" height="6.5" rx="2.2" fill="#7252E8"/><path d="M14.25 10H17.8v18.5h-3.55V10Z" fill="#FFD45A"/><path d="M15.9 10c-2.4-5.7-7.95-5.15-7.95-1.9 0 2.25 3.7 2.75 7.95 1.9ZM16.1 10c2.4-5.7 7.95-5.15 7.95-1.9 0 2.25-3.7 2.75-7.95 1.9Z" fill="#FFD45A"/><circle cx="25.8" cy="5.7" r="2.15" fill="#66D8F5"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.xp,
    label: "Learner stat — XP",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidXpOuter" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF177"/><stop offset=".48" stop-color="#FFC928"/><stop offset="1" stop-color="#F29B18"/></linearGradient><linearGradient id="kidXpBolt" x1="17" y1="7" x2="13" y2="25" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF"/><stop offset="1" stop-color="#FFF1B3"/></linearGradient></defs><path d="M16 2.8 27.4 9v14L16 29.2 4.6 23V9L16 2.8Z" fill="url(#kidXpOuter)"/><path d="M16 5.1 25.4 10.2v11.6L16 26.9l-9.4-5.1V10.2L16 5.1Z" stroke="#FFF" stroke-opacity=".55" stroke-width="1.2"/><path d="m17.4 7.4-7 10.1h5l-1 7.1 7.2-10.5h-5.05l.85-6.7Z" fill="url(#kidXpBolt)"/><circle cx="25.8" cy="7" r="2" fill="#FF8AAF"/><circle cx="7" cy="24.7" r="1.55" fill="#75D8F5"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.streak,
    label: "Learner stat — Streak star",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidStreakStar" x1="7" y1="4" x2="25" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF06B"/><stop offset=".45" stop-color="#FFB72E"/><stop offset="1" stop-color="#FF6D5C"/></linearGradient><radialGradient id="kidStreakGlow" cx="0" cy="0" r="1" gradientTransform="translate(16 16) rotate(90) scale(15)" gradientUnits="userSpaceOnUse"><stop stop-color="#FFD95A" stop-opacity=".48"/><stop offset="1" stop-color="#FF8C4A" stop-opacity="0"/></radialGradient></defs><circle cx="16" cy="16" r="15" fill="url(#kidStreakGlow)"/><path d="m16 3.6 3.72 7.54 8.32 1.2-6.02 5.87 1.42 8.28L16 22.58l-7.44 3.91 1.42-8.28-6.02-5.87 8.32-1.2L16 3.6Z" fill="url(#kidStreakStar)"/><path d="m16 7.2 2.63 5.34 5.9.86-4.27 4.16 1.01 5.86L16 20.65l-5.27 2.77 1.01-5.86-4.27-4.16 5.9-.86L16 7.2Z" stroke="#FFF" stroke-opacity=".68" stroke-width="1.05"/><path d="M13.15 16.2 15.1 18l4.15-4.35" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.mastery,
    label: "Learner stat — Mastery",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidMasteryMedal" x1="7" y1="4" x2="25" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#C8A9FF"/><stop offset=".46" stop-color="#8A62EC"/><stop offset="1" stop-color="#5335C9"/></linearGradient><linearGradient id="kidMasteryCrown" x1="10" y1="8" x2="23" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF47A"/><stop offset="1" stop-color="#FFB52E"/></linearGradient></defs><path d="m10.2 20.6-2.1 8 7.9-3 7.9 3-2.1-8H10.2Z" fill="#5DD1EF"/><circle cx="16" cy="14.2" r="11.2" fill="url(#kidMasteryMedal)"/><circle cx="16" cy="14.2" r="8.65" stroke="white" stroke-opacity=".58" stroke-width="1.3"/><path d="M9.8 11.25 13 13.2l3-5.55 3 5.55 3.2-1.95-.95 7.1h-10.5l-.95-7.1Z" fill="url(#kidMasteryCrown)"/><path d="M11.2 20.25h9.6" stroke="#FFF1A7" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="7.65" r="1.3" fill="#FF8FB9"/><circle cx="9.8" cy="11.2" r="1.1" fill="#6FE1BE"/><circle cx="22.2" cy="11.2" r="1.1" fill="#72D8F6"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.notification,
    label: "Learner action — Notifications",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidNotificationBell" x1="7" y1="4" x2="25" y2="27" gradientUnits="userSpaceOnUse"><stop stop-color="#B99BFF"/><stop offset=".52" stop-color="#7C5CEA"/><stop offset="1" stop-color="#5140CE"/></linearGradient><linearGradient id="kidNotificationClapper" x1="13" y1="24" x2="19" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#FFD966"/><stop offset="1" stop-color="#FF9D3D"/></linearGradient></defs><path d="M7.15 22.5c1.8-2.15 2.45-4.25 2.45-7.65 0-3.85 2.02-6.66 5.15-7.35V6.35a1.25 1.25 0 0 1 2.5 0V7.5c3.13.69 5.15 3.5 5.15 7.35 0 3.4.65 5.5 2.45 7.65.9 1.08.13 2.75-1.28 2.75H8.43c-1.41 0-2.18-1.67-1.28-2.75Z" fill="url(#kidNotificationBell)"/><path d="M11.1 14.65c0-2.96 1.58-5.04 4.05-5.62" stroke="#FFF" stroke-opacity=".58" stroke-width="1.45" stroke-linecap="round"/><path d="M12.65 25.25a3.45 3.45 0 0 0 6.7 0h-6.7Z" fill="url(#kidNotificationClapper)"/><circle cx="24.1" cy="7.4" r="3.35" fill="#FF6F9F"/><circle cx="24.1" cy="7.4" r="1.45" fill="#FFF" fill-opacity=".92"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.themeDark,
    label: "Learner action — Dark theme",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidThemeMoon" x1="7" y1="5" x2="25" y2="27" gradientUnits="userSpaceOnUse"><stop stop-color="#BFA9FF"/><stop offset=".48" stop-color="#8068ED"/><stop offset="1" stop-color="#4C3AC5"/></linearGradient><linearGradient id="kidThemeStar" x1="21" y1="5" x2="27" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF57A"/><stop offset="1" stop-color="#FFB62F"/></linearGradient></defs><path d="M24.88 20.6A11.25 11.25 0 0 1 10.9 6.1a11.25 11.25 0 1 0 13.98 14.5Z" fill="url(#kidThemeMoon)"/><path d="M11.15 9.2a8.9 8.9 0 0 0 10.9 11.3" stroke="#FFF" stroke-opacity=".52" stroke-width="1.35" stroke-linecap="round"/><path d="m23.6 4.2 1.05 2.17 2.38.34-1.72 1.68.4 2.37-2.11-1.12-2.12 1.12.4-2.37-1.72-1.68 2.39-.34L23.6 4.2Z" fill="url(#kidThemeStar)"/><circle cx="26.8" cy="15" r="1.45" fill="#69D9F3"/></svg>`,
  },
  {
    id: KID_NAV_ASSET_IDS.themeLight,
    label: "Learner action — Light theme",
    scale: 1,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="kidThemeSun" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF27A"/><stop offset=".5" stop-color="#FFC13D"/><stop offset="1" stop-color="#FF7C59"/></linearGradient><radialGradient id="kidThemeSunGlow" cx="0" cy="0" r="1" gradientTransform="translate(16 16) rotate(90) scale(8.2)" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF9C7"/><stop offset="1" stop-color="#FFD34D"/></radialGradient></defs><g stroke="url(#kidThemeSun)" stroke-width="2.4" stroke-linecap="round"><path d="M16 3.5v3.1M16 25.4v3.1M3.5 16h3.1M25.4 16h3.1M7.15 7.15l2.2 2.2M22.65 22.65l2.2 2.2M24.85 7.15l-2.2 2.2M9.35 22.65l-2.2 2.2"/></g><circle cx="16" cy="16" r="7.1" fill="url(#kidThemeSun)"/><circle cx="14.3" cy="14.1" r="3.75" fill="url(#kidThemeSunGlow)" fill-opacity=".76"/><circle cx="22.8" cy="8.1" r="1.4" fill="#A886FF"/></svg>`,
  },
];
