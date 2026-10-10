/**
 * The parent report's "Paintings" section: the pictures the child finished
 * colouring, newest first, read from the server (each tablet sends its
 * paintings there). Tap one to see it large and save or share it. Draws
 * nothing until the child has finished a painting, or when offline.
 */

import { useEffect, useState } from "react";
import { Check, Download, Images, Star } from "lucide-react";
import { formatDate, useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIModal, UISectionHeader } from "../../components/ui";
import { request } from "../../lib/sync";
import { accessToken } from "../../lib/sync/session";
import type { PaintingMeta } from "../paint/gallery";
import { fetchPng, sharePicture } from "../paint/gallery";

const SHOWN = 12;

interface Loaded extends Omit<PaintingMeta, "key" | "learnerId" | "uploaded"> {
  png: Blob;
  url: string;
}

export function PaintingsReport({ learnerId, learnerName }: { learnerId: string; learnerName: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<Loaded[]>([]);
  const [open, setOpen] = useState<Loaded | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    let urls: string[] = [];
    (async () => {
      try {
        const token = await accessToken();
        const { paintings } = await request<{ paintings: PaintingMeta[] }>(`/trace/paintings/${encodeURIComponent(learnerId)}`, { token, timeoutMs: 15_000 });
        const loaded: Loaded[] = [];
        for (const p of paintings.slice(0, SHOWN)) {
          const png = await fetchPng(learnerId, p.itemId, token);
          if (png) loaded.push({ ...p, png, url: URL.createObjectURL(png) });
        }
        urls = loaded.map((r) => r.url);
        if (live) setRows(loaded);
        else urls.forEach((u) => URL.revokeObjectURL(u));
      } catch {
        /* offline, or none yet: the section stays away */
      }
    })();
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [learnerId]);

  if (rows.length === 0) return null;

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader title={t("report.paintings.title")} subtitle={t("report.paintings.subtitle", { name: learnerName })} icon={<Images className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((p) => (
          <li key={p.itemId}>
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setOpen(p);
              }}
              className="flex w-full flex-col overflow-hidden rounded-2xl bg-surface text-left ring-1 ring-line transition hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <img src={p.url} alt={p.title} className="aspect-square w-full bg-white object-contain" />
              <span className="flex flex-col gap-0.5 px-2.5 py-2">
                <span className="truncate text-sm font-semibold text-ink" lang="km">
                  {p.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Stars n={p.stars} />
                  {p.accuracy}% · {formatDate(p.paintedAt, { day: "numeric", month: "short" })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <UIModal isOpen onClose={() => setOpen(null)} title={open.title} tone="plain">
          <div className="flex flex-col gap-4">
            <img src={open.url} alt={open.title} className="mx-auto aspect-square w-full max-w-[min(100%,55dvh)] rounded-2xl bg-white object-contain ring-1 ring-line" />
            <p className="flex items-center gap-2 text-sm text-body">
              <Stars n={open.stars} />
              {t("paint.accuracyIs", { n: open.accuracy })} · {formatDate(open.paintedAt, { day: "numeric", month: "long", year: "numeric" })}
              {open.ownColours && <span className="text-muted">· {t("paint.ownColours")}</span>}
            </p>
            <div>
              <UIButton icon={saved ? <Check /> : <Download />} onClick={async () => setSaved(await sharePicture(open.png, open.title))}>
                {saved ? t("paint.saved") : t("paint.save")}
              </UIButton>
            </div>
          </div>
        </UIModal>
      )}
    </section>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${n}/3`}>
      {[1, 2, 3].map((k) => (
        <Star key={k} className={`h-3.5 w-3.5 ${k <= n ? "fill-indigo-500 text-indigo-500" : "text-line"}`} />
      ))}
    </span>
  );
}
