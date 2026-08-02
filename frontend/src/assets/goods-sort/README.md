# Goods Sort SVG collection

This folder owns the lightweight soft-3D vectors used by Goods Shelf Sort.

- Every object uses a `0 0 64 64` viewBox.
- Lighting comes from the upper left, with one soft contact shadow.
- Shapes must remain recognizable around 16–24px for the goal rail.
- Gradient and filter ids are scoped per React instance so repeated goods never collide.
- Assets live under `src/`, so Vite compiles them into the lazy Goods Sort JavaScript chunk.
  The PWA precaches that chunk, making the collection available during offline play.

Prototype pack: chips, cola, milk, donut, teddy, and duck. Unsupported catalog entries
continue to use their emoji fallback until their vector is approved and added.
