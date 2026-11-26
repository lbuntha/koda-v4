# Measure It — build plan

**Skill id:** `measurement` · **Ages:** 5–12 · **Category:** `measurement` ·
**102 techniques → 102 teaching lessons + 11 practice lessons on 17 activity engines.**
**Curricula:** USA (Common Core K–6), UK (England National Curriculum Y1–Y6),
Cambodia (MoEYS primary Grades 1–6).

This is the step-by-step plan for building the measurement skill, written in the
shape of `ADDITION_BUILD_PLAN.md` and `SKILL_BUILD_TEMPLATE.md`. It runs in order,
one phase at a time, with green `tsc` / `npm test` / `npm run build` after every
phase. Read `docs/SKILL_DEVELOPMENT.md` §0 before Phase 1.

> **Mock:** https://claude.ai/artifact/VtFZfXQDZse593wueVk42T. It shows the look
> and motion for 37 of these lessons. It uses drag in four places. The real skill
> does not: see §5.0.

---

## Status — plan only, not approved

Nothing is built. Settle §13 before Phase 0. Two items in §13 can't be decided
from the code:

- **Cambodia grade mapping is unverified.** The KH column in §2 is my best reading
  of the MoEYS primary maths sequence, not a checked source. It needs the Grade 1–6
  maths textbooks. Every KH cell marked `?` is a guess.
- **Phase 0 needs three changes outside the skill folder** (region filter, curricula
  field, learner region in the SDK). Addition needed none. These need the owner's
  go-ahead.

---

## 0. Pre-flight

### 0.1 What is different about this skill

Every other math skill teaches one idea the same way in every country. Measurement
does not:

| Difference | USA | UK (England) | Cambodia |
|---|---|---|---|
| Units taught | metric **and** customary (in, ft, yd, mi, oz, lb, cup, pt, qt, gal, °F) | metric; imperial only as approximations (Y5) and miles↔km (Y6) | metric only; land area in are/hectare (KH ?) |
| Spelling (English UI) | meter, liter | metre, litre | metre, litre (follows UK) |
| Clock | 12-hour, a.m./p.m.; "quarter after" or 3:15 | 12- and 24-hour, Roman numerals I–XII, "quarter past/to" | 24-hour common in daily life (KH ?) |
| Dates | mm/dd | dd/mm | dd/mm |
| Temperature | °F in daily life, °C in science | °C | °C |
| Grade label | Grade K–6 | Year 1–6 (one year older: US Grade 1 ≈ UK Year 2) | Grade 1–6 |

So the skill needs three things no skill has had:

1. **Lessons that only some regions see.** 19 of the 102 lessons are region-only (§2,
   column R). Everything else is universal.
2. **Region-aware copy inside universal lessons:** spelling, clock words, date order.
   This is a token in the lesson copy (`{metre}`, `{quarterPast}`) that the engine
   resolves, not a separate lesson.
3. **Curriculum references for UK and Cambodia.** Neither has official codes like
   CCSS. PLUGINS.md §7 rule 1 forbids inventing codes, so they need a new field (§2.3).

### 0.2 Edits outside the skill folder (Phase 0, needs approval)

| # | File | Change | Why |
|---|---|---|---|
| 1 | `src/skills/types.ts` (`Lesson`) | optional `regions?: ("US"\|"GB"\|"KH")[]` and `curricula?: { GB?: string; KH?: string }` | region-only lessons; UK year and KH grade per lesson |
| 2 | course/lesson listing (where the Learn tab builds the course) | hide a lesson whose `regions` excludes the learner's region; region-only lessons never gate a universal one | a US child never meets Roman-numeral clocks |
| 3 | `KodaSDK` | `koda.learner.region(): "US" \| "GB" \| "KH" \| "INTL"` from `session.country` (GB→GB, US→US, KH→KH, anything else→INTL) plus a Skill Manager override | engines pick spelling, clock style and units |

Plus the usual three: register in `registry.ts`, append units to `course.json`,
voice manifests. If any edit to 1–3 is refused, the fallback is §13 decision 2.

### 0.3 Rules carried over from addition (all apply)

Tap-to-place, never drag (§5.0). An engine never asks which level it is; mode is a
lesson parameter. One `submit` per question. `expected` on every question. No
yellow or amber. No cross-skill imports. No emoji; art ids only. `iconTone` from
the six allowed tones. Readers aged 8+ get `speaksPrompts: false` on their lessons.

---

## 1. Architecture — 17 engines

Each engine owns one interaction. Every lesson answered the same way rides the same
engine with different `params`.

| # | Engine | activity id | The interaction | Lessons |
|---|---|---|---|---|
| A | `CompareBench` | `compare` | tap the longer/heavier/fuller; order three; tap-to-align on a start line; compare via a string | 1–6 |
| B | `UnitTrack` | `units` | tap a block then a spot on the track (gaps possible); spot the bad row; which unit needs more | 9–11 |
| C | `RulerDesk` | `ruler` | read a ruler (cm, mm, in, ½ and ¼ in); tap the 0 to place; tap a mark to draw a line; broken ruler; difference; length number line | 14–18, 21–24 |
| D | `EstimateCards` | `estimate` | choose the sensible unit or the sensible amount ("about 2 m or 20 m?") | 19, 20, 25 |
| E | `BalanceBeam` | `balance` | balance tilts on a spring; tap to add/remove cubes until level | 7, 12 |
| F | `DialScale` | `scale` | needle springs to a value; read g, kg, lb/oz with labelled or unlabelled intervals | 26–29 |
| G | `PourLab` | `capacity` | pour into cups to compare; read a jug; hold-to-pour to a line; US cup/pt/qt/gal | 8, 13, 30–32 |
| H | `Thermometer` | `thermo` | read °C/°F, below zero, rise and fall | 33–36 |
| I | `ClockFace` | `clock` | read and set an analogue clock (tap a minute number, ± hour); digital match; a.m./p.m.; Roman; 24-hour; stopwatch | 40–49, 52, 55 |
| J | `TimeLine` | `timeline` | elapsed time as jumps on an open time line; start/end unknown; timetables | 53, 54 |
| K | `CalendarPage` | `calendar` | order days/months/events; read a month page; units of time; days in a month | 38, 39, 50, 51 |
| L | `GridLab` | `grid` | perimeter (ant walk), area by tapping squares, rows × columns, composite split, missing side, same-area, irregular estimate, triangle and parallelogram on a grid, circle parts | 56–67, 101, 102 |
| M | `CubeBox` | `cubes` | isometric cubes drop in; count, layers, formula, composite | 69–72 |
| N | `AngleKit` | `angle` | turns; compare to a right angle; classify; order; estimate; protractor read; draw by tapping the degree mark; unknown angles | 74–83 |
| O | `ConvertBar` | `convert` | bar splits into small units; both directions; mixed units, decimals, approximations, ratio tables, land area, cm³↔mL | 68, 73, 84–93 |
| P | `MeasureStory` | `story` | word problem → bar model → answer, for every quantity | 37, 94–98 |
| Q | `LinePlot` | `lineplot` | measure objects, tap to stack an X on a line plot, answer questions | 99, 100 |

