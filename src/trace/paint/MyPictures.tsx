/**
 * "My pictures": the child's finished paintings on the Trace page — a row of
 * them, and a viewer to look at one large, save or share it, colour it again,
 * or delete it. Read from the device (see gallery.ts), with the child's other
 * tablets' paintings brought down when online.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, Paintbrush, Star, Trash2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton, UIModal } from "../../components/ui";
import type { Painting } from "./gallery";
import { Gallery, sharePicture } from "./gallery";

export interface Shown extends Painting {
  /** An object URL for the PNG, revoked when the list changes. */
  url: string;
}

/** The active child's paintings, newest first, kept current as they are added, removed or brought down. */
export function usePaintings(): Shown[] {
  const v = useSyncExternalStore(Gallery.subscribe, Gallery.version);
  const [shown, setShown] = useState<Shown[]>([]);
  useEffect(() => {
    // Once per visit: bring down other tablets' paintings, and send any this one kept offline.
    void Gallery.pull().then(() => Gallery.upload());
  }, []);
  useEffect(() => {
    let live = true;
    let urls: string[] = [];
    void Gallery.list().then((rows) => {
      if (!live) return;
      const next = rows.map((p) => ({ ...p, url: URL.createObjectURL(p.png) }));
      urls = next.map((p) => p.url);
      setShown(next);
    });
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [v]);
  return shown;
}

/** One painting in the row: the picture itself, with its stars. */
export function PaintingTile({ p, onOpen }: { p: Shown; onOpen(): void }) {
  const { t } = useT();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${p.title} · ${t("paint.stars", { n: p.stars })}`}
        className="group flex w-full flex-col overflow-hidden rounded-2xl bg-surface text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <img src={p.url} alt="" className="aspect-square w-full bg-white object-contain" />
        <span className="flex items-center gap-1 px-2.5 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.title}</span>
          <Stars n={p.stars} />
        </span>
      </button>
    </li>
  );
}

function Stars({ n, size = "h-3.5 w-3.5" }: { n: number; size?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((k) => (
        <Star key={k} className={`${size} ${k <= n ? "fill-indigo-500 text-indigo-500" : "text-line"}`} />
      ))}
    </span>
  );
}

/** A painting large: how it went, and what to do with it. */
export function PaintingViewer({ p, onClose, onColourAgain }: { p: Shown | null; onClose(): void; onColourAgain?(itemId: string): void }) {
  const { t, language } = useT();
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setSaved(false);
    setConfirm(false);
  }, [p?.key]);
  if (!p) return null;
  const when = new Date(p.paintedAt).toLocaleDateString(language === "km" ? "km-KH" : undefined, { day: "numeric", month: "long", year: "numeric" });
  return (
    <UIModal isOpen onClose={onClose} title={p.title} tone="plain">
      <div className="flex flex-col gap-4">
        <img src={p.url} alt={p.title} className="mx-auto aspect-square w-full max-w-[min(100%,55dvh)] rounded-2xl bg-white object-contain ring-1 ring-line" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Stars n={p.stars} size="h-4 w-4" />
          <span className="font-semibold text-ink">{t("paint.accuracyIs", { n: p.accuracy })}</span>
          <span className="text-muted">· {when}</span>
          {p.ownColours && <span className="text-muted">· {t("paint.ownColours")}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <UIButton icon={saved ? <Check /> : <Download />} onClick={async () => setSaved(await sharePicture(p.png, p.title))}>
            {saved ? t("paint.saved") : t("paint.save")}
          </UIButton>
          {onColourAgain && (
            <UIButton variant="secondary" icon={<Paintbrush />} onClick={() => onColourAgain(p.itemId)}>
              {t("paint.colourAgain")}
            </UIButton>
          )}
          {confirm ? (
            <UIButton
              variant="danger"
              icon={<Trash2 />}
              onClick={async () => {
                await Gallery.remove(p.itemId, p.learnerId);
                onClose();
              }}
            >
              {t("paint.deleteConfirm")}
            </UIButton>
          ) : (
            <UIButton variant="ghost" icon={<Trash2 />} onClick={() => setConfirm(true)}>
              {t("paint.delete")}
            </UIButton>
          )}
        </div>
      </div>
    </UIModal>
  );
}
