# SVG collection

Artwork lives here as plain `.svg` files, one folder per category:

```
fruits/apple.svg          -> id "apple",     category "fruits"
manipulatives/ten-frame.svg
mango.svg                 -> id "mango",     uncategorised
```

The filename is the id and the folder is the category — there is no manifest,
so the tree cannot disagree with itself. Ids are **global**: `<SvgAsset
id="apple" />` names one asset, so the same filename in two categories is an
error the generator refuses to write past.

## Where art lives

This folder is not the only place art comes from, and knowing which store you
are looking at is the difference between "my file is missing" and "my file is
one restart away".

Four collections, resolved in this order by `SvgAsset`:

| store | lives in | changed by |
| --- | --- | --- |
| **family** | `ArtStore`, per family | a family's own uploads |
| **shared** | Mongo `art_assets`, deploy-wide | the *Art* page |
| **skill** | `src/skills/<id>/assets/` | a commit to that skill |
| **bundle** | this folder, inlined by Vite at build | a commit |

The bundle is the floor: it ships with the app and works offline. The shared
collection is what an operator manages, and it **wins** over the bundle for the
same id, so a deployment can correct or retire shipped art without a release.

### Art a skill owns

A skill's own drawings are part of the skill the way its activities and lessons
are, so they live in the skill folder and a skill that is removed takes them
with it. Filing counting's rockets here would make the skill folder an
incomplete description of the skill.

A skill declares its art through its own `index.ts` — nothing outside the skill
folder globs into it, because `docs/PLUGINS.md` §5 makes `index.ts` the only
file the rest of the app may import from a skill, and art is not an exception:

```ts
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);
```

Ids are namespaced `skillId-name` — `counting-rocket`. Bare filenames would put
every skill into the one global namespace this folder lives by, and two skills
shipping a `star.svg` is a normal thing to happen, not a mistake to refuse. The
separator is a hyphen rather than the `skillId/lessonId` slash used elsewhere
because both the id generator and the save endpoint hold names to
`^[a-z0-9]+(-[a-z0-9]+)*$`; a slash would make skill art the one kind an
operator could never edit.

**Editing it.** `generate-art-seed.mjs` walks `src/skills/*/assets/` too, so a
skill's art is seeded into the shared collection under a category named for the
skill and can be retouched on the *Art* page like anything else. The skill still
ships its own copy, so an edit there is an **override**, not a replacement —
which also means Delete removes the override and leaves the skill's own artwork
drawing. To retire a skill's art, change it in the skill.

`skillArt.ts` is deliberately a leaf module. `SvgAsset` reads it and skills write
to it; anything richer would close `SvgAsset -> registry -> skill -> activity ->
SvgAsset` into a real import cycle the moment an activity draws its own art —
which `TouchOrbit` now does.

### From a file to the Art page

Dropping a `.svg` in is step one of three, and only the first is instant:

```
src/assets/svg/fruits/apple.svg
  |
  |-- generate-svg-ids.mjs  --> ids.ts          the SvgAssetId union (typing)
  |-- generate-art-seed.mjs --> art_defaults.json   the server's seed
  |
  '-- registry.ts (Vite glob) --> the bundle    <SvgAsset id="apple" /> works
                                                 immediately, no server needed

src/skills/counting/assets/rocket.svg
  |
  |-- generate-art-seed.mjs --> art_defaults.json   as "counting-rocket"
  |
  '-- the skill's own index.ts --> registerSkillArt()
                                                 <SvgAsset id="counting-rocket" />
```

Both generators run on `npm run dev` and `npm run build`, so a restart is
normally all it takes. Run them by hand with `npm run svg:ids` and
`node scripts/generate-art-seed.mjs`.

At boot, `main.py` seeds each entry of `art_defaults.json` into Mongo through
`art_repo.seed_default`, which is `$setOnInsert` — new ids are inserted, and an
id already there is left exactly as it is. Operator edits and deletions
therefore survive every restart, and re-seeding is always safe to repeat.

### Why new art can look missing on the Art page

`SvgAssetsPage` paints the bundled registry first and then replaces it wholesale
with what the API returns:

```ts
listSvgAssets().then((fresh) => setAssets(fresh));
```

