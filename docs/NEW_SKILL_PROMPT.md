# Build a Koda learning skill

Paste this prompt and fill the fields. This is the authoring entrypoint; do not load
all skill folders or historical build plans.

```text
Build a Koda learning skill.

NAME / ID: [topic / kebab-case-id]
OUTCOME: [observable learner capability]
AGES: [range]
SCOPE: [teaching techniques and practice coverage for this release]

Read docs/SKILL_DEVELOPMENT.md, §0 first — it lists the mistakes that leave no
trace. It contains the implementation rules and routes specific questions to
references. Use docs/SKILL_BUILD_TEMPLATE.md only when the
scope needs a written plan or you need a complete lesson JSON example.

Read src/skills/kit/example/ExampleActivity.tsx first: it is the whole activity
contract in about a hundred lines. Then src/skills/counting/index.ts for
registration, and only the named ranges of src/skills/types.ts. Open a production
engine from counting or addition only for behaviour the example does not show —
they run 600 to 1,000 lines and reading one whole is most of a build's budget.
Search existing lesson conceptKeys and prerequisites before defining new ones.
Do not copy an entire skill.

Build in src/skills/<id>/ using the shared round and SDK. Reuse existing engines
when they teach the intended interaction; otherwise implement modes for this
release. Supply manifest, lessons, registration, voice declarations, needed assets,
and applicable tests. Keep new skills draft. Register in src/skills/registry.ts and
append teaching and separate practice units in src/curriculum/course.json.

Follow the validation matrix in SKILL_DEVELOPMENT.md §11. Run focused tests while
building; run npm run lint, npm test, and npm run build before completion. Check
real-app entry points, 360px light/dark layouts, and a full offline round. Report
what passed, what could not be checked, and the release status.

Keep the plan and progress reports brief. Reuse discovered paths and existing
helpers; do not repeatedly read the same files or reproduce the guide in the plan.
```

Counting is the structural reference (five engines). Addition is the larger-skill
benchmark (twelve engines). Their lesson counts are examples, not targets.
