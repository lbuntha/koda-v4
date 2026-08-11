# Koda Mascot Studio

This folder owns the standalone SVG character composer. Application rendering lives in `../../features/koda-mascot` so the runtime stays independent from the editor. The Heads collection supports combined face artwork, while eyes and mouths remain independently replaceable.

- `catalog.tsx` is a compatibility export of the global SVG catalog. The accessory paths are based on `koda-svg-accessories.zip`.
- `MascotCanvas.tsx` adds selection and dragging around the shared global SVG layer renderer.
- `model.ts` owns defaults, metadata creation, and local draft persistence.
- `types.ts` is a compatibility export of the global versioned metadata contract.
- `MascotStudioPage.tsx` is the admin management screen.

MongoDB is authoritative through `/mascots`; browser local storage under `koda_mascot_studio_v1` is the offline fallback. Exported JSON remains portable, and exported SVG includes the selected SMIL animations.

Whole-character behavior is editable separately from per-layer animation, including motion, duration, intensity, looping, and spring values. Author-managed SVGs use the shared SVG Asset Studio: assign a mascot category there and the sanitized Mongo-backed asset appears automatically in the matching Mascot Studio collection.

Built-in vector parts support an optional per-layer linear gradient with editable start color, end color, and angle. Gradient data is stored on the layer, so previews, reusable styles, runtime rendering, JSON, and SVG exports retain the authored fill. Custom SVG library parts keep their own authored fills.

Right-click a part on the live canvas to bring it forward, send it backward, move it directly to the front or back, or delete it. Ordering stays within the part's current group so rearranging a face layer does not break the surrounding rig.

Built-in layer motion is also author-adjustable. `animationIntensity` controls bounce/float distance, wiggle angle, pulse fade, blink closure, pupil look distance, or spin rotation; `animationFeel` selects smooth, spring, snappy, or linear timing. Older documents omit both fields and receive compatible defaults.

Layers can be marked in the timeline and grouped when they share a parent. Groups own offset, scale, rotation, opacity, visibility, and a visible pivot. Ungrouping bakes the composed transform back into layers and nested groups so the pose does not jump. Named anchors can live at the canvas root or inside a group; they are saved as rig metadata and removed from SVG artwork exports.

Animation clips are reusable timelines stored inside the mascot document. Select a layer or group, scrub to a time, pose the target, and capture a keyframe. Clips support duration, looping, linear/ease-in/ease-out/ease-in-out interpolation, playback, per-keyframe deletion, and target-safe cleanup when artwork is replaced or removed. Ungrouping bakes child keyframes into their new coordinate space.

Saving a draft persists clips and keyframes to MongoDB with the rest of the version 1 document. JSON exports keep the editable animation data, while SVG exports embed the active clip as standalone SMIL transform and opacity animation.

The built-in cute creature pack demonstrates reusable rigs rather than special-case renderers. Every bear preset shares a child-friendly arch body, small round ears, a quiet translucent muzzle, and a minimal high-contrast face inspired by Koda's simple character language. Color, markings, ears, pose, and behavior stay independently editable. Teddy Bear includes `Happy Jump` and `Cozy Idle`, Panda includes `Welcome Wave`, Sleepy Bear includes `Sleepy Yawn`, and Gummy Bear includes `Jelly Wobble`.

Eye-focused bear presets use the same system: Blinking Bear swaps open and closed bear eyes, Winking Bear swaps a complete bear wink pose, Sleepy Blink Bear performs a slow close, and Dizzy Bear rotates an offset-pupil bear-eye layer. Each eye pose remains a normal layer whose timing, opacity, scale, and rotation keyframes can be edited.

Built-ins are immutable fallback starting points, not locked character instances. After applying and editing one, `Save as style` stores the complete visual, rig, behavior, and clips in the owner-scoped `mascot_styles` MongoDB collection. Applying a managed style remaps every layer, group, anchor, clip, and keyframe ID; `Update style` replaces the managed template without changing the shipped fallback, and managed styles can be deleted independently.

The storybook pack adds original tall-reader, woodland-scout, elephant, fox, and bird rigs inspired by friendly classroom illustration proportions. The shape pack adds soft pentagon, diamond, triangle, and pebble bodies. `Shape Talker` demonstrates reusable open/closed eye poses, a separate white-eye and black-pupil rig, adjustable `look` motion, and rest, small, wide, and O speech mouths; all artwork and keyframes remain normal editable layers.