So the page shows the **shared** collection, not this folder. Art that is on
disk but not yet seeded will flash in and vanish — and cannot be edited, moved
or deleted, because there is no server record to act on. The fix is a server
restart with a current `art_defaults.json`, never a change to the component.

## Adding art

Two routes, same result — a file in this folder.

**From the app** (dev server only): the sidebar's *Art* page manages the whole
collection — category rail with counts, search, A–Z or most-recent order,
preview at the sizes artwork actually gets used at, and:

- **Add artwork** — paste markup, name it, file it. Previewed through the real
  pipeline first, with a count of what the sanitiser drops, so a bad paste is
  caught before it is saved.
- **Edit** — same panel against the stored file. Changing the id renames the
  file; changing the category moves it.
- **Select** tiles for bulk **Move to…** (existing or new category) or
  **Delete**. Deleting the last file in a category removes the empty folder.

Every one of those writes the working tree, so the next `git status` shows what
you did.

**From a prompt**: the same *Add artwork* panel takes a description — "a friendly
orange cat holding three balloons, flat cartoon style" — and asks a model for the
markup. What comes back lands in the markup field, not in the library: it is
previewed, sanitised and named exactly as a paste is, so nothing reaches the
collection that a person did not look at and keep. Gemini, ChatGPT or Claude
draws it, each with its own key set in Admin → API keys; the deployment's default
is `ai.artProvider`, and the whole feature is switched off with `ai.artGeneration`.

**By hand**: drop the `.svg` in, then restart — `npm run dev` regenerates both
the id union and the server seed. `npm run svg:ids` alone types the asset and
gets it rendering from the bundle, but leaves it absent from the *Art* page
until the seed is rebuilt too; see [Where art lives](#where-art-lives).

Either way the name is lowercase-kebab-case — it becomes the id, and both the
generator and the save endpoint refuse anything else. Then use it:
`<SvgAsset id="your-id" size={64} title="An apple" />`.

Nothing else registers the file. `registry.ts` globs the folder, so there is no
list to update and no import to add. A built app can list and preview the
collection but not change it: the write endpoint (`svgAssetRoutes.ts`) refuses
outside development, because it edits the working tree.

## What happens to the markup

Paste it as the generator gave it to you — the pipeline in `src/utils/svg`
handles the rest:

- **on load** — `preprocessSvgMarkup` drops the authored `width`/`height` so the
  art fills whatever box it is given, keeps the `viewBox`, adds `xmlns`, and
  hyphenates JSX-style attributes (`strokeWidth` → `stroke-width`), which AI
  output is full of.
- **on render** — `sanitizeSvgMarkup` rebuilds the markup keeping only what
  `svgPolicy.ts` allows, then `scopeSvgIds` namespaces every `id` to that one
  instance so repeated copies do not share gradients or clip paths.

So: no scripts, no event handlers, no remote references survive; anything
outside the allowlist is dropped rather than rendered. If artwork comes out
blank, that is the sanitiser refusing something — check the browser console and
`svgPolicy.ts` for the element or attribute it dropped.

## Writing code against the collection

`SvgAssetId` is a literal union generated from the folder, so an unknown id is a
type error rather than a blank space. `svgAssetIds` lists everything at runtime
(useful for a picker), and `hasSvgAsset(id)` narrows an unknown string.

A skill's `thumbnail` in `manifest.json` is one of those runtime lookups: put an
id from here in it (`"thumbnail": "counting-quest"`) and the Learn tile draws the
artwork instead of an emoji. Ids are checked before icon names, so art called
`star` wins over the `star` icon.

## Collections a picker reads

Two category names are wired to a picker, so filing art there is what puts it in
front of an operator:

- **`thumbnail`** — offered on a skill's *Listing* tab, as the tile a learner
  sees on the Learn page.
- **`badges`** — offered on Settings → Badges, as the picture a badge earns.

Both pickers use `useArtCategory(name)`, which reads the family library, the
shared library and this folder by the same rule `SvgAsset` renders by — so art
filed from the Art page is offered without waiting for a release, and a bundled
asset an operator has deleted is not offered at all. The names are the ones the
shared library already uses, singular `thumbnail` included; a picker looking for
a collection nobody files under is an empty picker.

The thumbnail field still accepts any id typed by hand — the collection decides
what is *offered*, not what is allowed.
