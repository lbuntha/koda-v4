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

- **Header** — avatar + greeting + Exit. (Band A may parent-gate Exit.)
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
- Exit optionally behind a quick parent gate (supervised context).

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
                 // (sizes, tone/copy, sounds on/off, parent-gate, density)
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
4. **Band A (Kid)** — playful treatment + optional parent-gated exit.
5. **Band C (Focus)** — sleek study-tool treatment + more agency.
6. **Relocate analytics** — surface rank + skill map per kid on the parent/teacher
   dashboard (data already comes from `courseApi.progress(studentId)`).
7. *(Optional)* align `PlacementWarmup` styling per band too.

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
3. **Analytics relocation** — do it in this effort (phase 6), or park it and just
   remove analytics from the kid home for now?
4. **"Up next" tap** — start the activity immediately, or swap it into the hero to
   preview first?
5. **Band A Exit** — parent-gate it (supervised) or leave it a normal Exit?
6. **Default band boundaries** — confirm order 1–6 / 7–9 / 10–12 as the defaults
   admins can override.
