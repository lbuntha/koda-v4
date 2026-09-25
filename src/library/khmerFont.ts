/**
 * Noto Sans Khmer, bundled.
 *
 * Khmer used to fall back to whatever the device had — fine on a Mac, boxes for
 * subscripts on an old Android tablet. The font is split by `unicode-range`, so a
 * browser downloads the Khmer part only when Khmer is on screen, and the files are
 * precached with the rest of the build, so it works offline.
 *
 * Imported by the library's two pages, not the app shell: an English-only session
 * never pays for it.
 */
import "@fontsource/noto-sans-khmer/400.css";
import "@fontsource/noto-sans-khmer/600.css";
import "@fontsource/noto-sans-khmer/700.css";
