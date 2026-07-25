# Koda — Student Page Redesign

**Goal:** compact and simplify the student-facing experience, and split it into
**three grade-banded layouts** so the UI matches how much autonomy each learner
actually has. One student page cannot serve a grade-1 child and a grade-12
student with the same treatment.

> Status: **plan of record** for the student page. Locked decisions are marked
> ✅. Open items needing a call are in [§8](#8-open-questions).

---

## 1. Why three bands

The app spans **grade 1 → grade 12** (ages ~6–18). That is why we deliberately
say *"kid"* for the youngest and *"student"* for the older learners — they are
genuinely different users:

| Band | Grades | Who they are | Design character |
|------|--------|--------------|------------------|
| **A — Kid** | 1–6 | Under a parent; supervised; short attention span | Big, bright, playful, minimal text, large tap targets, sound + celebration |
| **B — Student** | 7–9 | More independent; self-motivated | Balanced, cleaner, light personal signal (streak/goal), less mascot |
| **C — Focus** | 10–12 | Professional, fully independent | Sleek study-tool feel, restrained color, more agency + data, concise tone |

The **information architecture is shared** (see §3); the **band changes the
treatment** — density, size, tone, decoration, and how much control the learner
gets.

---

## 2. Principles (all bands) ✅

1. **One clear action per screen.** Open → one obvious **Play** → game → reward →
   back. Nothing competes with "start."
2. **Minimal reading.** Short labels; no reason paragraphs, no percentages on the
   home. Density rises slightly from Band A → C, never to clutter.
3. **Analytics is for adults.** Rank + full skill map leave the student home
   entirely and move to the parent/teacher view.
4. **Plan by default.** The recommended plan is the default; *Free play* is a
   secondary action, not a persistent toggle.
5. **Age-appropriate, never babyish for teens.** Playfulness in Band A comes from
   icons/mascot/celebration; Bands B/C read as a real study tool.

---

## 3. Shared home skeleton ✅

Every band composes the same regions, styled differently:

- **Header** — avatar + greeting + Exit.
- **Primary focus** — the next recommended activity (`course.queue[0]`) → **Play**.
- **Up next** — the rest of the queue (`course.queue.slice(1)`), tappable.
- **Free play** — one secondary button; switching shows a "← Back to my plan" link.
- **Empty state** — "You're all caught up 🎉" + Free play.
- **Level-up** — celebration dialog on promotion (kept, scaled per band).

**Removed from the student home (all bands):**
- ❌ Rank card (tier / proficient / mastered)
- ❌ Skill-map grid
- ❌ `My plan / Free practice` segmented toggle
- ❌ Per-card reason paragraphs, level badges, score percentages

---

## 4. Per-band layouts

### Band A — Kid (grades 1–6)

Full-screen, one giant activity, huge Play button, big subject icon, almost no
text. Up-next is 2–3 friendly bubbles. Sounds/animations on. Rewards prominent.

```
┌─────────────────────────────────────────────┐
│  🦉  Hi Jutta                        Exit    │
│                                             │
│            ⭐                                │
│        Add within 10                        │
│        Let's practise!                      │
│                                             │
│        [   ▶   PLAY   ]                      │
│              Not now                        │
│                                             │
│   Up next   (○ Count)  (○ Take away)         │
└─────────────────────────────────────────────┘
```

- Tone: warm, encouraging ("Let's practise!", "Great job!").
- Big rounded controls; generous spacing; high-contrast, cheerful color.
- Exit returns directly to the parent dashboard for parent-launched play.
- **Progress = a trophy/star shelf, not a dashboard** ✅. Cumulative stars and
  badges shown as collectible icons (no numbers, no charts, no percentages).
  Gives a sense of history + "score/XP" in a reward idiom a child reads. Real
  analytics (rank, skill map, proficiency %) stays parent/teacher-only per §2.3.
- **Retest = free replay** ✅. *Any* completed activity is always replayable —
  from Up-next or by tapping its trophy on the shelf. Framed as fun ("Play
  again"), never pass/fail; replaying earns more stars. No gated "retest" and no
  parent step required for a kid to redo a level.

### Band B — Student (grades 7–9)

Cleaner and a bit denser. Hero activity + a real up-next list, plus one light
personal signal (streak or "today's goal"). Less decoration.

```
┌─────────────────────────────────────────────┐
│  🎧 Hi Thana        🔥 3-day streak    Exit  │
├─────────────────────────────────────────────┤
│  NEXT UP · Stretch · 2 cards                 │
│  Add within 10                              │
│  [   ▶  Play   ]              Skip           │
├─────────────────────────────────────────────┤
│  Up next                                    │
│  ● Count to 20                     Start     │
│  ● Take away within 10             Start     │
├─────────────────────────────────────────────┤
│  Free play                                  │
└─────────────────────────────────────────────┘
```

- Tone: motivating, not childish. Subject icons small.
- Shows enough to feel in control without becoming a dashboard.

### Band C — Focus (grades 10–12)

Study-tool aesthetic: typographic, restrained color, efficient. The full plan is
a focused list with session goal + time estimate. Maximum agency.

```
┌─────────────────────────────────────────────┐
│  Hi Jordan · Grade 11            Free · Exit │
├─────────────────────────────────────────────┤
│  Today's plan            3 skills · ~12 min  │
│                                             │
│  →  Add within 10        Stretch · 2 cards   │
│     Count to 20          Review  · 3 cards   │
│     Take away w/in 10    New     · 2 cards   │
│                                             │
│  [ Start ]   choose any item above           │
└─────────────────────────────────────────────┘
```

- Tone: concise, no exclamation. Restrained palette; dark-mode friendly.
- Learner can pick any queue item; free practice one click away.
- Room for "due for review" and light goals (they can handle more data).

### 4a. Responsive behavior (phone / tablet / desktop)

Mockup: side-by-side at all three sizes — `scratchpad/band-mockups.html`
(artifact: https://claude.ai/code/artifact/60db16fd-d0f8-448f-9b13-51716a85f657).

**Breakpoint rule.** Single column at ≤ ~840px (phone + tablet portrait);
two-column above (tablet landscape + desktop). Tablet portrait is the phone
layout with more breathing room and larger type — not a separate design.

| Band | Phone / tablet-portrait | Desktop / wide |
|------|-------------------------|----------------|
| **Kid** | Centered single column: quest bar, buddy, big Play, catch-up. | **Centered stage** — a floating panel enlarges buddy + Play; deliberately *not* stretched across a wide monitor (kids shouldn't track a full-width screen). |
| **Student** | Stacked: stats → hero card → Revisit → Free play. | **Hero + rail** — hero card on the left, a right rail holding stats, Up next, and Revisit. |
| **Focus** | Stacked: stat strip → plan list → Start. | **Study dashboard** — plan list (main) beside a sidebar of stats + a weekly-activity chart. |

Kid opts out of two-column by design; Student and Focus use the extra width for
a side rail / dashboard rather than a wider single column.

### 4b. Performance + missed-skill signals

A change from §3, which had moved *all* progress to the adult dashboard: the
student home carries a **light** performance signal and a **catch-up on
missed/skipped skills**, tuned per band (never the old heavy rank card + full
skill map). Full analytics still lives on the parent/teacher view.

| Band | Performance | Missed / skipped ("catch-up") |
|------|-------------|-------------------------------|
| **Kid** | Quest bar + today's stars, plus a cumulative **trophy/star shelf** (collectible icons — the kid-facing "history/score/XP"). ✅ | Gentle **"Try again"** card for missed skills; **any** activity is freely replayable ("Play again") from Up-next or the shelf. ✅ |
| **Student** | Two small stat tiles: daily ring (N today) + streak. | **"Revisit"** card: e.g. *"Count to 20 — skipped last time."* |
| **Focus** | Stat strip: streak · proficiency % · due/missed count. | **"Overdue"** flag inline in the plan + a due/missed stat tile. |

> ✅ Decision implemented: keep the light, band-appropriate signals
> student-facing. The detailed event feed, rank breakdown, and full skill
> analytics remain adult-only.

---

## 5. Band resolution — configured in admin ✅

The band is **authored data, not hard-coded boundaries.** The three layouts
(`kid` / `student` / `focus`) are React components in code; *which band a grade
maps to* is set by the admin.

Grades are already an admin-managed collection (`Grade` model: `key`, `code`,
`name`, `order`, `age_range`, `active`, `revision`), edited via admin settings.
So the band lives with the grade:

- **Add `layout_band: "kid" | "student" | "focus"`** to the `Grade` model +
  `GradeIn` schema. Default derivable from `order` so existing grades keep
  working (e.g. order 1–6 → kid, 7–9 → student, 10+ → focus).
- Admin sets it per grade in the grade editor (Grade 1 → kid, Grade 8 →
  student, Grade 11 → focus). Re-banding a grade later is a **no-deploy data
  change** — no fragile "grade number → band" parsing in the client.
- *(Optional)* a system-wide default band rule by `order` in `SystemSettings`,
  overridden per grade.

**Surfacing it to the student UI** (grade is *not* available there today —
`/auth/me` returns only `{id, role, name, avatar}`, and `TodayCourse`/
`CourseQueueItem` carry no grade):

- Backend resolves the student's active grade → its `layout_band` → returns
  `gradeBand` on the **`/auth/me`** response (and/or the today-course response).
- **Multi-grade rule** (a student may have assignments across grades): pick one
  canonical grade — recommended: store a `grade`/`grade_id` on the **Student**
  record (set at creation), else derive from the primary active assignment's
  `grade_id`.
- **Fallback:** if nothing resolves, default to **`student`** (neutral middle).

---

## 6. Component architecture

Keep data loading in one place; split presentation by band.

```
StudentCurriculumPlayer         // loads course/progress/session, resolves band
  └─ StudentTodayHome           // thin router: picks the band variant
       ├─ KidHome     (Band A)
       ├─ StudentHome (Band B)
       └─ FocusHome   (Band C)

shared/
  Header, HeroActivity, UpNextRow, FreePlayButton, LevelUpDialog
  gradeBand.ts   // grade → band + per-band design tokens
                 // (sizes, tone/copy, sounds on/off, density)
```

- `gradeBand.ts` centralizes the mapping and the tunable tokens so bands stay
  consistent and are easy to adjust in one place.
- The three band components compose the **same shared subcomponents** with
  different props/styling — no duplicated logic, just different skins/layout.

---

## 7. Implementation phases

1. **Band signal (§5).** ✅ **Done.** Backend: `Grade.layout_band` (+ `GradeIn`
   schema + admin grade editor + `effective_band` in serializer), `/auth/me`
   resolves the kid's active-assignment grade → band and returns `gradeBand`
   (fallback `student`). Frontend: `GradeBand` type, threaded through
   `Account` → `StudentCurriculumPlayer` → `StudentTodayHome` (`data-band`).
   Tests: `test_grade_band.py`. Layout components per band are phases 3–5.
2. **Shared skeleton refactor.** ✅ **Done.** Extracted `student/home/`:
   `HomeHeader`, `HeroActivity`, `UpNextRow`, `FreePlaySwitch`, `LevelUpDialog`,
   `kinds.ts`. `StudentTodayHome` now composes them as a compact single-focus
   home (hero + up-next, plan-by-default, level-up kept); rank card, skill-map
   grid, and the segmented mode toggle removed. Band-neutral for now — the three
   band treatments compose these same pieces in phases 3–5.
3. **Band B (Student)** first — the neutral middle; validates the shared parts.
   ✅ **Done.** `StudentTodayHome` is now a band **router** (`LAYOUTS` by band
   over shared `StudentHomeProps`); `home/StudentHome.tsx` is Band B — the
   compact baseline plus a light "N to practise today" signal. Kid/Focus route
   to it as a fallback until phases 4–5.
4. **Band A (Kid).** ✅ **Done.** `home/KidHome.tsx` provides the centered
   playful stage, dominant Play action, three-item Up next, gentle Try again,
   direct parent-dashboard Exit, empty state, and responsive phone/desktop
   treatment.
   Progress is real rather than decorative: today markers come from mastery
   activity, and the trophy shelf joins completed skill progress to the playable
   free-practice catalog so every displayed trophy replays its actual activity.
   Tests: `home/kidHomeModel.test.ts`.
5. **Band C (Focus).** ✅ **Done.** `home/FocusHome.tsx` provides a restrained,
   dark-mode-friendly plan with selectable rows, session estimate, inline
   overdue flags, and maximum learner agency. At widths above 840px it becomes a
   plan + progress-rail study dashboard; smaller screens use the stacked stat
   strip and plan. Proficiency and due state come from real mastery data.
   `/progress/{student_id}/activity-signal` safely exposes only the learner's
   own streak and seven-day activity series (not the adult event feed).
   Tests: `home/focusHomeModel.test.ts`, `test_analytics_phase4.py`.
6. **Relocate analytics.** ✅ **Done.** Student homes contain only their light
   band-appropriate signals. Parent kid cards open `ChildAnalyticsDrawer`, while
   teachers/admins use the authorized Learning progress roster. The adult drawer
   contains rank, proficiency map, the complete filterable skill list, activity,
   and recommendation history. Teacher reads are limited to active classroom
   enrollments; raw export and permanent deletion remain guardian/admin-only.
7. **Band-aware placement.** ✅ **Done.** `PlacementWarmup` receives the resolved
   `GradeBand` before the home loads. Kid opens in a bright, large-control,
   low-text treatment with playful completion; Student uses the balanced light
   baseline; Focus defaults to the compact dark study-tool treatment. Placement
   mechanics and server grading remain shared. Tests: `placementBand.test.ts`.

   Grade 1 functional verification is available through `make seed-grade1`
   for Docker or `make seed-grade1-local` for the local dev stack. Each
   idempotently creates/resets an isolated parent, Grade 1 Kid-band learner,
   four playable counting/addition questions, active assignment, and fresh
   placement flow in the matching database.

**Files touched:** `student/StudentTodayHome.tsx` (rewrite → router),
`student/StudentCurriculumPlayer.tsx` (thread band), new band + shared components,
new `student/gradeBand.ts`; backend `auth/router.py` (`/me`) + Student model;
parent side (`parent/ParentDashboard.tsx`, `KidCard.tsx`) for the moved analytics.

---

## 8. Open questions

1. **Band config granularity** — per-grade `layout_band` field (recommended), a
   system-wide default rule by `order`, or both (default + per-grade override)?
2. **Canonical grade source** — store `grade`/`grade_id` on the Student record
   (recommended), or derive from the active assignment's `grade_id`?
3. **Analytics relocation** — ✅ completed in phase 6.
4. **"Up next" tap** — start the activity immediately, or swap it into the hero to
   preview first?
5. **Band A Exit** — ✅ normal Exit; parent-launched play returns directly to
   the parent dashboard.
6. **Default band boundaries** — confirm order 1–6 / 7–9 / 10–12 as the defaults
   admins can override.
