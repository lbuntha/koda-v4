import qrcode from "qrcode-generator";

/**
 * The picture a parent posts to Facebook or Telegram about their child's week.
 *
 * Drawn on a canvas on the device, so it works offline and needs no server.
 * It always uses the light theme. It is a post in someone else's feed, and a
 * light card with one violet panel reads the same in every app's dark mode.
 *
 * On purpose it has no child's name, photo, age or score. It shows days
 * practised and totals only, which a parent can post without exposing their
 * child. The QR code and link bring a new family to sign up.
 */

export interface ShareCardText {
  /** "This week". */
  badge: string;
  /** "My child studied 4 days this week". */
  headline: string;
  /** The same line in English when the app is in another language, else "". */
  subline: string;
  /** Sunday-first initials, seven of them. */
  dayInitials: string[];
  masteredLabel: string;
  questionsLabel: string;
  /** Already formatted for the language, e.g. Khmer digits. */
  mastered: string;
  questions: string;
  offer: string;
  offerDetail: string;
  footer: string;
}

export interface ShareCardInput {
  text: ShareCardText;
  /** Seven booleans, oldest day first, matching `days`. */
  practised: boolean[];
  /** Local `YYYY-MM-DD`, oldest first, to pick each dot's weekday initial. */
  days: string[];
  /** Where the QR code and link go. */
  link: string;
}

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

const C = {
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  line: "#E2E8F0",
  ink: "#0F172A",
  muted: "#64748B",
  primary: "#6B46C1",
  primarySoft: "#F3F0FC",
  primaryText: "#553C9A",
  success: "#10B981",
  successText: "#047857",
};

const FONT = `"Plus Jakarta Sans", "Noto Sans Khmer", sans-serif`;
const font = (size: number, weight = 700) => `${weight} ${size}px ${FONT}`;

/** Wait for the app's fonts so Khmer is shaped properly, not in a fallback face. */
async function fontsReady(sample: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(font(64, 800), sample),
      document.fonts.load(font(32, 600), sample),
    ]);
  } catch {
    /* draw with whatever face is there */
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Break text into lines that fit `width`.
 *
 * Khmer is written without spaces between words, so it is split with
 * `Intl.Segmenter` where the browser has it, and by spaces where it does not.
 */
export function wrapText(measure: (s: string) => number, text: string, width: number): string[] {
  const pieces: string[] =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "word" }).segment(text), (s) => s.segment)
      : text.split(/(\s+)/);
  const lines: string[] = [];
  let line = "";
  for (const piece of pieces) {
    const next = line + piece;
    if (line && measure(next.trimEnd()) > width) {
      lines.push(line.trim());
      line = piece.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number): void {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 3;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, size, size, 20);
  ctx.fill();
  ctx.fillStyle = C.ink;
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          Math.floor(x + (col + quiet) * cell),
          Math.floor(y + (row + quiet) * cell),
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }
}

/** Paint the card onto a 1080×1350 canvas (Facebook's 4:5 portrait). */
export function paintShareCard(ctx: CanvasRenderingContext2D, input: ShareCardInput): void {
  const { text } = input;
  const W = SHARE_CARD_WIDTH;
  const H = SHARE_CARD_HEIGHT;
  const pad = 80;
  const inner = W - pad * 2;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = C.canvas;
  ctx.fillRect(0, 0, W, H);

  /* Brand and the badge. */
  ctx.fillStyle = C.primary;
  ctx.font = font(56, 800);
  ctx.fillText("Koda", pad, 140);
  ctx.font = font(28, 700);
  const badgeW = ctx.measureText(text.badge).width + 56;
  ctx.fillStyle = C.primarySoft;
  roundRect(ctx, W - pad - badgeW, 90, badgeW, 64, 32);
  ctx.fill();
  ctx.fillStyle = C.primaryText;
  ctx.fillText(text.badge, W - pad - badgeW + 28, 133);

  /* The headline: what this child did, in the parent's language. */
  let y = 270;
  ctx.fillStyle = C.ink;
  ctx.font = font(68, 800);
  for (const line of wrapText((s) => ctx.measureText(s).width, text.headline, inner).slice(0, 3)) {
    ctx.fillText(line, pad, y);
    y += 100;
  }
  if (text.subline) {
    ctx.fillStyle = C.muted;
    ctx.font = font(32, 600);
    ctx.fillText(text.subline, pad, y - 30);
    y += 30;
  }

  /* The week as seven dots: green on a day they practised. */
  const weekTop = y + 10;
  ctx.fillStyle = C.surface;
  roundRect(ctx, pad, weekTop, inner, 200, 36);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.stroke();
  const step = (inner - 80) / 7;
  input.days.forEach((day, i) => {
    const cx = pad + 40 + step * i + step / 2;
    const cy = weekTop + 80;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    if (input.practised[i]) {
      ctx.fillStyle = C.success;
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy + 1);
      ctx.lineTo(cx - 3, cy + 12);
      ctx.lineTo(cx + 16, cy - 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = C.canvas;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const initial = text.dayInitials[new Date(`${day}T00:00:00`).getDay()] ?? "";
    ctx.fillStyle = C.muted;
    ctx.font = font(26, 700);
    ctx.textAlign = "center";
    ctx.fillText(initial, cx, weekTop + 168);
    ctx.textAlign = "left";
  });

  /* Two totals. */
  const tileTop = weekTop + 232;
  const tileW = (inner - 24) / 2;
  const tiles: [string, string, string][] = [
    [text.mastered, text.masteredLabel, C.successText],
    [text.questions, text.questionsLabel, C.primary],
  ];
  tiles.forEach(([value, label, colour], i) => {
    const x = pad + i * (tileW + 24);
    ctx.fillStyle = C.surface;
    roundRect(ctx, x, tileTop, tileW, 190, 36);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.font = font(80, 800);
    ctx.fillText(value, x + 40, tileTop + 105);
    ctx.fillStyle = C.muted;
    ctx.font = font(28, 600);
    ctx.fillText(wrapText((s) => ctx.measureText(s).width, label, tileW - 80)[0] ?? "", x + 40, tileTop + 155);
  });

  /* The invitation: offer, link and QR code on one violet panel. */
  const panelTop = H - 80 - 330;
  ctx.fillStyle = C.primary;
  roundRect(ctx, pad, panelTop, inner, 290, 44);
  ctx.fill();
  const qrSize = 210;
  drawQr(ctx, input.link, W - pad - 40 - qrSize, panelTop + 40, qrSize);
  const textW = inner - qrSize - 120;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(46, 800);
  ctx.fillText(wrapText((s) => ctx.measureText(s).width, text.offer, textW)[0] ?? "", pad + 44, panelTop + 92);
  ctx.globalAlpha = 0.9;
  ctx.font = font(26, 600);
  wrapText((s) => ctx.measureText(s).width, text.offerDetail, textW)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, pad + 44, panelTop + 145 + i * 40));
  ctx.globalAlpha = 1;
  ctx.font = font(34, 800);
  ctx.fillText(input.link.replace(/^https?:\/\//, "").replace(/\/$/, ""), pad + 44, panelTop + 248);

  ctx.fillStyle = C.muted;
  ctx.font = font(24, 600);
  ctx.textAlign = "center";
  ctx.fillText(text.footer, W / 2, H - 36);
  ctx.textAlign = "left";
}

/** Draw the card and return it as a PNG. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  await fontsReady(input.text.headline + input.text.offer);
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  paintShareCard(ctx, input);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
