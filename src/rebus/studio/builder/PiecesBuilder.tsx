/**
 * The row of pieces a picture puzzle is made of: drawings, photos from the
 * author's computer, words, stacked words and the signs between them.
 *
 * Every drawing comes from the library (nothing can name a drawing that does
 * not exist), a photo is shrunk in the browser and checked by the server, and
 * each picture is named by what it is read as and sized Small, Normal or Big.
 * `visual` is the same without words and signs, for the picture beside a
 * multiple-choice question.
 */

import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Shapes, X } from "lucide-react";
import { useT } from "../../../lib/i18n";
import { themeSystem } from "../../../lib/themeSystem";
import { UIButton, UIInput, UISelect } from "../../../components/ui";
import { PHOTO_ACCEPT, uploadPhoto } from "../../../library/photos";
import { PIECE_PHOTO_SIDE, UPLOAD_ROUTE } from "../../photos";
import type { Piece, WordStyle } from "../../types";
import { IconPicker } from "../IconPicker";

export interface PiecesBuilderProps {
  pieces: Piece[];
  onChange(pieces: Piece[]): void;
  /** Only drawings and photos: no words, stacks or signs. */
  visual?: boolean;
  /** Keep the drawing library folded away until asked for (a picture beside a question is optional). */
  compact?: boolean;
}

/** What each piece is called in the list, so the author can find and fix it. */
/** How a written word can be drawn, for the picker. */
const WORD_STYLES: readonly WordStyle[] = ["plain", "big", "small", "cut", "upside-down", "reversed", "spaced", "underlined", "crossed"];

export const pieceLabel = (p: Piece): string => (p.kind === "icon" || p.kind === "photo" ? p.name : p.kind === "word" ? (p.style && p.style !== "plain" ? `${p.text} (${p.style})` : p.text) : p.kind === "stack" ? `${p.top} / ${p.bottom}` : p.op);

