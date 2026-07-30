# Curriculum model — how content reaches a learner, and how it scales

**Concretely: what records exist, what to create for grades 1–12 across several subjects, and
what is missing today to run that.**

---

## 1. The five records

| Record | One per | Holds | Mutable? |
|---|---|---|---|
| `Grade` | grade | `grade-3`, "Grade 3", order | yes |
| `Subject` | **grade × subject** | `grade-3-math`, name, `grade_id` | yes |
| `Curriculum` | authored course | tree of grades → subjects → units → skills, rewards | yes (draft) |
| `CurriculumRelease` | publish | frozen copy of tree + question manifest + assets | **no** |
| `Assignment` | learner × release × scope | `grade_id`, `priority`, `schedule`, `scope` | yes |

Two things follow from this table and drive every decision below:

- **A subject belongs to one grade.** `grade-1-math` and `grade-2-math` are separate records.
  Twelve grades × five subjects = **60 subject records**, not five.
- **Releases are immutable and per curriculum.** Publishing to fix one typo creates a new
  release of *that whole curriculum*. This is the blast radius that decides how to slice things.

Today's catalog holds **1 grade** (`grade-1`) and **2 subjects** (`grade-1-math`,
`grade-1-science`).

---

## 2. Assignment is what links a kid to content — not grade

A learner is connected by an `Assignment` row. Grade is a *field on it*, used to scope what
they see; it is not the mechanism.

**A learner can have many.** The unique index is `(student_id, release_id, scope)`, so one row
per release+scope — nothing limits a student to one. The recommendation engine is built for
several: it sorts by `priority`, then round-robins **lanes keyed by
`(assignment_id, subject_id)`**, so a learner with three subjects gets an interleaved queue
rather than all of one until it runs out.

---

## 3. Recommended shape: one curriculum per grade × subject

```
Grade 3 Mathematics     ← one Curriculum, one release line
Grade 3 Reading
Grade 3 Science
```

**Not** one "Grade 3" curriculum containing all subjects, and **not** one "Mathematics"
curriculum spanning grades 1–12. Three reasons, all from how the system actually behaves:

1. **Publish blast radius.** Releases are per curriculum. A combined Grade 3 tree means fixing
   a reading typo cuts a new release for maths and science too, and every assigned learner
   moves to it. A subject-spanning tree is worse: a Grade 1 fix republishes for Grade 12.
2. **Scheduling is per assignment.** `priority` and `schedule` live on the Assignment. "Maths
   daily, science twice a week" is expressible with separate assignments and impossible inside
   one.
3. **Rewards are per curriculum.** Separate curricula can carry different economics — a reading
   activity worth more than a drill — while a combined tree forces one set.

The cost is more curricula. That is what the studio's grade/subject/status filters exist for.

### Scale

| | Count |
|---|---|
| Grades | 12 |
| Subjects per grade | ~5 |
| `Subject` records | **60** |
| `Curriculum` records | **60** |
| Releases | 60 × however often you publish |
| Assignments **per learner** | **~5** (one per subject in their grade) |

Sixty curricula is a list to filter, not a problem. Five assignments per learner is what the
lane round-robin was written for.

---

## 4. Worked example — one learner, three subjects

```
Student: Jutta, grade_level "grade_1"

Assignment A  curriculum "grade-1-mathematics"  release r-math-7     priority 100
Assignment B  curriculum "grade-1-reading"      release r-read-3     priority 100
Assignment C  curriculum "grade-1-science"      release r-sci-1      priority 200
```

What the learner's queue does with that:

- A and B share priority 100, so they alternate: maths, reading, maths, reading…
- C is priority 200, so science appears only after the higher-priority lanes are exhausted —
  the practical way to say "science is secondary this term".
- `activitiesPerSession` (default 3) caps the daily quest, so she sees three of them, not all.

### Narrowing within a curriculum

`scope` restricts one assignment without needing a separate curriculum:

```json
{"kind": "all",      "ids": []}                    // everything (default)
{"kind": "units",    "ids": ["u-place-value"]}     // remedial: one unit
{"kind": "skills",   "ids": ["s-count-20"]}        // a single skill
{"kind": "grades",   "ids": ["grade-2"]}           // a grade band inside a multi-grade tree
```

Use `scope` for **a learner needing something different**, not for organising content. Content
organisation belongs in the tree.

---

## 5. Operations you will need

| Operation | Today | Needed |
|---|---|---|
| Add a grade | `POST /settings/grades` | ✅ |
| Add a subject | `POST /settings/subjects` | ✅ |
| Create a curriculum | Studio | ✅ |
| Publish a release | Studio | ✅ |
| Assign one learner | `POST /assignments` | ✅ |
| **Set up a whole grade** (5 subjects × N learners) | one call at a time | ❌ bulk |
| **Roll a learner to next grade** | archive + recreate by hand | ❌ operation |
| **Move learners to a new release** | reassign each | ❌ bulk |
| **Warn that a draft differs from its release** | nothing | ❌ check |

The first three gaps are the ones that bite at scale. Assigning a class of 25 to five subjects
is 125 calls today.

---

## 6. Classrooms — for the school case

`Classroom` and `ClassEnrollment` exist and are wired into permissions: a teacher may read a
learner only via an **active enrolment** (`authorize_guardian_read`). Neither is in use yet
(0 records).

For families, assignments per learner are enough. For schools, the missing piece is
**assignment by classroom** — assign a curriculum to a class and have it fan out to enrolled
learners — which is also the answer to the bulk gaps above.

---

## 7. Getting there from today

1. Add grades 2–12 to the catalog (11 records).
2. Add subjects per grade — 5 per grade, `grade_id` set correctly. This is the step worth
   scripting; 60 records by hand invites typos, and a subject with the wrong `grade_id`
   silently produces a curriculum whose units cannot be scoped.
3. One curriculum per grade × subject, created as needed rather than all 60 up front.
4. Questions, then **publish** — rewards and questions reach learners only through a release.
5. Assign, setting `grade_id` to match the learner's grade. Getting this wrong widens their
   progress view, which is the defect fixed earlier this week.
