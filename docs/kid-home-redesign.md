# Kid home redesign (Band A) — plan

Target: the dashboard mock from 2026-07-26 — full-bleed layout, a welcome band with stats, a
"next up" card, an activities row, skill paths, and game collections.

Constraint from the brief: **logic stays as it is unless a real requirement forces a change.**
So every panel below is traced to a field that already exists, or is called out as a gap. No
panel ships on invented data.

## 1. What the mock needs vs. what exists

| Mock element | Real source | Status |
|---|---|---|
| Greeting, avatar, Exit | `account.name`, `account.avatar` | ✅ |
| Theme toggle | `useThemeMode()` | ✅ |
| `5 day streak` chip | `StudentActivitySignal.currentStreakDays` | ⚠️ exists, but only fetched for the **focus** band (`StudentCurriculumPlayer:45`) — one-line change |
| `240 XP earned` | `progress.rewardProfile.totalXp` | ✅ |
| `12 skills mastered` | `progress.rank.mastered` | ✅ |
| `8 games completed` | `rewardProfile.achievements[metric="lessonsCompleted"].current` | ✅ as *activities done* — there is no separate "game" entity |
| Next-up art, title, description | `course.queue[0]` (`thumbnailUrl`, `skillLabel`, `description`) | ✅ |
| `2 questions` | `queue[0].questions.length` | ✅ |
| `3 min` | `estimateFocusMinutes()` in `focusHomeModel.ts` | ✅ move to a shared model |
| `+26 XP` | `queue[0].xpAvailable` | ✅ |
| `65% complete` progress bar | ❌ no per-activity progress exists | **relabel** to `65% mastered` from `SkillProgress.score` for that skill |
| Activity state badges (Practice next / Completed / New for you) | `queue[].kind` + `queue[].status` + `completedItems` | ✅ |
| `Your last score 6/10` | `SkillProgress.recentScore` | ✅ (verify range is 0–1 before multiplying) |
| `+20 XP earned` on a completed card | `completedItems[].xpEarned` | ✅ |
| Skill path rows (`Counting & Number Sense 72% mastered · 18 of 25 skills`) | aggregate `progress.skills` by `unitId` | ⚠️ **percentages yes, names no** — the student payload sends `unitId`/`subjectId` as **ids only** (`learning/router.py:248`); unit labels never leave the release tree |
| `2 skills to practice` | count of `isDue` skills in that unit | ✅ |
| `Mastered milestone: Count to 20` | most recent `promotedAt` skill in that unit | ✅ |
| Game collections (`Number Quest 5 of 8`) | ❌ nothing — no collection entity, no membership, no artwork | **needs product + backend work** |
| Nav: Learn / Games / Progress | ❌ no student routes exist | see D1 |

## 2. Decisions needed

- **D1 — Nav.** Only *Home* has a destination today. Recommend the nav scrolls to page
  sections (`Learn` → activities, `Progress` → skill paths) exactly as the current Home/Lessons
  buttons do, and `Games` appears only once collections exist. Real routes are a separate piece
  of work (router, deep links, back handling).
- **D2 — Skill path names.** Cheapest honest fix: add `unitLabel` + `subjectLabel` to each row
  of the progress payload (~10 lines in `learning/router.py`, labels already in the tree). The
  alternative is grouping by mastery band and dropping names entirely.
- **D3 — Game collections.** Recommend omitting the section until there is a real entity
  (curriculum-authored group + membership + cover art + completion). Faking it from the daily
  quest would show a kid progress that resets every session.
- **D4 — `65% complete`.** No per-activity progress exists; shipping it as skill mastery is
  honest and needs no backend.

## 3. Layout

Full-bleed like the parent page: `min-h-screen flex flex-col`, `max-w-7xl` content, toolbar on
the page background (no band), sections stacked with a consistent `mt-8`.

| Breakpoint | Welcome band | Activities | Skill paths |
|---|---|---|---|
| `< 640px` | stacked, stats 2×2 | 1 col | 1 col |
| `≥ 640px` | stacked, stats 4-up | 2 col | 2 col |
| `≥ 1024px` | welcome + next-up side by side (`lg:grid-cols-[1.1fr_1fr]`) | 3 col | 3 col |
| `≥ 1280px` | same, wider gutters | 3 col | 3 col |

Compaction rules kept from the current page: one description line (`line-clamp-2`), no empty
sections, no card borders — tinted fills only.

## 4. Shared components

New, in `src/student/home/shared/`:

| Component | Purpose | Reused by |
|---|---|---|
| `AppToolbar` | logo + greeting + nav slot + right slot | kid home, parent home |
| `StreakChip` | flame + `N day streak` | toolbar (kid), focus band later |
| `StatTile` | icon + value + label | welcome band |
| `SectionHeader` | icon + title + subtitle + optional action | every section |
| `ProgressBar` | one accent-tinted meter | next-up, skill paths |
| `ActivityCard` | art + state badge + title + meta + CTA | activities row |
| `NextUpCard` | large "continue" card | welcome band |
| `SkillPathCard` | unit mastery + due count + milestone | skill paths |

Existing pieces that stay: `ActivityStatusBadge`, `FreePlaySwitch`, `LevelUpDialog`,
`StudentFooter`, `questDotProgress`, `KidAvatar` (parent), `resolveTechniqueThumbnail`.

## 5. Phases

1. **Shared components + full-bleed shell.** Toolbar shared with the parent page, welcome band,
   stats, next-up, activities, skill paths. No new backend.
2. **Streak for the kid band** — fetch `activitySignal` when `band === "kid"`.
3. **D2 unit labels** — backend adds `unitLabel`/`subjectLabel`; skill paths get real names.
4. **Game collections** — only after the entity exists (schema, studio authoring, cover art).

Until phase 3 lands, skill paths group by unit id and show the *skill count* + mastery %, with
the unit name omitted rather than faked.