**Lesson count check:** A 6 + B 3 + C 9 + D 3 + E 2 + F 4 + G 5 + H 4 + I 12 + J 2 +
K 4 + L 14 + M 4 + N 10 + O 12 + P 6 + Q 2 = **102.**

### 1.1 Shared measurement core (`internal/`)

- `measureNumbers.ts`: the random-number contract (§4). Every engine draws from it.
- `units.ts`: one table of units: symbol, system, base factor, spellings per region,
  Khmer name. Conversion, rulers, scales and copy all read this table. No engine
  hard-codes "100 cm".
- `regionCopy.ts`: resolves `{metre}`, `{litre}`, `{quarterPast}`, `{dateOrder}` per
  region, and Khmer phrasing (§7).
- `motion.ts`: one spring and one tween used by needle, beam, water, hands and ray,
  so they all feel the same. Respects reduced motion (the mock's `spring()`).

---

## 2. Master lesson table

`L` is `params.level`. Levels are contiguous; build in this order. Columns:
**CCSS** = code for `standards` (full form `CCSS.2.MD.A.1` in JSON; `—` = empty,
so `trajectoryLevel` is set). **UK** = England year. **KH** = Cambodia grade
(`?` = unverified). **R** = regions (blank = all).

### Stage 1 · Comparing (ages 5–6)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `what-can-we-measure` | compare · `attribute` | `measurable-attribute` | object pair + question "which is longer / heavier / holds more" | taps the attribute card | K.MD.A.1 | Y1 | 1 ? | |
| 2 | `longer-shorter` | compare · `pick` | `length-comparer` | 2 objects, same start, gap ≥ 20% | taps one | K.MD.A.2 | Y1 | 1 | |
| 3 | `taller-shorter` | compare · `pick_vertical` | `length-comparer` | 2 standing objects on one floor line | taps one | K.MD.A.2 | Y1 | 1 | |
| 4 | `line-them-up` | compare · `align` | `length-comparer` | shorter one starts late and looks longer | taps object, taps start line, then picks | 1.MD.A.1 | Y1 | 1 | |
| 5 | `order-three` | compare · `order` | `length-orderer` | 3 lengths, gaps ≥ 15% | tap-to-place into 3 slots | 1.MD.A.1 | Y1 | 1 | |
| 6 | `compare-with-string` | compare · `indirect` | `indirect-comparer` | A vs string, string vs B; A and B never side by side | taps the longer | 1.MD.A.1 | Y1 | 1 ? | |
| 7 | `heavier-lighter` | balance · `compare` | `mass-comparer` | item pairs incl. big-but-light (balloon vs rock) | taps one | K.MD.A.2 | Y1 | 1 | |
| 8 | `holds-more` | capacity · `pour` | `capacity-comparer` | 2–6 cups each; tall jar often holds less | pours, taps one | K.MD.A.2 | Y1 | 1 | |

### Stage 2 · Units without a ruler (ages 5–7)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 9 | `measure-with-blocks` | units · `lay` | `unit-iterator` | 2–9 blocks; gap/overlap marked, not scored | taps blocks onto track, then pad | 1.MD.A.2 | Y1 | 1 | |
| 10 | `spot-the-mistake` | units · `spot` | `unit-iterator` | one of two rows has a gap or overlap | taps row, then pad | 1.MD.A.2 | Y1 | 1 ? | |
| 11 | `big-unit-small-unit` | units · `unit_size` | `unit-size-reasoner` | rod = 2× or 3× cube | taps unit | 2.MD.A.2 | Y2 | 2 ? | |
| 12 | `balance-with-cubes` | balance · `cubes` | `mass-unit-iterator` | 2–9 cubes | ± cube until level, then "It balances" | — | Y1 | 1 ? | |
| 13 | `fill-with-cups` | capacity · `cups` | `capacity-unit-iterator` | 2–8 cups | pours, pad | — | Y1 | 1 ? | |

### Stage 3 · Rulers and length (ages 6–9)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 14 | `read-the-ruler` | ruler · `read` | `ruler-reader` | 2–14 cm from 0 | pad | 2.MD.A.1 | Y2 | 2 | |
| 15 | `measure-it` | ruler · `place` | `ruler-reader` | must start at 0; ruler edge ≠ 0 | taps object, taps 0, then pad | 2.MD.A.1 | Y2 | 2 | |
| 16 | `draw-a-line` | ruler · `draw` | `ruler-drawer` | 2–14 cm | taps the end mark | 2.MD.A.1 | Y2 | 2 | |
| 17 | `broken-ruler` | ruler · `offset` | `broken-ruler-reader` | start 1–6; distractor = end number | pad | 2.MD.A.1 | Y2 | 2 ? | |
| 18 | `how-much-longer` | ruler · `difference` | `length-difference` | both ≤ 14 cm, diff ≥ 1 | pad | 2.MD.A.4 | Y2 | 2 | |
| 19 | `cm-or-m` | estimate · `choose_unit` | `unit-chooser` | objects from pencil to road; cm / m / km | taps unit | 2.MD.A.3 | Y2 | 2 | |
| 20 | `estimate-length` | estimate · `benchmark` | `length-estimator` | two answers 10× apart | taps one | 2.MD.A.3 | Y2 | 2 ? | |
| 21 | `lengths-on-a-number-line` | ruler · `numberline` | `length-number-line` | sums/differences ≤ 100 cm | taps landing point | 2.MD.B.6 | Y3 | 3 ? | |
| 22 | `inches-and-feet` | ruler · `read_inch` | `customary-length-reader` | 1–11 in; 1 ft = 12 in | pad | 2.MD.A.1 | — | — | US |
| 23 | `half-and-quarter-inches` | ruler · `read_inch_fraction` | `fraction-measurer` *(reused)* | ½, ¼ in | choices | 3.MD.B.4 | — | — | US |
| 24 | `millimetres` | ruler · `read_mm` | `mm-reader` | 5–150 mm; cm + mm | pad | 4.MD.A.1 | Y3 | 3 | |

### Stage 4 · Scales: mass, capacity, temperature (ages 6–10)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 25 | `kg-or-g` | estimate · `choose_unit` | `unit-chooser` | mass and capacity objects; g/kg, mL/L | taps unit | 3.MD.A.2 | Y2 | 2 ? | |
| 26 | `read-the-scale` | scale · `read` | `scale-reader` | 0–1000 g, every mark labelled | pad | 3.MD.A.2 | Y2 | 2 | |
| 27 | `scale-steps` | scale · `interval` | `scale-interval-reader` | unlabelled marks: steps 2, 5, 10, 20, 25, 50, 100, 250 | pad | 3.MD.A.2 | Y3 | 3 | |
| 28 | `kilogram-scales` | scale · `read_kg` | `scale-reader` | 0–100 kg bathroom / 0–20 kg luggage, halves | pad | 3.MD.A.2 | Y3 | 3 | |
| 29 | `pounds-and-ounces` | scale · `read_lb` | `customary-mass-reader` | lb + oz | pad | 4.MD.A.1 | — | — | US |
| 30 | `read-the-jug` | capacity · `jug` | `jug-reader` | 0–1000 mL, steps 100 → 50 → 25 | pad | 3.MD.A.2 | Y2 | 2 | |
| 31 | `fill-to-the-line` | capacity · `fill` | `jug-reader` | target 100–900 mL, ±½ step | hold-to-pour, Done | 3.MD.A.2 | Y2 | 2 | |
| 32 | `cups-pints-quarts-gallons` | capacity · `customary` | `customary-capacity-reader` | US containers | taps / pad | 4.MD.A.1 | — | — | US |
| 33 | `read-the-thermometer` | thermo · `read` | `thermometer-reader` | 0–40 °C, steps 1 → 2 → 5 | pad | — | Y2 | 3 ? | |
| 34 | `below-zero` | thermo · `negative` | `negative-temperature` | −20–30 °C | pad with − key | 6.NS.C.5 | Y5 | 5 ? | |
| 35 | `warmer-colder` | thermo · `change` | `temperature-change` | rise/fall ≤ 25 °C, crossing 0 | pad | 6.NS.C.5 | Y6 | 6 ? | |
| 36 | `fahrenheit` | thermo · `read_f` | `fahrenheit-reader` | 0–110 °F | pad | — | — | — | US |
| 37 | `add-and-subtract-measures` | story · `same_unit` | `measure-calculator` | same unit; ≤ 1000 | pad | 3.MD.A.2 | Y3 | 3 | |

### Stage 5 · Time (ages 5–10)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 38 | `days-and-months` | calendar · `sequence` | `calendar-sequencer` | next/before day or month | tap-to-place | — | Y1 | 1 | |
| 39 | `first-next-last` | calendar · `events` | `event-sequencer` | 3–4 picture events; morning/afternoon/evening | tap-to-place | — | Y1 | 1 | |
| 40 | `oclock` | clock · `read_hour` | `clock-reader-hour` | 1–12 o'clock | choices | 1.MD.B.3 | Y1 | 1 | |
| 41 | `half-past` | clock · `read_half` | `clock-reader-half` | half hours; distractor = next hour | choices | 1.MD.B.3 | Y1 | 1 ? | |
| 42 | `quarter-past-quarter-to` | clock · `read_quarter` | `clock-reader-quarter` | quarters (US copy: "quarter after", 3:15) | choices | 2.MD.C.7 | Y2 | 2 ? | |
| 43 | `five-minutes` | clock · `read_five` | `clock-reader-five` | 5-minute times | pad h:mm | 2.MD.C.7 | Y2 | 2 | |
| 44 | `set-the-clock` | clock · `set` | `clock-setter` | 5-minute targets | taps a minute number, ± hour, Check | 2.MD.C.7 | Y2 | 2 | |
| 45 | `am-or-pm` | clock · `am_pm` | `am-pm-reader` | activity + clock → a.m./p.m. | choices | 2.MD.C.7 | Y3 | — | US GB |
| 46 | `to-the-minute` | clock · `read_minute` | `clock-reader-minute` | any minute | pad h:mm | 3.MD.A.1 | Y3 | 3 | |
| 47 | `analogue-and-digital` | clock · `match_digital` | `digital-matcher` | 4 cards, 1 match; distractor swaps hands | taps card | 3.MD.A.1 | Y3 | 3 | |
| 48 | `roman-numeral-clocks` | clock · `roman` | `roman-clock-reader` | I–XII faces | pad | — | Y3 | — | GB |
| 49 | `24-hour-clock` | clock · `twentyfour` | `24-hour-converter` | 12h ↔ 24h, afternoon/evening | pad | — | Y4 | 4 ? | GB KH |
| 50 | `units-of-time` | calendar · `units` | `time-unit-knower` | s/min/h/day/week/month/year facts | pad | 4.MD.A.1 | Y3 | 3 | |
| 51 | `read-a-calendar` | calendar · `page` | `calendar-reader` | month page; days until; days in month; leap year | taps date / pad | — | Y3 | 3 ? | |
| 52 | `how-long` | clock · `elapsed` | `elapsed-time` | 10–55 min, may cross the hour | pad | 3.MD.A.1 | Y3 | 3 | |
| 53 | `time-line-jumps` | timeline · `open` | `elapsed-time` | up to 3 h; start or end unknown | taps jumps, pad | 3.MD.A.1 | Y4 | 4 | |
| 54 | `timetables` | timeline · `timetable` | `timetable-reader` | bus/train table, 12h or 24h by region | taps cell / pad | — | Y5 | 5 ? | |
| 55 | `seconds-and-stopwatches` | clock · `stopwatch` | `duration-comparer` | compare durations in s/min | taps / pad | — | Y3 | 3 ? | |

### Stage 6 · Perimeter and area (ages 7–12)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 56 | `walk-the-edge` | grid · `perimeter_count` | `perimeter-finder` | rectangles 2–6 × 2–4 | pad | 3.MD.D.8 | Y3 | 3 | |
| 57 | `add-the-sides` | grid · `perimeter_sides` | `perimeter-calculator` | labelled polygons, 3–6 sides | pad | 3.MD.D.8 | Y3 | 3 | |
| 58 | `missing-side` | grid · `missing_side` | `missing-dimension` *(reused)* | perimeter known, one side hidden | pad | 3.MD.D.8 | Y5 | 4 ? | |
| 59 | `rectilinear-perimeter` | grid · `rectilinear_perimeter` | `perimeter-calculator` | L and U shapes, some sides unlabelled | pad | 3.MD.D.8 | Y4 | 4 ? | |
| 60 | `count-the-squares` | grid · `area_count` | `area-finder` *(reused)* | 2–6 × 2–4; tap to count | pad | 3.MD.C.6 | Y4 | 3 | |
| 61 | `rows-times-columns` | grid · `area_multiply` | `area-modeler` *(reused)* | 3–9 × 2–9 | pad | 3.MD.C.7a | Y5 | 4 | |
| 62 | `area-formula` | grid · `area_formula` | `area-formula-user` | cm², m²; no grid shown | pad | 4.MD.A.3 | Y5 | 4 | |
| 63 | `split-the-shape` | grid · `composite` | `composite-area` | L/T shapes; taps a split line first | taps split, pad | 3.MD.C.7d | Y5 | 5 ? | |
| 64 | `same-area-different-perimeter` | grid · `same_area` | `area-perimeter-relater` | two shapes, judge claims | choices | 3.MD.D.8 | Y6 | 5 ? | |
| 65 | `estimate-area` | grid · `irregular` | `area-estimator` | leaf/puddle on grid; whole + half squares | pad (±2 accepted) | — | Y5 | 5 ? | |
| 66 | `triangle-area` | grid · `triangle` | `triangle-area` | base, height on grid; ½ × b × h | pad | 6.G.A.1 | Y6 | 5 ? | |
| 67 | `parallelogram-area` | grid · `parallelogram` | `parallelogram-area` | cut-and-move animation in hint 3 | pad | 6.G.A.1 | Y6 | 5 ? | |
| 68 | `ares-and-hectares` | convert · `land` | `land-area-converter` | m² ↔ a ↔ ha | pad | — | — | 5 ? | KH |

### Stage 7 · Volume (ages 9–12)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 69 | `count-the-cubes` | cubes · `count` | `volume-finder` | 2–4 × 2–3 × 1–3, all visible | pad | 5.MD.C.3 | Y5 | 5 | |
| 70 | `layer-by-layer` | cubes · `layers` | `volume-layerer` | hidden cubes; layer × layers | pad | 5.MD.C.5a | Y5 | 5 | |
| 71 | `volume-formula` | cubes · `formula` | `volume-formula-user` | l × w × h, cm³, m³ | pad | 5.MD.C.5b | Y6 | 6 ? | |
| 72 | `two-boxes` | cubes · `composite` | `composite-volume` | two cuboids joined | pad | 5.MD.C.5c | Y6 | 6 ? | |
| 73 | `volume-and-capacity` | convert · `volume_capacity` | `volume-capacity-linker` | 1 cm³ = 1 mL, 1000 cm³ = 1 L | pad | — | Y6 | 6 ? | |

### Stage 8 · Angles (ages 7–12)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 74 | `quarter-half-whole-turns` | angle · `turns` | `turn-namer` | ¼, ½, ¾, 1 turn; clockwise/anti | choices | 4.MD.C.5a | Y3 | 3 ? | |
| 75 | `right-angle-check` | angle · `compare_right` | `right-angle-comparer` | bigger/smaller/equal to a right angle | choices | 4.MD.C.5 | Y3 | 3 ? | |
| 76 | `kinds-of-angle` | angle · `classify` | `angle-classifier` | acute, right, obtuse, straight, reflex | choices | 4.G.A.2 | Y5 | 4 ? | |
| 77 | `order-the-angles` | angle · `order` | `angle-orderer` | 3 angles, gaps ≥ 15° | tap-to-place | — | Y4 | 4 ? | |
| 78 | `estimate-angles` | angle · `estimate` | `angle-estimator` | pick closest of 3 | choices | — | Y5 | 5 ? | |
| 79 | `use-a-protractor` | angle · `measure` | `protractor-reader` | 10° → 5° → 1°; distractor = other scale | pad | 4.MD.C.6 | Y5 | 5 | |
| 80 | `draw-an-angle` | angle · `draw` | `angle-drawer` | 10°–170° | taps degree mark | 4.MD.C.6 | Y5 | 5 | |
| 81 | `angles-on-a-line-and-point` | angle · `unknown_line` | `unknown-angle-finder` | 180° and 360° | pad | 4.MD.C.7 | Y5 | 5 ? | |
| 82 | `angles-in-a-triangle` | angle · `triangle` | `triangle-angle-sum` | two given, find third | pad | — | Y6 | 6 ? | GB KH |
| 83 | `vertically-opposite` | angle · `vertical` | `vertical-angle-finder` | crossing lines | pad | — | Y6 | — | GB |

### Stage 9 · Converting (ages 8–12)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 84 | `how-many-in-one` | convert · `relate` | `unit-relater` | 1 m = ? cm, 1 kg = ? g … | pad | 4.MD.A.1 | Y4 | 3 | |
| 85 | `big-to-small` | convert · `down` | `unit-converter` | 1–9 big units | pad | 4.MD.A.1 | Y4 | 4 | |
| 86 | `small-to-big` | convert · `up` | `unit-converter` | whole results only | pad | 5.MD.A.1 | Y5 | 4 | |
| 87 | `mixed-units` | convert · `mixed` | `mixed-unit-converter` | 2 m 35 cm ↔ 235 cm; 1 h 20 min ↔ 80 min | pad (two boxes, one submit) | 4.MD.A.2 | Y4 | 4 | |
| 88 | `decimal-measures` | convert · `decimal` | `decimal-unit-converter` | 1.5 kg = 1500 g; up to 3 dp | pad with . | 5.MD.A.1 | Y6 | 5 | |
| 89 | `time-conversions` | convert · `time` | `time-converter` | h↔min↔s, weeks↔days, years↔months | pad | 4.MD.A.1 | Y4 | 4 | |
| 90 | `customary-conversions` | convert · `customary` | `customary-converter` | ft/in/yd, lb/oz, gal/qt/pt/c | pad | 5.MD.A.1 | — | — | US |
| 91 | `metric-and-imperial` | convert · `approx` | `imperial-approximator` | 1 in ≈ 2.5 cm, 1 kg ≈ 2.2 lb, 1 pint ≈ 570 mL | choices | — | Y5 | — | GB |
| 92 | `miles-and-kilometres` | convert · `miles_km` | `miles-km-converter` | 5 mi ≈ 8 km | pad | — | Y6 | — | GB |
| 93 | `conversion-tables` | convert · `ratio_table` | `rate-reasoner` *(reused)* | fill a ratio table of units | pad | 6.RP.A.3d | — | — | US |

### Stage 10 · Problems and data (ages 7–12)

| L | Lesson id | Engine · mode | conceptKey | Numbers / constraints | Child answers | CCSS | UK | KH | R |
|---|---|---|---|---|---|---|---|---|---|
| 94 | `length-stories` | story · `length` | `measure-problem-solver` | ≤ 100 cm/m, one step | bar, pad | 2.MD.B.5 | Y3 | 3 | |
| 95 | `mass-and-capacity-stories` | story · `mass_capacity` | `measure-problem-solver` | g/kg, mL/L, one or two steps | bar, pad | 3.MD.A.2 | Y3 | 3 | |
| 96 | `time-stories` | story · `time` | `elapsed-time` | start/end/duration unknown | time line, pad | 3.MD.A.1 | Y4 | 4 | |
| 97 | `multi-step-measures` | story · `multi` | `measure-multi-step-solver` | mixed units, decimals, scaling a recipe | step 1, step 2 | 4.MD.A.2 | Y6 | 5 | |
| 98 | `fences-and-floors` | story · `area` | `area-perimeter-problem-solver` | fence (perimeter) vs carpet (area), cost | pad | 4.MD.A.3 | Y6 | 5 | |
| 99 | `measure-and-plot` | lineplot · `whole` | `measurement-plotter` | 6–10 objects, whole units | tap X stacks, answer | 2.MD.D.9 | — | — | US |
| 100 | `fraction-line-plots` | lineplot · `fraction` | `fraction-line-reader` *(reused)* | ½, ¼, ⅛ units | tap X stacks, answer | 4.MD.B.4 | — | — | US |
| 101 | `radius-and-diameter` | grid · `circle_parts` | `circle-part-namer` | d = 2r | taps / pad | — | Y6 | 6 ? | GB KH |
| 102 | `circle-circumference` | grid · `circumference` | `circumference-finder` | C = π × d, π ≈ 3.14 | pad with . | — | — | 6 ? | KH |

### Practice (levels 103–113)

`params.question.practice: true`, 10 questions, no hints, separate course units.
Each samples the modes of its stage that the learner's region can see.

| L | Lesson id | Covers | Requires |
|---|---|---|---|
| 103 | `practice-comparing` | L1–8 | `indirect-comparer` |
| 104 | `practice-units` | L9–13 | `unit-size-reasoner` |
| 105 | `practice-rulers` | L14–24 | `length-number-line` |
| 106 | `practice-scales` | L25–37 | `measure-calculator` |
| 107 | `practice-clocks` | L40–49 | `clock-reader-minute` |
| 108 | `practice-time` | L38–39, 50–55 | `timetable-reader` |
| 109 | `practice-area` | L56–68 | `area-formula-user` |
| 110 | `practice-volume` | L69–73 | `volume-formula-user` |
| 111 | `practice-angles` | L74–83 | `unknown-angle-finder` |
| 112 | `practice-converting` | L84–93 | `unit-converter` |
| 113 | `practice-problems` | L94–102 | `measure-multi-step-solver` |

### 2.1 conceptKeys — reuse before inventing

Mastery aggregates on `conceptKey` across skills. Reused exactly:

| Reused key | Owned by | Used at |
|---|---|---|
| `comparer`, `counter` | counting | manifest `requires`; L1–13 |
| `difference-finder` | subtraction | `requires` of L18 |
| `area-finder`, `area-modeler`, `missing-dimension` | multiplication | L60, L61, L58 |
| `fraction-measurer`, `fraction-line-reader` | fractions | L23, L100 |
| `tenth-reader`, `hundredth-reader` | fractions | `requires` of L88 |
| `rate-reasoner` | multiplication | L93 |
| `place-value-scaler` | multiplication/division | `requires` of L85–86 |

Before adding any other key: `grep -r '"conceptKey"' src/skills/*/lessons.json`.
Every other key in §2 was checked against that grep on 2026-11-25 and is new. `capacity-reader` was renamed `jug-reader` because Bottle Sort already uses it for a different idea (how many layers fit in a puzzle bottle).

### 2.2 The `requires` chain

`manifest.requires`: `counter`, `comparer`, `difference-finder`, `area-finder`,
`tenth-reader`, `place-value-scaler`, `fraction-measurer`. Each lesson requires
at most two keys taught at a lower level. **Region-only lessons are never required
by a universal lesson** (L23 is required by nothing; L49 is required only by L54
in GB/KH, and L54 falls back to 12-hour tables in US). A contract test enforces it.

### 2.3 Standards and curricula fields

- `standards`: CCSS only, full form (`"CCSS.3.MD.C.7a"`), first = primary. Empty
  for UK/KH-only ideas, with `trajectoryLevel` set (PLUGINS.md §7 rule 6).
- `curricula`: `{ "GB": "Y3", "KH": "G3" }`. Year/grade only. **No invented codes.**
  KH values ship only after §13 decision 1 is verified. Until then they are left out,
  not guessed.

---

## 3. Folder layout

```
src/skills/measurement/
  manifest.json  lessons.json  voice.json  index.ts
  activities/        CompareBench.tsx … LinePlot.tsx   (17)
  internal/          measureNumbers.ts units.ts regionCopy.ts motion.ts
                     balanceRig.tsx clockFace.tsx jugRig.tsx rulerStrip.tsx isoCubes.tsx
  internal/data/     things.ts (objects + mass/size/capacity) stories.ts timetables.ts
  assets/            flat SVGs: ruler, scale, jug, clock, thermometer, protractor, things
  locales/           en.json km.json  (+ region variants resolved by regionCopy)
  audio/manifest.json
  measurement.test.ts  measurement.*.test.ts(x)
```

---

## 4. `measureNumbers.ts` — the random-number contract

1. **Every drawn value is exactly representable on the instrument.** A jug in steps
   of 50 never asks for 375 mL. The generator takes the instrument's step.
2. **Units are integers internally** (mm, g, mL, s, minutes since midnight, tenths
   of a degree). Decimals exist only in display. No `0.1 + 0.2` bugs.
3. **Distractors are real mistakes:** the end number on a broken ruler, the other
   protractor scale, area for perimeter, one layer for volume, the next hour at
   half past, ×10 instead of ×100. Each engine lists its distractors in a test.
4. **No repeats within a round** (`seen` set), and a fallback when a narrow range
   is exhausted.
5. **Screen-fit:** lengths are capped by what fits at 360px (15 cm; 20 cm wide).

---

## 5. Engine specifications

### 5.0 Tap-to-place, never drag — settled for the codebase

The mock drags in four places. The build replaces each:

| Mock | Build |
|---|---|
| drag object to start line (L4) | tap object, tap start line; it springs there |
| drag blocks onto track (L9) | tap the block pile, tap a spot on the track; the block lands where tapped, so gaps and overlaps still happen; snaps if within 6 px of the previous end |
| drag object onto ruler (L15) | tap object, tap a ruler mark (0 or the wrong edge) |
| drag clock hand (L44) | tap a minute number (the hand springs there); "+1 hour" / "−1 hour" buttons |

Hold-to-pour (L31) stays: it is a press, not a drag, and has a "Pour 50 mL" tap
alternative for accessibility. Every engine has Undo.

### 5.1 House rules

- **Offline first.** No engine fetches anything: questions are generated on the device, art is bundled (the art library only overrides it), and the code chunk is in the service-worker precache. `measurement.offline.test.tsx` plays every lesson with `fetch` and XHR blocked; a new lesson is covered automatically.

The same as addition §5.1: `SkillRound` chrome, three-rung hints from live state,
`expected` on every question, one submit, `koda.speech.say` gated on
`audio_speech`, palette violet/sky/rose/emerald/ink, art ids not emoji. Motion
comes only from `internal/motion.ts` and turns off under reduced motion.

### 5.2 Engines, one line each beyond §1

- **A CompareBench**: art objects drawn at exact pixel lengths so the answer is always
  visually true; `indirect` hides one pair behind a wall.
- **B UnitTrack**: `lay` scores the count, not the layout, in teaching; gaps are a hint.
- **C RulerDesk**: one ruler component, `unit: cm|mm|in`, `sub: 2|4|8|10`; 0 is inset
  from the edge on purpose.
- **D EstimateCards**: answers ×10 apart; object art from `things.ts` with real sizes.
- **E BalanceBeam**: tilt = clamp(Δmass × k, ±14°) on a spring; size never predicts mass.
- **F DialScale**: `max`, `step`, `labelEvery`, `unit`; needle overshoots then settles.
- **G PourLab**: water level, wave and stream from one rig; `customary` swaps the jug for US containers.
- **H Thermometer**: `min`, `max`, `step`, `scale: C|F`; − key only when `min < 0`.
- **I ClockFace**: `numerals: arabic|roman`, `format: 12|24`, hands on one spring in
  minutes so the hour hand always agrees with the minute hand.
- **J TimeLine**: open line, jumps of h / 30 / 15 / 5 / 1 min; timetables in 12h or 24h by region.
- **K CalendarPage**: month grid generated from a real year (leap years true); week
  starts Monday (GB, KH) or Sunday (US).
- **L GridLab**: one grid; modes in §2 Stage 6, plus circles. Composite shapes come
  from a template list, never random polygons.
- **M CubeBox**: isometric SVG, painter order by x+y+z; layer build in hint 2.
- **N AngleKit**: ray on a spring; protractor with inner and outer scales; `draw` mode
  taps a degree mark.
- **O ConvertBar**: bars split into small-unit ticks; `mixed` has two boxes and one submit.
- **P MeasureStory**: templates in `stories.ts` with region-aware names, money left out,
  units from `units.ts`; the bar model is the hint, not the answer.
- **Q LinePlot**: measure objects on the shared ruler, tap to stack Xs, then answer.

### 5.3 How to play — one demo per interaction (Box Split pattern)

Uses the shared kit player `kit/chrome/HowToPlay.tsx` exactly as Box Split does
(6789485): a pointing hand plays a fixed script on the engine's own pieces, with
captions in English and Khmer. It opens by itself the first time a learner meets that
interaction (never in practice or a race), then stays one press away
(`HowToPlayButton`). No kit change is needed: `useHowToPlay(id)` takes any id, so
measurement passes `measurement/<demo-id>`, one "seen" flag per interaction rather than
one for the whole skill.

Each engine has `activities/<Engine>Demo.tsx` exporting `demoSteps()` and a `DemoScene`
drawn with the engine's own rig (ruler strip, balance, jug, clock). The demo scripts use
**fixed** values so the captions can name them ("It ends at 7. It is 7 cm long."). The
hand only taps, holds, or presses, never drags.

| Demo id | Engine | What the hand shows (4–6 steps) | First lesson |
|---|---|---|---|
| `compare` | A | tap the longer; tap an object, tap the start line, then pick | L2 |
| `order` | A | tap shortest, middle, longest into the slots | L5 |
| `units` | B | tap the pile, tap the track; a gap turns rose; Undo; count | L9 |
| `ruler-read` | C | find 0, slide eye to the end, green spaces count up, type 7 | L14 |
| `ruler-place` | C | tap the pencil, tap the 0 (not the edge), read it | L15 |
| `ruler-draw` | C | tap the 6 cm mark; the line draws from 0 | L16 |
| `estimate` | D | look at the door, tap "about 2 m" | L19 |
| `balance` | E | beam tips; tap "+ cube" until level; "It balances" | L7 |
| `scale` | F | find the number before the needle, count the small steps | L26 |
| `pour` | G | tap Pour; cups fill; tap the one that filled more cups | L8 |
| `jug` | G | eye level at the water top; hold to pour to the line | L30 |
| `thermo` | H | top of the red line; count by 2s from 20 | L33 |
| `clock-read` | I | long hand first, then short hand | L40 |
| `clock-set` | I | tap the 5, tap "+1 hour"; Check | L44 |
| `timeline` | J | jump to the next hour, then minutes; add the jumps | L53 |
| `calendar` | K | find the 1st, count down the week columns | L51 |
| `grid` | L | ant walks the edge (perimeter); rows fill (area) | L56 |
| `cubes` | M | one layer drops in, then the next | L69 |
| `protractor` | N | line on the inner 0, follow inner numbers to the ray | L79 |
| `angle-draw` | N | tap 60 on the protractor; the arm swings there | L80 |
| `convert` | O | each 1 m bar splits into 100 cm; count 100, 200, 300 | L84 |
| `story` | P | read, build the bar, find the missing part | L37 |
| `lineplot` | Q | measure, tap above the number to add an X | L99 |

23 demos, ~110 caption lines. Captions are spoken (voice clips) only for the demos of
ages 5–7 engines (A, B, C read/place/draw, D, E, G, H, I read/set); the rest are read.
Tests per demo: the scene renders every step, the script's fixed values are a real
correct answer (as Box Split's `demoBoxes()` test does), and the demo never auto-opens
in practice.

---

## 6. Hints — three rungs, from live state

Rung 1 = the lesson's `kidTip`. Rung 2 = a visual on the instrument (green spaces,
dashed target line, ghost hand, ant walk, rows filling, layers dropping, circled
zero). Rung 3 = the worked step, animated. The mock shows all three for 26 modes;
copy them.

---

## 7. Voice and language

- **Speaks prompts** for ages 5–7 lessons (Stages 1–2, L14–20, L38–44).
  `speaksPrompts: false` from age 8.
- **English region variants:** spelling and clock words come from `regionCopy.ts`, so one
  clip set needs variants only for lines that differ (metre/meter, quarter past/after).
  `voice.json` declares those as `en-GB` / `en-US` pairs. Estimate ~35 pairs.
- **Khmer:** unit names and time phrases written in Khmer and checked by the owner (§13).
  Lesson content stays as written; only app labels go through i18n.
- Budget: run `npm run voice:plan -- --skill measurement` at Phase 18; target 0 missing.
  Recording uses OpenAI (`--provider openai`).

---

## 8. Tests

- **Structural:** `describeSkillContract` plus `describeActivitySmoke` for all 17 engines.
- **Region:** every lesson's `regions` is a subset of US/GB/KH; no universal lesson
  requires a region-only key; each region still has contiguous unlocks.
- **Generator:** 1,000 draws per mode: values on the instrument's step, no repeats,
  distractors ≠ answer.
- **Behaviour:** one driver per engine via `renderActivity`, buttons by accessible name.
- **Units table:** every conversion round-trips; spellings exist for every region.

---

## 9. Course placement

113 lessons → 23 units, **appended after `u154`**.

| Unit | Title | Lessons |
|---|---|---|
| u155 | Longer, Taller, Heavier | 1–4 |
| u156 | Order and Hold | 5–8 |
| u157 | Measure with Blocks | 9–13 |
| u158 | Rulers | 14–18 |
| u159 | Good Guesses and Number Lines | 19–24 |
| u160 | Scales and Jugs | 25–32 |
| u161 | Hot and Cold | 33–37 |
| u162 | Days and Hours | 38–43 |
| u163 | Clocks | 44–49 |
| u164 | Calendars and How Long | 50–55 |
| u165 | Perimeter | 56–59 |
| u166 | Area | 60–65 |
| u167 | Triangles, Land and Volume | 66–73 |
| u168 | Turns and Angles | 74–78 |
| u169 | Measuring Angles | 79–83 |
| u170 | Changing Units | 84–89 |
| u171 | Other Unit Systems | 90–93 |
| u172 | Measurement Problems | 94–98 |
| u173 | Plots and Circles | 99–102 |
| u174 | Practice: Early Measures | 103–106 |
| u175 | Practice: Time | 107–108 |
| u176 | Practice: Shapes and Space | 109–111 |
| u177 | Practice: Converting and Problems | 112–113 |

A unit whose lessons are all hidden for a region is hidden for it.

---

## 10. Build phases

Gate after every phase: `npx tsc --noEmit`, scoped vitest while working and the full
`npm test` at the gate, `npm run lint` (strict), `npm run build`, then the lesson
opened at localhost:3001 at 390px, in light and dark mode. Engines are written with
every mode up front, so later phases can be JSON only.

| Phase | Levels | New engines | Also |
|---|---|---|---|
| 0 | — | — | platform edits §0.2 (if approved); `units.ts`, `measureNumbers.ts`, `regionCopy.ts`, `motion.ts` + tests; `things.ts` art |
| 1 | 1–6 | A CompareBench | manifest, `index.ts`, registry, contract tests, u155 |
| 2 | 7–8 | E BalanceBeam, G PourLab | G built with all 5 modes |
| 3 | 9–13 | B UnitTrack | L12–13 ride E/G, JSON only |
| 4 | 14–24 | C RulerDesk, D EstimateCards | |
| 5 | 25–37 | F DialScale, H Thermometer, P MeasureStory (same_unit only) | L30–32 JSON on G |
| 6 | 38–55 | I ClockFace, J TimeLine, K CalendarPage | the largest phase; split into 6a (I) and 6b (J, K) if needed |
| 7 | 56–68 | L GridLab, O ConvertBar (land only) | |
| 8 | 69–73 | M CubeBox | L73 JSON on O |
| 9 | 74–83 | N AngleKit | |
| 10 | 84–93 | *(O already built)* | JSON only |
| 11 | 94–98 | *(P already built)* | story templates |
| 12 | 99–102 | Q LinePlot | L101–102 JSON on L |
| 13 | 103–113 | — | practice lessons, JSON only |
| 14 | — | — | region pass: sign in as GB, US, KH, INTL; each sees the right lessons and copy |
| 15 | — | — | Khmer copy pass with the owner |
| 16 | — | — | worksheets for print-friendly modes (ruler read, scales, clocks, grid, convert) |
| 17 | — | — | `voice.json`, `voice:plan` dry run |
| 18 | — | — | course units u155–u177, Skill Manager pass, draft → owner review |

---

## 11. Manifest — features and settings

| Feature id | Read by | Effect |
|---|---|---|
| `audio_speech` | all + hints | speaks prompts (ages 5–7) and hints |
| `sound_chimes` | all | pop / pour / tick / success |
| `haptic_feedback` | A, B, E, I | tap feedback |
| `instrument_motion` | C, E, F, G, H, I, N | spring motion on needles, beams, water, hands; off = jump straight to the value |
| `step_context_tags` | `SkillRound` | the Warm-up / Guided chip |

| Setting | Type | Read by |
|---|---|---|
| `region` | choice `auto` \| `US` \| `GB` \| `KH` \| `all` | lesson filter + `regionCopy` (auto = from the learner's country) |
| `clockFormat` | choice `auto` \| `12` \| `24` | I, J |
| `temperatureScale` | choice `auto` \| `C` \| `F` | H |
| `speechRate` | number 0.5–2.0 | every `say` |

---

## 12. Error register

1. **A region-only lesson required by a universal one.** The universal lesson locks
   forever in other regions. Test in §8.
2. **A value the instrument can't show** (375 mL on a 50-step jug). Rule 4.1.
3. **Floating-point units.** Store integers, format at the edge.
4. **Spelling hard-coded in copy.** Always `{metre}`; a US child seeing "metre" is a bug.
5. **The hour hand jumping at :00.** Hands share one minute-based spring.
6. **Ruler 0 at the edge.** It is inset on purpose; tests assert it.
7. **Invented UK/KH codes in `standards`.** Use `curricula` with year/grade only.
8. **Guessing KH grades.** Leave `curricula.KH` empty until verified.
9. **Drag.** Tap-to-place only (§5.0).
10. **Yellow.** Thermometer red is rose; water is sky.
11. **Week start.** Monday for GB/KH, Sunday for US.
12. **Money creeping into stories.** Money is its own skill; stories use measures only.

---

## 13. Open decisions — settle before Phase 0

| # | Decision | Recommendation |
|---|---|---|
| 1 | Cambodia mapping | Owner provides or confirms the MoEYS Grade 1–6 maths textbooks (or their contents pages); I verify every KH cell and add any Khmer-only topics. Until then KH `curricula` stays empty |
| 2 | Platform edits §0.2 | Approve. Fallback without them: ship universal lessons only, and put region-only lessons in a separate skill per region later. That fallback is worse |
| 3 | Skill name | id `measurement` (permanent); display "Measure It" in English. Khmer name for the owner to choose ("ការវាស់វែង" suggested) |
| 4 | Unit abbreviations in Khmer UI | Latin `cm`, `kg`, `mL` as in Cambodian textbooks (KH ?), Khmer words in speech |
| 5 | Khmer digits on instruments | Follow the app's i18n number setting; instruments use the same digits as the rest of the UI |
| 6 | Release in slices? | Yes: Slice 1 = Phases 0–5 (ages 5–9, the core study need), Slice 2 = time (Phase 6), Slice 3 = Phases 7–13. Each slice is useful on its own |
| 7 | `status: "draft"` while building | Yes, until the owner's review in Phase 18 |
| 8 | Questions per round | 5 teaching, 10 practice; story lessons 4 |
