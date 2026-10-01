/**
 * Noto Sans Khmer, bundled.
 *
 * Khmer used to fall back to whatever the device had — fine on a Mac, boxes for
 * subscripts on an old Android tablet. The font is split by `unicode-range`, so a
 * browser downloads the Khmer part only when Khmer is on screen, and the files are
 * precached with the rest of the build, so it works offline.
 *
 * Imported by `main.tsx` for the whole app — Khmer is a UI language as well as a
 * book language now. An English-only session still never pays for it: the CSS
 * is a few `@font-face` rules, and `unicode-range` keeps the files unfetched
 * until a Khmer character is drawn.
 */
import "@fontsource/noto-sans-khmer/400.css";
import "@fontsource/noto-sans-khmer/600.css";
import "@fontsource/noto-sans-khmer/700.css";
