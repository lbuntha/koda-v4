import React, { useEffect, useState } from "react";
import { Check, Copy, Pencil, X } from "lucide-react";
import { SvgMarkup } from "../assets/svg";
import { themeSystem } from "../lib/themeSystem";
import { playSound } from "../utils/audio";
import type { SvgAssetRecord } from "../lib/svgAssetsApi";
import { copyText } from "../utils/clipboard";

/** The sizes artwork actually gets used at, so a shape that dies small shows it here. */
const SAMPLE_SIZES = [16, 24, 32, 48, 96];

interface SvgAssetPreviewModalProps {
  asset: SvgAssetRecord;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}

/** One asset up close: how it draws at every size it will be asked to draw at, and its source. */
export const SvgAssetPreviewModal: React.FC<SvgAssetPreviewModalProps> = ({
  asset,
  canEdit,
  onEdit,
  onClose,
}) => {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async (label: string, text: string) => {
    const ok = await copyText(text);
    playSound("pop");
    setCopiedLabel(ok ? label : `${label}-failed`);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const CopyButton: React.FC<{ label: string; text: string; children: React.ReactNode }> = ({
    label,
    text,
    children,
  }) => (
    <button onClick={() => copy(label, text)} className={themeSystem.button("secondary", "sm")}>
      {copiedLabel === label ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copiedLabel === label ? "Copied" : copiedLabel === `${label}-failed` ? "Copy blocked" : children}
    </button>
  );

  return (
    <div className={themeSystem.modal.overlay} onClick={onClose}>
      <div
        /* The token caps at max-w-lg; this dialog needs the room, and appending
           a second max-w would leave which one wins to CSS order. */
        className={`${themeSystem.modal.content.replace("max-w-lg", "max-w-3xl")} flex flex-col max-h-[90vh]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={asset.id}
      >
        <div className={themeSystem.modal.header}>
          <div className="min-w-0">
            <h3 className="text-base font-black text-ink font-mono truncate">{asset.id}</h3>
            <p className="text-xs text-muted truncate">src/assets/svg/{asset.id}.svg</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => {
                  playSound("pop");
                  onEdit();
                }}
                className={themeSystem.button("primary", "sm")}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl text-muted hover:text-ink hover:bg-surface-muted transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="rounded-2xl border border-line p-6 flex items-center justify-center bg-checkerboard">
            <SvgMarkup
              markup={asset.markup}
              size={220}
              title={asset.id}
              fallback={
                <span className="text-sm font-mono text-rose-600 dark:text-rose-400">
                  Nothing survived sanitising — check the markup against svgPolicy.ts.
                </span>
              }
            />
          </div>

          <div>
            <div className="text-xs font-mono font-bold text-body mb-2">At the sizes it gets used</div>
            <div className="rounded-2xl border border-line p-4 flex items-end justify-center gap-5 flex-wrap bg-checkerboard">
              {SAMPLE_SIZES.map((size) => (
                <div key={size} className="flex flex-col items-center gap-1.5">
                  <SvgMarkup markup={asset.markup} size={size} title={`${asset.id} at ${size}px`} />
                  <span className="text-[10px] font-mono text-muted">{size}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-mono font-bold text-body">Source</div>
              <div className="flex items-center gap-2">
                <CopyButton label="usage" text={`<SvgAsset id="${asset.id}" size={48} />`}>
                  Copy usage
                </CopyButton>
                <CopyButton label="markup" text={asset.markup}>
                  Copy markup
                </CopyButton>
              </div>
            </div>
            <pre className="bg-surface-muted border border-line rounded-2xl p-3 text-[11px] font-mono text-body overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap break-all">
              {asset.markup}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