export const PiecesBuilder: React.FC<PiecesBuilderProps> = ({ pieces, onChange, visual = false, compact = false }) => {
  const { t } = useT();
  const [wordText, setWordText] = useState("");
  const [wordStyle, setWordStyle] = useState<WordStyle>("plain");
  const [stackTop, setStackTop] = useState("");
  const [stackBottom, setStackBottom] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [library, setLibrary] = useState(!compact);

  const add = (piece: Piece) => onChange([...pieces, piece]);
  const remove = (i: number) => onChange(pieces.filter((_, j) => j !== i));
  const move = (i: number, by: -1 | 1) => {
    const next = [...pieces];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const edit = (i: number, patch: Partial<Extract<Piece, { kind: "icon" | "photo" }>>) =>
    onChange(pieces.map((p, j) => (j === i && (p.kind === "icon" || p.kind === "photo") ? { ...p, ...patch } : p)));

  // A photo from the author's own computer: shrunk in the browser, checked and kept by the server.
  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const id = await uploadPhoto(file, UPLOAD_ROUTE, PIECE_PHOTO_SIDE);
      const guess = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 40);
      add({ kind: "photo", id, name: guess || t("rebus.studio.photoName") });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : t("rebus.studio.photoFailed"));
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  };

  const shown = pieces.map((p, i) => ({ p, i })).filter(({ p }) => !visual || p.kind === "icon" || p.kind === "photo");

  return (
    <section className="flex flex-col gap-2" aria-label={t("rebus.studio.pieces")}>
      <h4 className={themeSystem.typography("h4")}>{visual ? t("rebus.studio.pictures") : t("rebus.studio.pieces")}</h4>
      <ol className="flex flex-col gap-1.5">
        {shown.map(({ p, i }) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-muted px-2.5 py-1.5">
            {p.kind === "icon" || p.kind === "photo" ? (
              <>
                <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-black uppercase text-muted">{p.kind === "photo" ? t("rebus.studio.photo") : t("rebus.studio.drawing")}</span>
                <UIInput aria-label={t("rebus.studio.readAs", { n: i + 1 })} value={p.name} onChange={(e) => edit(i, { name: e.target.value })} maxLength={40} className="!min-h-9 min-w-32 flex-1 !py-1" />
                <div role="group" aria-label={t("rebus.studio.sizeOf", { n: i + 1 })} className="flex shrink-0 overflow-hidden rounded-lg border border-line">
                  {([["small", "S"], [undefined, "M"], ["big", "L"]] as const).map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={p.scale === value}
                      aria-label={t(`rebus.studio.size_${label}`)}
                      onClick={() => edit(i, { scale: value })}
                      className={`px-2 py-1 text-xs font-black ${p.scale === value ? "bg-indigo-600 text-white" : "bg-white text-ink dark:bg-slate-900"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="flex-1 text-sm font-bold text-ink">{pieceLabel(p)}</span>
            )}
            <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.moveLeft", { n: i + 1 })} icon={<ArrowLeft />} disabled={i === 0} onClick={() => move(i, -1)} />
            <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.moveRight", { n: i + 1 })} icon={<ArrowRight />} disabled={i === pieces.length - 1} onClick={() => move(i, 1)} />
            <UIButton variant="ghost" size="icon" aria-label={t("rebus.studio.removePiece", { n: i + 1 })} icon={<X />} onClick={() => remove(i)} />
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-muted">{t(visual ? "rebus.studio.noPictures" : "rebus.studio.noPieces")}</li>}
      </ol>

      {library ? (
        <IconPicker onPick={(id, name) => add({ kind: "icon", id, name })} />
      ) : (
        <div>
          <UIButton size="sm" variant="secondary" icon={<Shapes />} onClick={() => setLibrary(true)}>
            {t("rebus.studio.addDrawing")}
          </UIButton>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={picker} type="file" accept={PHOTO_ACCEPT} className="sr-only" aria-label={t("rebus.studio.photoFile")} onChange={(e) => void addPhoto(e.target.files?.[0])} />
        <UIButton size="sm" variant="secondary" icon={<ImagePlus />} isLoading={uploading} disabled={uploading} onClick={() => picker.current?.click()}>
          {t("rebus.studio.addPhoto")}
        </UIButton>
        <span className={themeSystem.typography("caption")}>{t("rebus.studio.photoHint")}</span>
      </div>
      {uploadError && (
        <p role="alert" className={themeSystem.flash("error")}>
          {uploadError}
        </p>
      )}

      {!visual && (
        <>
          <div className="flex flex-wrap gap-2">
            <UIButton size="sm" variant="secondary" onClick={() => add({ kind: "op", op: "+" })}>
              +
            </UIButton>
            <UIButton size="sm" variant="secondary" onClick={() => add({ kind: "op", op: "&" })}>
              &amp;
            </UIButton>
          </div>
          <div className="flex gap-2">
            <UIInput aria-label={t("rebus.studio.wordText")} placeholder={t("rebus.studio.wordText")} value={wordText} onChange={(e) => setWordText(e.target.value)} maxLength={40} />
            <UISelect aria-label={t("rebus.studio.wordStyle")} className="!w-auto" value={wordStyle} onChange={(e) => setWordStyle(e.target.value as WordStyle)}>
              {WORD_STYLES.map((style) => (
                <option key={style} value={style}>
                  {t(`rebus.studio.wordStyle_${style}`)}
                </option>
              ))}
            </UISelect>
            <UIButton
              variant="secondary"
              disabled={!wordText.trim()}
              onClick={() => {
                add({ kind: "word", text: wordText.trim(), ...(wordStyle !== "plain" ? { style: wordStyle } : {}) });
                setWordText("");
                setWordStyle("plain");
              }}
            >
              {t("rebus.studio.addWord")}
            </UIButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <UIInput aria-label={t("rebus.studio.stackTop")} placeholder={t("rebus.studio.stackTop")} value={stackTop} onChange={(e) => setStackTop(e.target.value)} maxLength={40} className="min-w-32 flex-1" />
            <UIInput aria-label={t("rebus.studio.stackBottom")} placeholder={t("rebus.studio.stackBottom")} value={stackBottom} onChange={(e) => setStackBottom(e.target.value)} maxLength={40} className="min-w-32 flex-1" />
            <UIButton
              variant="secondary"
              disabled={!stackTop.trim() || !stackBottom.trim()}
              onClick={() => {
                add({ kind: "stack", top: stackTop.trim(), bottom: stackBottom.trim() });
                setStackTop("");
                setStackBottom("");
              }}
            >
              {t("rebus.studio.addStack")}
            </UIButton>
          </div>
        </>
      )}
    </section>
  );
};
