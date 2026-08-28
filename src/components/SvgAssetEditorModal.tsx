import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { SvgMarkup } from "../assets/svg";
import { preprocessSvgMarkup, sanitizeSvgMarkup, isSafeSvgMarkup } from "../utils/svg";
import { themeSystem } from "../lib/themeSystem";
import {
  SUGGESTED_SVG_CATEGORIES,
  SVG_ID_PATTERN,
  UNCATEGORISED,
  moveSvgAsset,
  saveSvgAsset,
} from "../lib/svgAssetsApi";
import { playSound } from "../utils/audio";
import {
  generateSvg,
  type ArtProvider,
  type ArtShape,
  type ArtStyle,
} from "../lib/artGenerationApi";
import { useSystem } from "../lib/sync";

/** Elements and attributes in a document, for comparing before and after sanitising. */
function countMarkup(markup: string): { elements: number; attributes: number } | null {
  if (!markup || typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) return null;
  const elements = parsed.querySelectorAll("*");
  let attributes = 0;
  elements.forEach((element) => {
    attributes += element.attributes.length;
  });
  return { elements: elements.length, attributes };
}

type Verdict =
  | { state: "empty" }
  | { state: "invalid"; message: string }
  | { state: "ok"; droppedElements: number; droppedAttributes: number };

/**
 * What the pipeline will do to this markup, worked out while the author types.
 *
 * The sanitiser drops silently by design, so the one place that must not be
 * silent is here: paste artwork using something outside the allowlist and the
 * count tells you before it becomes a blank space in a lesson.
 */
function inspect(markup: string): Verdict {
  const trimmed = markup.trim();
  if (!trimmed) return { state: "empty" };
  if (!isSafeSvgMarkup(trimmed)) {
    return {
      state: "invalid",
      message: "Must start with <svg> and carry no <script>, on… handlers, or embedded documents.",
    };
  }

  const normalised = preprocessSvgMarkup(trimmed);
  const sanitised = sanitizeSvgMarkup(normalised);
  if (!sanitised) {
    return {
      state: "invalid",
      message: "The SVG could not be parsed. Check its tags and quoting.",
    };
  }

  const before = countMarkup(normalised);
  const after = countMarkup(sanitised);
  return {
    state: "ok",
    droppedElements: before && after ? Math.max(0, before.elements - after.elements) : 0,
    droppedAttributes: before && after ? Math.max(0, before.attributes - after.attributes) : 0,
  };
}

interface SvgAssetEditorModalProps {
  /** Editing an existing asset when set; adding a new one when null. */
  editingId: string | null;
  initialMarkup?: string;
  /** Category the asset is filed under. */
  initialCategory?: string;
  /** Ids already taken, so a new asset cannot silently overwrite one. */
  existingIds: string[];
  /** Categories already in use, offered before the generic suggestions. */
  existingCategories: string[];
  onClose: () => void;
  onSaved: (id: string, markup: string, category: string) => void;
}

