import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { SvgMarkup } from "../assets/svg";
import { preprocessSvgMarkup, inspectSvgMarkup } from "../utils/svg";
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
import { AI_COMPANY_NAME, aiDefault } from "../lib/aiDefaults";

import { translate } from "../lib/i18n";
interface SvgAssetEditorModalProps {
  /** Editing an existing asset when set; adding a new one when null. */
  editingId: string | null;
  /**
   * The id a new asset opens with, for a caller that already knows the name.
   *
   * The Library Studio replacing a house drawing is the case: the art has to
   * be saved as `banana` to win over the one shipped in the reader, and asking
   * the author to retype that name is asking them to get it wrong.
   */
  initialId?: string;
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
  initialId = "",
  initialMarkup = "",
  initialCategory = "",
  existingIds,
  existingCategories,
  onClose,
  onSaved,
}) => {
  const isEdit = editingId !== null;
  const [id, setId] = useState(editingId ?? initialId);
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

  const verdict = useMemo(() => inspectSvgMarkup(markup), [markup]);

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
        aria-label={isEdit ? translate("admin.svgAssetEditorModal.editEditingid", { editingId: editingId }) : translate("admin.svgAssetEditorModal.addSvgAsset")}
      >
        <div className={themeSystem.modal.header}>
          <div>
            <h3 className="text-base font-black text-ink font-mono">
              {isEdit ? translate("admin.svgAssetEditorModal.editEditingid", { editingId: editingId }) : translate("admin.svgAssetEditorModal.addArtwork")}
            </h3>
            <p className="text-xs text-muted">
              {translate("admin.svgAssetEditorModal.savedToTheSharedMongodbArt")}{" "}
              <code className="font-mono">{id || "<id>"}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={translate("admin.svgAssetEditorModal.close")}
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-surface-muted transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-[1fr_260px] gap-5">
          <div className="space-y-4 min-w-0">
            <div className="space-y-1.5">
              <label htmlFor="svg-asset-id" className="text-xs font-mono font-bold text-body">
                {translate("admin.svgAssetEditorModal.assetId")}
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
                {translate("admin.svgAssetEditorModal.category")}
              </label>
              <input
                id="svg-asset-category"
                list="svg-asset-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value.trim().toLowerCase())}
                placeholder={translate("admin.svgAssetEditorModal.fruits")}
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
                    ? translate("admin.svgAssetEditorModal.savingMovesTheAssetOutOf", { initialCategory: initialCategory })
                    : translate("admin.svgAssetEditorModal.usedToOrganiseTheLibraryLeave"))}
              </p>
            </div>

            {canGenerate && (
              <div className="space-y-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/20 p-3">
                <label
                  htmlFor="svg-asset-prompt"
                  className="text-xs font-mono font-bold text-body flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {translate("admin.svgAssetEditorModal.drawItFromADescription")}
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
                  placeholder={translate("admin.svgAssetEditorModal.aCatHoldingThreeBalloonsDescribe")}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500 resize-y"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value as ArtStyle)}
                    aria-label={translate("admin.svgAssetEditorModal.drawingStyle")}
                    className="bg-surface border border-line rounded-xl px-2 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-indigo-500"
                  >
                    <option value="koda">{translate("admin.svgAssetEditorModal.kodaStyle")}</option>
                    <option value="plain">{translate("admin.svgAssetEditorModal.noHouseStyle")}</option>
                  </select>
                  <select
                    value={shape}
                    onChange={(event) => setShape(event.target.value as ArtShape)}
                    aria-label={translate("admin.svgAssetEditorModal.artworkShape")}
                    className="bg-surface border border-line rounded-xl px-2 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-indigo-500"
                  >
                    <option value="free">{translate("admin.svgAssetEditorModal.anyShape")}</option>
                    <option value="thumbnail">{translate("admin.svgAssetEditorModal.169Thumbnail")}</option>
                    <option value="square">{translate("admin.svgAssetEditorModal.square")}</option>
                  </select>
                  <select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value as ArtProvider | "")}
                    aria-label={translate("admin.svgAssetEditorModal.whichModelDraws")}
                    className="bg-surface border border-line rounded-xl px-2 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">{translate("admin.svgAssetEditorModal.defaultValue", { value: AI_COMPANY_NAME[aiDefault("ai.artProvider")] })}</option>
                    <option value="gemini">{translate("admin.svgAssetEditorModal.gemini")}</option>
                    <option value="chatgpt">{translate("admin.svgAssetEditorModal.chatgpt")}</option>
                    <option value="claude">{translate("admin.svgAssetEditorModal.claude")}</option>
                  </select>
                  <button
                    onClick={() => void draw()}
                    disabled={!prompt.trim() || drawing}
                    className={themeSystem.button("primary", "sm")}
                  >
                    {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles />}
                    {drawing ? translate("admin.svgAssetEditorModal.drawing") : markup ? translate("admin.svgAssetEditorModal.redraw") : translate("admin.svgAssetEditorModal.draw")}
                  </button>
                  <span className="text-[11px] text-muted">
                    {translate("admin.svgAssetEditorModal.replacesTheMarkupBelowReviewIt")}
                  </span>
                </div>
                {drawError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">{drawError}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="svg-asset-markup" className="text-xs font-mono font-bold text-body">
                {translate("admin.svgAssetEditorModal.svgMarkup")}
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
                    {translate("admin.svgAssetEditorModal.theSanitiserDrops")}{" "}{verdict.droppedElements}{" "}{translate("admin.svgAssetEditorModal.element")}
                    {verdict.droppedElements === 1 ? "" : "s"}{" "}{translate("admin.svgAssetEditorModal.and")}{" "}{verdict.droppedAttributes}{" "}
                    {translate("admin.svgAssetEditorModal.attribute")}
                    {verdict.droppedAttributes === 1 ? "" : "s"}{" "}{translate("admin.svgAssetEditorModal.fromThisMarkupCompareThePreview")}{" "}<code className="font-mono">{translate("admin.svgAssetEditorModal.utilsSvgSvgpolicyTs")}</code>.
                  </span>
                </div>
              ) : (
                <div className={themeSystem.flash("success", "text-xs")}>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{translate("admin.svgAssetEditorModal.rendersWholeNothingIsDroppedBy")}</span>
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
            <div className="text-xs font-mono font-bold text-body">{translate("admin.svgAssetEditorModal.preview")}</div>
            <div className="rounded-2xl border border-line p-4 flex items-center justify-center bg-checkerboard">
              <SvgMarkup
                markup={markup}
                raw
                size={180}
                title={translate("admin.svgAssetEditorModal.preview")}
                fallback={<span className="text-xs text-muted py-16">{translate("admin.svgAssetEditorModal.nothingToDraw")}</span>}
              />
            </div>
            <div className="flex items-center justify-center gap-4 rounded-2xl border border-line p-3 bg-checkerboard">
              {[24, 48, 72].map((size) => (
                <SvgMarkup key={size} markup={markup} raw size={size} title={translate("admin.svgAssetEditorModal.sizePixels", { size: size })} />
              ))}
            </div>
            <p className="text-[11px] text-muted">
              {translate("admin.svgAssetEditorModal.drawnThroughSanitiseScopeIdsThe")}
            </p>
          </div>
        </div>

        <div className={themeSystem.modal.footer}>
          <button onClick={onClose} className={themeSystem.button("secondary", "sm")}>
            {translate("admin.svgAssetEditorModal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={themeSystem.button("primary", "sm")}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? translate("admin.svgAssetEditorModal.saveChanges") : translate("admin.svgAssetEditorModal.addToCollection")}
          </button>
        </div>
      </div>
    </div>
  );
};
