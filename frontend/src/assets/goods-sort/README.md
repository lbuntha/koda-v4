# Goods Sort SVG collection

This folder owns the lightweight soft-3D vectors used by Goods Shelf Sort.

- Every object uses a `0 0 64 64` viewBox.
- Lighting comes from the upper left, with one soft contact shadow.
- Shapes must remain recognizable around 16–24px for the goal rail.
- A single hidden SVG sprite owns all gradients and product symbols. Each visible item is
  one lightweight `<use>` reference, so large boards do not duplicate definitions.
- Contact shadows are painted ellipses. Avoid SVG/CSS blur filters on goods because they
  create an expensive compositing surface for every animated item on iOS Safari.
- Assets live under `src/`, so Vite compiles them into the lazy Goods Sort JavaScript chunk.
  The PWA precaches that chunk, making the collection available during offline play.

The collection covers all 32 curated catalog goods. Unknown custom goods continue to use
their emoji fallback, so studio-authored activities remain compatible while offline.