export const SvgAssetEditorModal: React.FC<SvgAssetEditorModalProps> = ({
  editingId,
  initialMarkup = "",
  initialCategory = "",
  existingIds,
  existingCategories,
  onClose,
  onSaved,
}) => {
  const isEdit = editingId !== null;
  const [id, setId] = useState(editingId ?? "");
  const [category, setCategory] = useState(
    initialCategory === UNCATEGORISED ? "" : initialCategory,
  );
  const [markup, setMarkup] = useState(initialMarkup);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [shape, setShape] = useState<ArtShape>("free");
  // "" follows the deployment's default, which is the setting most authors
  // should never have to think about. Naming one is for comparing them.
  const [provider, setProvider] = useState<ArtProvider | "">("");
  const [style, setStyle] = useState<ArtStyle>("koda");
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  // The deployment's ceiling. A switched-off feature is not offered at all,
  // rather than offered and refused by the server after a wait.
  const canGenerate = useSystem().allows("ai.artGeneration");

  const draw = async () => {
    if (!prompt.trim() || drawing) return;
    setDrawing(true);
    setDrawError(null);
    try {
      const drawn = await generateSvg(prompt, {
        shape,
        style,
        provider: provider || undefined,
      });
      // Straight into the markup field, which is the point: the preview, the
      // sanitiser's report and the save button all already work on that value,
      // so a drawing is reviewed exactly as a paste is.
      setMarkup(drawn);
      playSound("pop");
    } catch (failure) {
      setDrawError((failure as Error).message);
    } finally {
      setDrawing(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verdict = useMemo(() => inspect(markup), [markup]);

  const idError = (() => {
    if (!id) return null;
    if (!SVG_ID_PATTERN.test(id)) return "Lowercase letters, numbers and single hyphens only.";
    // Its own id is not a clash; anyone else's is.
    if (id !== editingId && existingIds.includes(id))
      return "An asset with this id already exists.";
    return null;
  })();

  // Blank means uncategorised, so an untouched field on an uncategorised asset
  // is not a move — comparing the raw text would claim it was.
  const filedCategory = category.trim() || UNCATEGORISED;

  const categoryError =
    category && !SVG_ID_PATTERN.test(category)
      ? "Lowercase letters, numbers and single hyphens only."
      : null;

  const canSave = Boolean(id) && !idError && !categoryError && verdict.state === "ok" && !saving;

  // What the author has typed, then what they already use, then the generic set —
  // so an existing category is one keystroke away and a near-duplicate is visible.
  const categoryOptions = [
    ...new Set([
      ...existingCategories.filter((name) => name !== UNCATEGORISED),
      ...SUGGESTED_SVG_CATEGORIES,
    ]),
  ];

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // Store normalised markup so every client renders the same document.
      const normalised = preprocessSvgMarkup(markup.trim());
      // A rename moves the Mongo record first so the write lands on the new id.
      if (isEdit && editingId && id !== editingId) {
        await moveSvgAsset(editingId, { toId: id, category: filedCategory });
      }
      await saveSvgAsset(id, normalised, filedCategory);
      playSound("pop");
      onSaved(id, normalised, filedCategory);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={themeSystem.modal.overlay} onClick={onClose}>
      <div
        /* The token caps at max-w-lg; this dialog needs the room, and appending
           a second max-w would leave which one wins to CSS order. */
        className={`${themeSystem.modal.content.replace("max-w-lg", "max-w-4xl")} flex flex-col max-h-[90vh]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit ${editingId}` : "Add SVG asset"}
      >
        <div className={themeSystem.modal.header}>
          <div>
            <h3 className="text-base font-black text-ink font-mono">
              {isEdit ? `Edit ${editingId}` : "Add artwork"}
            </h3>
            <p className="text-xs text-muted">
              Saved to the shared MongoDB art library as{" "}
              <code className="font-mono">{id || "<id>"}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-surface-muted transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-[1fr_260px] gap-5">
          <div className="space-y-4 min-w-0">
            <div className="space-y-1.5">
              <label htmlFor="svg-asset-id" className="text-xs font-mono font-bold text-body">
                Asset id
              </label>
              <input
                id="svg-asset-id"
                value={id}
                onChange={(event) => setId(event.target.value.trim().toLowerCase())}
                placeholder="ten-frame"
                className="w-full bg-surface-muted border border-line rounded-xl px-3 py-2 text-sm font-mono text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
              <p className="text-[11px] text-muted">
                {idError ||
                  (isEdit && id !== editingId
                    ? `Renames the asset; update any <SvgAsset id="${editingId}"> references.`
                    : "Becomes the value you pass to <SvgAsset id=…>.")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="svg-asset-category" className="text-xs font-mono font-bold text-body">
                Category
              </label>
              <input
                id="svg-asset-category"
                list="svg-asset-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value.trim().toLowerCase())}
                placeholder="fruits"
                className="w-full bg-surface-muted border border-line rounded-xl px-3 py-2 text-sm font-mono text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500"
              />
              <datalist id="svg-asset-categories">
                {categoryOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted">
                {categoryError ||
                  (isEdit && initialCategory && filedCategory !== initialCategory
                    ? `Saving moves the asset out of ${initialCategory}.`
                    : "Used to organise the library. Leave blank to file it later.")}
              </p>
            </div>

            {canGenerate && (
              <div className="space-y-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/20 p-3">
                <label
                  htmlFor="svg-asset-prompt"
                  className="text-xs font-mono font-bold text-body flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Draw it from a description
                </label>
                <textarea
                  id="svg-asset-prompt"
                  rows={2}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter alone would fight the newlines a longer brief wants.
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void draw();
                  }}
                  maxLength={600}
                  placeholder="a cat holding three balloons — describe the subject; Koda style does the rest"
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500 resize-y"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value as ArtStyle)}
                    aria-label="Drawing style"
                    className="bg-surface border border-line rounded-xl px-2 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-indigo-500"
                  >
                    <option value="koda">Koda style</option>
                    <option value="plain">No house style</option>
                  </select>
                  <select
                    value={shape}
                    onChange={(event) => setShape(event.target.value as ArtShape)}
                    aria-label="Artwork shape"
                    className="bg-surface border border-line rounded-xl px-2 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-indigo-500"
                  >
                    <option value="free">Any shape</option>
                    <option value="thumbnail">16:9 thumbnail</option>
                    <option value="square">Square</option>
                  </select>
                  <select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as ArtProvider | "")}
                    aria-label="Which model draws"
                    className="bg-surface border border-line rounded-xl px-2 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Default model</option>
                    <option value="gemini">Gemini</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="claude">Claude</option>
                  </select>
                  <button
                    onClick={() => void draw()}
                    disabled={!prompt.trim() || drawing}
                    className={themeSystem.button("primary", "sm")}
                  >
                    {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles />}
                    {drawing ? "Drawing…" : markup ? "Redraw" : "Draw"}
                  </button>
                  <span className="text-[11px] text-muted">
                    Replaces the markup below — review it before saving.
                  </span>
                </div>
                {drawError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">{drawError}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="svg-asset-markup" className="text-xs font-mono font-bold text-body">
                SVG markup
              </label>
              <textarea
                id="svg-asset-markup"
                value={markup}
                onChange={(event) => setMarkup(event.target.value)}
                spellCheck={false}
                placeholder="Paste the <svg>…</svg> your generator produced"
                className="w-full h-64 bg-surface-muted border border-line rounded-xl px-3 py-2 text-xs font-mono text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            {verdict.state === "invalid" && (
              <div className={themeSystem.flash("error", "text-xs")}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{verdict.message}</span>
              </div>
            )}
            {verdict.state === "ok" &&
              (verdict.droppedElements > 0 || verdict.droppedAttributes > 0 ? (
                <div className={themeSystem.flash("warning", "text-xs")}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    The sanitiser drops {verdict.droppedElements} element
                    {verdict.droppedElements === 1 ? "" : "s"} and {verdict.droppedAttributes}{" "}
                    attribute
                    {verdict.droppedAttributes === 1 ? "" : "s"} from this markup. Compare the
                    preview with what you expected — if something is missing, its name needs adding
                    to <code className="font-mono">utils/svg/svgPolicy.ts</code>.
                  </span>
                </div>
              ) : (
                <div className={themeSystem.flash("success", "text-xs")}>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Renders whole — nothing is dropped by the sanitiser.</span>
                </div>
              ))}
            {error && (
              <div className={themeSystem.flash("error", "text-xs")}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Live preview: exactly the pipeline the app renders through. */}
          <div className="space-y-3">
            <div className="text-xs font-mono font-bold text-body">Preview</div>
            <div className="rounded-2xl border border-line p-4 flex items-center justify-center bg-checkerboard">
              <SvgMarkup
                markup={markup}
                raw
                size={180}
                title="Preview"
                fallback={<span className="text-xs text-muted py-16">nothing to draw</span>}
              />
            </div>
            <div className="flex items-center justify-center gap-4 rounded-2xl border border-line p-3 bg-checkerboard">
              {[24, 48, 72].map((size) => (
                <SvgMarkup key={size} markup={markup} raw size={size} title={`${size} pixels`} />
              ))}
            </div>
            <p className="text-[11px] text-muted">
              Drawn through sanitise → scope ids, the same path the app uses.
            </p>
          </div>
        </div>

        <div className={themeSystem.modal.footer}>
          <button onClick={onClose} className={themeSystem.button("secondary", "sm")}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={themeSystem.button("primary", "sm")}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? "Save changes" : "Add to collection"}
          </button>
        </div>
      </div>
    </div>
  );
};
