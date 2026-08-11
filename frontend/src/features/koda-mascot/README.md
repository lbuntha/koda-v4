# Global Koda mascot

This folder is the small application runtime for Koda. It does not import the admin editor, API client, or MongoDB code.

- `KodaMascot.tsx` is the public state-driven component used by lessons and canvases.
- `KodaSvgRenderer.tsx` renders any version 1 mascot document and shares layer rendering with Mascot Studio.
- `stateMachine.ts` translates semantic lesson events into animation states.
- `fallbackKoda.ts` provides bundled offline defaults for every runtime state.
- `catalog.tsx` is the reusable SVG part registry.
- `types.ts` is the portable saved-document contract.

Use `KodaMascot` for the application and pass a semantic `state`, such as `talking`, `happy`, or `loading`. Pass a saved `document` only when overriding the built-in visual. Bodies, heads, eyes, mouths, accessories, and patterns remain independent layers. Optional `parentId` and `pivot` fields reserve a backwards-compatible path for grouped rigs and secondary physics.

When a saved document includes `behavior`, the runtime uses its authored whole-character motion and spring settings. SVG library records tagged with `mascotCategory` resolve by stable ID, so editing one safe SVG source updates every character that references it.

The renderer resolves optional nested `groups` recursively and ignores editor-only `anchors`. Documents without either field remain valid version 1 documents.

Saved documents may also contain reusable `clips`. Pass a clip ID or name to play it; omitting the prop uses the document's `activeClipId`:

```tsx
<KodaMascot document={savedMascot} clip="Welcome" state="happy" />
```

Clip transforms are sampled on each animation frame and can target individual layers or groups. The existing semantic state and whole-character behavior remain available, so application state can choose the expression while a clip supplies authored motion.
