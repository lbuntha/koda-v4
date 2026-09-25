import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { layoutBook, pagePicture, withPageChoice, withPagePicture, type PagePicture } from "../bookLayout";
import { type Passage, type PicturePlace } from "../data/passage";
import { isPhoto, photosOf } from "../photos";
import { core } from "../data/text";
import { pictureFor } from "../draft";
import { Picture, PICTURE_KEYS } from "../Picture";
import { PicturePanel } from "./PicturePanel";

/**
 * Pages & pictures — the book as a reader will turn it, one card a page, with a
 * picture to choose for the cover and for each page.
 *
 * Pages are laid out by the same `layoutBook` the reader uses, so what is shown
 * here is what a child gets. A page is Automatic until someone chooses (the
 * picture of the first pictured word on it); it can be given any picture from
 * the art library, or none. Choosing here never touches the quiz: a Words
 * question's picture is the word's own, in `pictures`.
 *
 * Clicking a card is the only step: it opens the picture drawer (`PicturePanel`)
 * directly, rather than a persistent panel sitting beside the pages. There is
 * nothing to keep in view once a page is chosen, and a drawer that opens on
 * demand is one less thing on screen while an author is just reading their pages.
 */

type Draft = Omit<Passage, "rev">;

const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const SERIF = "font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,'Times_New_Roman',serif]";

const HOW: Record<PagePicture["how"], string> = { chosen: "Chosen", auto: "Automatic", none: "No picture" };
const PLACE_NAME: Record<PicturePlace, string> = { top: "Top", bottom: "Bottom", left: "Left", right: "Right" };

export function PagesStep({ draft, onEdit }: { draft: Draft; onEdit(d: Draft): void }) {
  const km = draft.language === "km";
  const book = useMemo(() => layoutBook(draft), [draft]);
  // null = drawer closed; 0 = cover open; n = page n open.
  const [open, setOpen] = useState<number | null>(null);

  const pages = book.story.map((page, i) => ({
    n: i + 1,
    ids: page.map((s) => s.sentence.id),
    text: page.map((s) => s.sentence.text).join(km ? "" : " "),
    picture: pagePicture(page, draft),
    words: [...new Set(page.flatMap((s) => s.tokens.map((t) => t.word)))],
  }));
  const current = open ? pages[open - 1] : null;
  // The pictures of the words on this page (the story's, for the cover): the
  // ones the book already declares first, then any the library can draw.
  const suggested = [
    ...new Set(
      (current ? current.words : draft.sentences.flatMap((s) => s.words.map(core)))
        .flatMap((w) => [draft.pictures[w.toLowerCase()] ?? draft.pictures[w], pictureFor(w, draft.language, PICTURE_KEYS)])
        .filter((k): k is string => !!k),
    ),
  ];
  const choose = (key: string | null | undefined) => {
    if (!current) {
      if (key) onEdit({ ...draft, picture: key });
      return;
    }
    onEdit(withPagePicture(draft, current.ids, key));
  };
  const chosenKey = open === null ? null : current ? current.picture.key : draft.picture;
  /**
   * What "Draw one" opens with, so the model is told what to draw rather than
   * handed a bare line of the story and left to guess a subject out of it.
   */
  const promptSeed = current
    ? `Illustrate this line from the story: “${current.text}”`
    : draft.title.trim()
      ? `A cover illustration for the story titled “${draft.title.trim()}”`
      : "A cover illustration for a children’s story";

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Pages &amp; pictures</h2>
        <p className="text-sm text-muted">
          This is the book as a reader turns it — {pages.length} page{pages.length === 1 ? "" : "s"} after the cover. Pick a card to change its picture. A page left on
          Automatic shows the picture of a word on it.
        </p>
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Pages">
        <li>
          <PageCard label="Cover" selected={open === 0} onSelect={() => setOpen(0)} picture={draft.picture} how="" km={km} text={draft.title} title />
        </li>
        {pages.map((p) => (
          <li key={p.n}>
            <PageCard label={`Page ${p.n}`} selected={open === p.n} onSelect={() => setOpen(p.n)} picture={p.picture.key} how={HOW[p.picture.how]} place={p.picture.key && p.picture.at !== "top" ? PLACE_NAME[p.picture.at] : ""} km={km} text={p.text} />
          </li>
        ))}
      </ol>

      {open !== null && (
        <PicturePanel
          title={current ? `Picture for page ${current.n}` : "Picture for the cover"}
          chosen={chosenKey}
          how={current?.picture.how ?? "chosen"}
          promptSeed={promptSeed}
          suggested={suggested}
          photos={photosOf(draft)}
          allowNone={!!current}
          at={current?.picture.at ?? null}
          onPlace={(at) => current && onEdit(withPageChoice(draft, current.ids, { at }))}
          onChoose={choose}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function PageCard({ label, selected, onSelect, picture, how, place = "", text, km, title = false }: {
  label: string; selected: boolean; onSelect(): void; picture: string | null; how: string; place?: string; text: string; km: boolean; title?: boolean;
}) {
  const what = picture ? (isPhoto(picture) ? "photo" : picture) : "no picture";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${label}: ${what}${how ? ` (${how}${place ? `, ${place.toLowerCase()}` : ""})` : ""}`}
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-colors ${selected ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-line hover:border-indigo-400"}`}
    >
      <span className="block aspect-[16/10] w-full bg-play-sky">
        {picture ? (
          <Picture name={picture} className="p-2" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-surface-muted text-muted">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="grid gap-1 p-3">
        <span className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-muted">
          <span>{label}{place && <span className="ml-1 normal-case tracking-normal text-muted">· {place}</span>}</span>
          {how && <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${how === "Chosen" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "bg-surface-muted text-ink"}`}>{how}</span>}
        </span>
        <span className={`line-clamp-3 text-sm text-ink ${km ? KHMER : SERIF} ${title ? "font-bold" : ""}`}>{text}</span>
      </span>
    </button>
  );
}
