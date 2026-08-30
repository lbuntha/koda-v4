import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import { kodaSystemPrompt, resolveCharacter, type KodaSituation } from "./tutor/persona";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/**
 * The data API, reached through this origin.
 *
 * Mounted before the JSON body parser on purpose: the proxy streams the request
 * through untouched, and a parsed body would have to be re-serialised to get
 * there. One origin is what spares the app CORS and the service worker a second
 * hostname — see docs/BACKEND.md §3.
 */
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";
app.use(
  createProxyMiddleware({
    // Matched rather than mounted: a mount path is stripped before the request
    // is forwarded, and the API serves /v1 itself.
    pathFilter: "/v1",
    target: API_URL,
    changeOrigin: true,
    // The service is unreachable while it is starting, or simply not running.
    // Say so in the shape the client already understands.
    on: {
      error: (_err, _req, res) => {
        const response = res as express.Response;
        if (!response.headersSent) {
          response.status(503).json({
            error: { code: "api_unreachable", message: "The data service is not running." },
          });
        }
      },
    },
  }),
);

app.use(express.json({ limit: "10mb" }));

/**
 * The service credential this server presents to the data API.
 *
 * A family's Gemini key lives in the database, and the one endpoint that hands
 * it out wants this header as well as the caller's own token — see
 * `server/app/routers/system.py`. Unset means no family key is ever fetched
 * and `GEMINI_API_KEY` is all there is, which is exactly right for a dev box
 * that never configured one.
 */
const TUTOR_SERVICE_TOKEN = process.env.TUTOR_SERVICE_TOKEN;

/**
 * What the deployment currently allows.
 *
 * The admin's switchboard is a ceiling, and this is where it stops being
 * advice: the app hides a switched-off feature, and these routes refuse it. A
 * hidden button is a hint — this is the rule.
 *
 * Unreachable API, or a caller with no token, means "allowed": a dev box with
 * no data service running should still answer, and the app is behind a sign-in
 * gate in every deployment that has one.
 */
async function systemAllows(feature: string, authorization?: string): Promise<boolean> {
  if (!authorization) return true;
  const settings = await systemSettings(authorization);
  return settings[feature] !== false;
}

/**
 * The switchboard as values, for the routes that need more than yes/no.
 *
 * Same source and same forgiving failure as `systemAllows`: an unreachable API
 * answers `{}`, and every caller here treats a missing value as its default.
 * Secrets are never in this response — those come from `/resolve`, one at a
 * time, and only for this process.
 */
async function systemSettings(authorization?: string): Promise<Record<string, unknown>> {
  if (!authorization) return {};
  try {
    const res = await fetch(`${API_URL}/v1/system`, { headers: { Authorization: authorization } });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Whether this family's plan covers Koda's AI.
 *
 * The companion to `systemAllows`, and both must say yes. They answer different
 * questions: the switchboard is whether this *deployment* runs the feature at
 * all, this is whether this *family* has bought it. An operator switching AI off
 * stops it for everybody, paid or not; a lapsed subscription stops it for one
 * family while the deployment carries on.
 *
 * Checked here rather than only in the browser because this is where the money
 * is spent — every call past this point is a paid request to Gemini, and a
 * hidden button has never stopped anyone from posting to an endpoint.
 *
 * Unreachable API, or a caller with no token, means "allowed", exactly as the
 * switchboard does: a dev box with no data service should still answer, and
 * every deployment that has a sign-in gate has already applied it.
 */
async function planAllows(feature: string, authorization?: string): Promise<boolean> {
  if (!authorization) return true;
  try {
    const res = await fetch(`${API_URL}/v1/billing/me`, {
      headers: { Authorization: authorization },
    });
    if (!res.ok) return true;
    const body = (await res.json()) as { features?: string[] };
    return Array.isArray(body.features) ? body.features.includes(feature) : true;
  } catch {
    return true;
  }
}

/** What the app is told when a plan does not cover the thing being asked for. */
function planRequired(res: {
  status: (code: number) => { json: (body: unknown) => void };
}): void {
  res.status(402).json({
    error: "plan_required",
    code: "plan_required",
    feature: "ai.koda",
    message: "Ask Koda is part of a paid plan. Upgrade to turn it back on.",
  });
}

/**
 * The deployment's Gemini key, from the system settings collection.
 *
 * The browser used to send this in the request body, which meant every device
 * held a live credential in `localStorage` and put it on the wire on every
 * turn. Now it sends only the token it already has, and the key goes from the
 * database to this process and no further.
 *
 * Quiet on every failure: no key set, or no service token configured, falls
 * back to `GEMINI_API_KEY` in this process's own environment.
 */
async function systemApiKey(
  authorization?: string,
  settingId: string = "ai.geminiApiKey",
): Promise<string | undefined> {
  if (!TUTOR_SERVICE_TOKEN || !authorization) return undefined;
  try {
    const res = await fetch(`${API_URL}/v1/system/settings/${settingId}/resolve`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "X-Service-Token": TUTOR_SERVICE_TOKEN,
      },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { value?: string };
    return body.value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

// Lazy initialize Gemini client
function getGeminiClient(familyKey?: string) {
  const apiKey = (familyKey && familyKey.trim().length > 0) ? familyKey.trim() : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// The SVG collection, read and written as files under src/assets/svg.

// 1. Socratic Tutor Conversational API
/**
 * Where the browser should open the live-voice socket.
 *
 * Normally nowhere: an empty value means "same origin as this page", which is
 * right for a dev box and for any deployment that serves the app from the
 * process holding the socket.
 *
 * It is not right behind Firebase Hosting. Hosting rewrites every path to Cloud
 * Run but does not perform the WebSocket upgrade — the handshake arrives as an
 * ordinary request and is answered 200 instead of 101, so `wss.on("connection")`
 * never fires and the coach simply never connects. Nothing in the logs says
 * "WebSocket": the request looks served. Setting this to the Cloud Run URL lets
 * the page keep loading from Hosting's CDN while the socket goes straight to
 * the process that can actually hold it.
 */
const LIVE_WS_ORIGIN = (process.env.LIVE_WS_ORIGIN ?? "").trim();

/**
 * The handful of facts the client cannot know until it asks.
 *
 * Public by design — an origin is not a secret, and it is needed before there is
 * a session to authenticate with.
 */
app.get("/api/config", (_req, res) => {
  res.json({ liveWsOrigin: LIVE_WS_ORIGIN });
});

app.post("/api/tutor/respond", async (req, res) => {
  try {
    const { problem, state, userMessage, history, topic, personaId } = req.body;
    if (!(await systemAllows("ai.chat", req.headers.authorization))) {
      // A refusal the client already knows how to survive: it falls back to the
      // local socratic engine rather than showing a child an error.
      return res.status(503).json({
        error: { code: "feature_disabled", message: "Socratic chat is switched off." },
      });
    }
    // Same refusal, different reason — and the app should offer an upgrade
    // rather than a shrug, so it is a 402 and not a 503.
    if (!(await planAllows("ai.koda", req.headers.authorization))) {
      return planRequired(res);
    }
    const ai = getGeminiClient(await systemApiKey(req.headers.authorization));

    if (!ai) {
      // No key configured. Still answer — a child mid-question should not hit a
      // dead end — but say so with `degraded`, because a canned nudge dressed as
      // Koda's own reply is how a broken deployment goes unnoticed for weeks:
      // every answer looks plausible and none of them is Koda.
      return res.json({
        degraded: "no_key",
        replyText: `Let's work through this step together! Look closely at the visual interactive model for "${problem?.title || "this problem"}". What happens when you test your next move?`,
        hintType: "question",
        isCorrect: null,
        xpEarned: 10,
        audioSpeechText: "Let's work through this together! What happens when you test your next move?",
      });
    }

    // One seam for every character, in every mode — see `tutor/persona.ts`.
    // The client sends an id; the manner behind it comes from the roster an
    // operator controls, never from the request.
    const character = await resolveCharacter(API_URL, personaId, req.headers.authorization);
    const systemInstruction = `${kodaSystemPrompt(character, {
      mode: "chat",
      topic,
      question: problem?.question,
      where: problem?.situation,
    })}

WHAT THE CHILD IS TOUCHING: ${JSON.stringify(state || {})}
THE CONVERSATION SO FAR: ${JSON.stringify(history || [])}`;

    const prompt = `The child says: "${userMessage || "Can you give me a hint?"}"
Reply as ${character.name}, in JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: {
              type: Type.STRING,
              description: "The tutor's friendly Socratic response to the child.",
            },
            hintType: {
              type: Type.STRING,
              description: "One of: 'question', 'visual_clue', 'encouragement', 'celebration', 'concept_check'",
            },
            suggestedManipulativeAction: {
              type: Type.STRING,
              description: "Optional suggestion for interactive manipulative highlight or reset.",
            },
            isCorrect: {
              type: Type.BOOLEAN,
              description: "True if user solved problem, false if attempt was incorrect, null if general message/question.",
            },
            xpEarned: {
              type: Type.INTEGER,
              description: "XP points to award if solved or made breakthrough (0 to 100).",
            },
            audioSpeechText: {
              type: Type.STRING,
              description: "Short spoken text formatted for Text-to-Speech (clear, cheerful voice line).",
            },
          },
          required: ["replyText", "hintType", "isCorrect", "xpEarned", "audioSpeechText"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in /api/tutor/respond:", error);
    // Same bargain as the missing-key case above: the child is kept moving, and
    // the reply is labelled so the app can show it as a stand-in rather than as
    // Koda thinking. A model id that no longer exists fails exactly here, and
    // without the label it reads as Koda simply being vague.
    res.json({
      degraded: "unreachable",
      replyText: "Let's take a look at this problem together! Try testing a change on the visual model or ask me another question.",
      hintType: "encouragement",
      isCorrect: null,
      xpEarned: 10,
      audioSpeechText: "Let's take a look at this together!",
    });
  }
});

// 2. Text-To-Speech API (Synthesis Voice)
app.post("/api/tutor/speech", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    if (!(await systemAllows("ai.speech", req.headers.authorization))) {
      // Not an error: the browser's own voice is the documented fallback, so
      // switching Gemini speech off makes the app cheaper, not mute.
      return res.json({ audio: null, fallback: true });
    }
    // A plan that does not include Koda gets the same fallback rather than a
    // 402: nothing on screen is asking to be upgraded here, a child is simply
    // being read to, and the browser can do that for free.
    if (!(await planAllows("ai.koda", req.headers.authorization))) {
      return res.json({ audio: null, fallback: true });
    }

    const ai = getGeminiClient(await systemApiKey(req.headers.authorization));
    if (!ai) {
      return res.json({ audio: null, fallback: true });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say warmly and clearly like a friendly math coach: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audio: base64Audio, mimeType: "audio/pcm;rate=24000" });
    } else {
      res.json({ audio: null, fallback: true });
    }
  } catch (error: any) {
    console.error("Error in /api/tutor/speech:", error);
    res.json({ audio: null, fallback: true });
  }
});

// 3. Dynamic Interactive Problem Generator API
app.post("/api/tutor/generate-problem", async (req, res) => {
  try {
    const { topic, difficulty = 1 } = req.body;
    const ai = getGeminiClient(await systemApiKey(req.headers.authorization));

    if (!ai) {
      return res.json({
        id: `gen_${Date.now()}`,
        topic: topic || "balance_equations",
        title: "Dynamic Exploration Challenge",
        story: "Welcome to the adaptive Synthesis sandbox. Explore and test your hypothesis with the interactive tools on screen!",
        instructions: "Interact with the visual elements to find the missing value.",
        socraticHints: [
          "Look at the balance between left and right.",
          "What happens if you isolate the unknown variable?",
        ],
        conceptExplanation: "Using visual models turns abstract algebraic thinking into physical intuition.",
      });
    }

    const systemInstruction = `You are an expert curriculum designer for Synthesis Tutor (Synthesis.com/tutor).
Create an engaging, visual, interactive math or logic problem for kids.
Topic categories:
- balance_equations (Algebraic balance scale with weights and mystery variables x)
- fraction_lab (Visual fraction pie/bar builder, combining or splitting parts)
- spatial_puzzles (Geometry, perimeter, area, rotation, tile packing)
- exponent_growth (Doubling, exponential decay, tree branching visualizers)
- coordinate_quest (Grid navigation, slope, secret treasure plotting)
- logic_matrix (Boolean logic, constraint solving, truth tables)

Make the storyline adventurous, creative, and memorable!`;

    const prompt = `Generate a level ${difficulty} interactive problem for topic: "${topic}".
Return JSON adhering strictly to schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            topic: { type: Type.STRING },
            title: { type: Type.STRING },
            story: { type: Type.STRING },
            instructions: { type: Type.STRING },
            targetValue: { type: Type.STRING, description: "Expected numerical or algebraic solution representation" },
            initialManipulativeState: {
              type: Type.OBJECT,
              description: "JSON state for the visual interactive component",
              properties: {
                leftPan: { type: Type.ARRAY, items: { type: Type.STRING } },
                rightPan: { type: Type.ARRAY, items: { type: Type.STRING } },
                fractions: { type: Type.ARRAY, items: { type: Type.STRING } },
                targetFraction: { type: Type.STRING },
                gridWidth: { type: Type.INTEGER },
                gridHeight: { type: Type.INTEGER },
                shapes: { type: Type.ARRAY, items: { type: Type.STRING } },
                targetArea: { type: Type.INTEGER },
                initialValue: { type: Type.INTEGER },
                growthRate: { type: Type.INTEGER },
                targetSteps: { type: Type.INTEGER },
                targetCoords: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              },
            },
            socraticHints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            conceptExplanation: { type: Type.STRING },
          },
          required: ["id", "topic", "title", "story", "instructions", "socraticHints", "conceptExplanation"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in /api/tutor/generate-problem:", error);
    res.json({
      id: `gen_${Date.now()}`,
      topic: "balance_equations",
      title: "Interactive Balance Challenge",
      story: "Test how balance scales work by adding and removing weights.",
      instructions: "Keep both pans balanced to solve for the missing weight.",
      socraticHints: ["What happens when you remove equal weights from both sides?"],
      conceptExplanation: "Equal operations on both sides maintain mathematical balance.",
    });
  }
});

// 4. Whiteboard / Scratchpad Drawing Analysis API
app.post("/api/tutor/analyze-drawing", async (req, res) => {
  try {
    const { imageBase64, currentProblem, personaId } = req.body;
    if (!(await systemAllows("ai.whiteboard", req.headers.authorization))) {
      return res.status(503).json({
        error: { code: "feature_disabled", message: "Whiteboard analysis is switched off." },
      });
    }
    if (!(await planAllows("ai.koda", req.headers.authorization))) {
      return planRequired(res);
    }
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    const ai = getGeminiClient(await systemApiKey(req.headers.authorization));
    if (!ai) {
      return res.json({
        feedback: "I noticed your sketch on the whiteboard! Writing out your reasoning step-by-step is a great problem-solving strategy. Keep testing your numbers on the visual manipulative!",
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    const character = await resolveCharacter(API_URL, personaId, req.headers.authorization);

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64,
            },
          },
          {
            text: `Read this child's scratchpad and reply as yourself.`,
          },
        ],
      },
      config: {
        systemInstruction: kodaSystemPrompt(character, {
          mode: "whiteboard",
          question: currentProblem?.question ?? currentProblem?.title,
          where: currentProblem?.situation,
        }),
      },
    });

    res.json({ feedback: response.text || "Great scratchpad work! Keep going!" });
  } catch (error: any) {
    console.error("Error in /api/tutor/analyze-drawing:", error);
    res.json({
      feedback: "I see your scratchpad drawing! Working through steps visually is the best way to build mathematical intuition.",
    });
  }
});

/**
 * What a model is allowed to hand back when asked for artwork.
 *
 * The prompt asks for these; the sanitiser in `src/utils/svg` enforces them.
 * Saying them twice is deliberate — a model that ignores the brief produces
 * markup the sanitiser strips, and the author sees a blank preview with a count
 * of what was dropped rather than a mystery.
 */
const ART_BRIEF = `You draw SVG artwork for a children's maths app, for learners aged 4 to 12.

Return ONE self-contained <svg> element and nothing else. No markdown fences, no
explanation, no <html> wrapper.

Rules, all of them hard:
- A viewBox is required. Do not set width or height attributes.
- Flat shapes, gradients and solid fills only: <path>, <circle>, <rect>, <ellipse>,
  <polygon>, <polyline>, <line>, <g>, <defs>, <linearGradient>, <radialGradient>, <text>.
- No <script>, no <foreignObject>, no <image>, no external references of any kind,
  no url(http...), no event handlers (onclick and friends), no CSS @import.
- Hyphenated SVG attribute names (stroke-width, not strokeWidth).
- Bright, friendly, high-contrast colour. It is drawn small, so keep detail bold
  and avoid hairlines under 1 unit.
- Readable on both a white and a dark page: never rely on white as the only fill.`;

/**
 * The house style, in the words a model needs to draw it.
 *
 * A brief that says only "make it cute" gets a different cat every time — a
 * different palette, a different line weight, a different idea of cute — and a
 * library of those never looks like one app. So the style is written down once,
 * from the brand tokens in `src/index.css`, and every prompt is drawn through
 * it. What an author types is the *subject*; this is the house.
 */
const KODA_STYLE = `House style — follow it exactly, whatever the subject:

Character: rounded, chunky and friendly. Big simple silhouettes a four-year-old
reads instantly. Soft corners everywhere — no sharp points, no spikes, no thin
spindly limbs. Slightly oversized heads and eyes where the subject has them.
Think a felt sticker or a soft vinyl toy, not a technical illustration.

Palette — use these and near neighbours of them, nothing else:
  Purple  #6B46C1  #805AD5  #B794F4  (the primary; lead with it)
  Pink    #FF2D78  #FF5E9B  #FFB3D1  (the accent; use it sparingly and on purpose)
  Yellow  #FFD600  #FFD54F  #FFF59D  (highlights, sparkles, warmth)
  Ground  #F0F4FF  #FFFFFF  #0F172A  (background, paper, and the darkest line)
Warm and bright, never muted, never neon. Two or three hues per drawing plus a
ground — a rainbow of everything reads as noise at tile size.

Craft:
- Flat shapes with gentle linear or radial gradients for volume. No photoreal
  shading, no meshes, no filters beyond a soft drop shadow.
- Outlines, where used, are thick and confident (>= 6 units on a 512 canvas) and
  a dark tint of the fill rather than pure black.
- A cheerful face — two dot eyes and a small smile — wherever the subject can
  carry one without being strange. A counting cube may have one; a numeral
  should not.
- Generous padding. Nothing important within 8% of the edge.
- One clear focal subject, centred. Decoration (sparkles, dots, a soft blob of
  colour behind) supports it and never competes.`;

/** The frame a thumbnail is drawn to, when one is asked for. */
const ART_SHAPES: Record<string, string> = {
  thumbnail: "Use viewBox=\"0 0 1600 900\" — a 16:9 store tile. Keep the subject and any lettering inside the middle 80%, because it can be cropped.",
  square: "Use viewBox=\"0 0 512 512\".",
  free: "Choose a viewBox that suits the subject.",
};

/** Pull the SVG out of whatever wrapping a model decided to add. */
function extractSvg(text: string): string | null {
  const match = text.match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0].trim() : null;
}

/**
 * Ask ChatGPT for the markup.
 *
 * The Responses endpoint rather than chat/completions: the codex models are not
 * served on the older one at all, and this is the shape OpenAI is building on.
 * Plain `fetch` — one JSON call, and a dependency earns its place by doing more
 * than this.
 */
async function drawWithChatGPT(apiKey: string, instruction: string, prompt: string) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_ART_MODEL ?? "gpt-5.3-codex",
      instructions: instruction,
      input: prompt,
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(detail?.error?.message ?? `OpenAI refused the request (${res.status}).`);
  }

  const body = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  // `output` carries reasoning items as well as the message, so the text is
  // gathered from the blocks that are text rather than from a fixed position.
  return (
    body.output_text ??
    (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((block) => block.type === "output_text" && block.text)
      .map((block) => block.text)
      .join("\n")
  );
}

/**
 * Ask Claude for the markup.
 *
 * `fallbacks: "default"` is the server-side rescue: if a safety classifier
 * declines the request, the API re-runs it on a fallback model within the same
 * call rather than handing back nothing. A decline before any output is not
 * billed. `stop_reason` is still checked, because the whole chain can refuse.
 */
async function drawWithClaude(apiKey: string, instruction: string, prompt: string) {
  const client = new Anthropic({ apiKey });

  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: instruction,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude declined to draw that${
        response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."
      }`,
    );
  }

  // `content` is a union of block types, and only the text ones carry markup.
  return response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Artwork from a sentence.
 *
 * The model never reaches the library: this returns markup and stops. It lands
 * in the same editor a paste lands in, so the author sees the drawing, sees
 * what the sanitiser dropped, names it and files it — every generated asset is
 * something a person chose to keep.
 */
app.post("/api/art/generate", async (req, res) => {
  const { prompt, shape, style, provider: askedProvider } = req.body ?? {};
  const brief = String(prompt ?? "").trim();

  if (!brief) {
    return res.status(400).json({ error: { code: "no_prompt", message: "Describe the artwork first." } });
  }
  if (brief.length > 600) {
    return res.status(400).json({ error: { code: "prompt_too_long", message: "Keep the description under 600 characters." } });
  }
  if (!(await systemAllows("ai.artGeneration", req.headers.authorization))) {
    return res.status(503).json({
      error: { code: "feature_disabled", message: "Drawing artwork from a prompt is switched off." },
    });
  }

  // The admin's choice unless the caller named one, so a deployment can settle
  // on a provider without every request repeating it.
  const settings = await systemSettings(req.headers.authorization);
  const provider = String(askedProvider ?? settings["ai.artProvider"] ?? "gemini").toLowerCase();
  // Rules, then house style, then frame. The author's sentence stays the
  // subject and never has to carry any of this.
  const styled = String(style ?? "koda") !== "plain";
  const instruction = [
    ART_BRIEF,
    styled ? KODA_STYLE : "",
    ART_SHAPES[String(shape ?? "free")] ?? ART_SHAPES.free,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    let text = "";

    if (provider === "chatgpt" || provider === "openai" || provider === "codex") {
      const key =
        (await systemApiKey(req.headers.authorization, "ai.openaiApiKey")) ??
        process.env.OPENAI_API_KEY;
      if (!key) return res.status(503).json(noKey("ChatGPT"));
      text = await drawWithChatGPT(key, instruction, brief);
    } else if (provider === "claude" || provider === "anthropic") {
      const key =
        (await systemApiKey(req.headers.authorization, "ai.anthropicApiKey")) ??
        process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(503).json(noKey("Claude"));
      text = await drawWithClaude(key, instruction, brief);
    } else {
      const ai = getGeminiClient(await systemApiKey(req.headers.authorization));
      if (!ai) return res.status(503).json(noKey("Gemini"));
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_ART_MODEL ?? "gemini-3.7-flash",
        contents: brief,
        config: { systemInstruction: instruction },
      });
      text = response.text ?? "";
    }

    const markup = extractSvg(text);
    if (!markup) {
      // The model answered with something that is not a drawing. Worth saying
      // plainly: the usual cause is a prompt it read as a question.
      return res.status(502).json({
        error: {
          code: "not_svg",
          message: "The model did not return an SVG. Try describing the picture itself, not a question about it.",
        },
      });
    }

    res.json({ markup, provider });
  } catch (error: any) {
    console.error("Error in /api/art/generate:", error);
    res.status(502).json({
      error: { code: "generate_failed", message: error?.message ?? "The model could not be reached." },
    });
  }
});

/**
 * No usable key — and the two reasons that is true are not the same problem.
 *
 * A key can be saved in Admin → API keys and still be unreachable from here:
 * fetching one needs `TUTOR_SERVICE_TOKEN` shared between this process and the
 * data API, and without it this server silently falls back to its own
 * environment. Reporting that as "no key is configured" sends whoever just
 * pasted one to go and paste it again.
 */
const noKey = (provider: string) => ({
  error: {
    code: TUTOR_SERVICE_TOKEN ? "no_api_key" : "no_service_token",
    message: TUTOR_SERVICE_TOKEN
      ? `No ${provider} API key is configured. Add one in Admin → API keys.`
      : `A ${provider} key saved in Admin → API keys cannot be read: this deployment has no TUTOR_SERVICE_TOKEN, so stored keys are unreachable. Set the same value in .env and the data API, or set the provider's key as an environment variable here.`,
  },
});

// Vite middleware for development vs static production serving
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade for Real-time Voice endpoint
  server.on("upgrade", (request, socket, head) => {
    const urlObj = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (urlObj.pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Handle Gemini Live WebSocket session
  wss.on("connection", async (clientWs: WebSocket, req) => {
    console.log("Client connected to /api/live WebSocket");
    const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    // A WebSocket handshake from a browser carries no Authorization header, so
    // the access token comes as a query parameter. It is the same token the
    // page already holds and it expires in minutes — unlike the API key that
    // used to be here, which was neither.
    const token = urlObj.searchParams.get("token");
    const authorization = token ? `Bearer ${token}` : undefined;
    // Which teacher this child has been given. An id, never prose — the manner
    // behind it is resolved from the roster below.
    const personaId = urlObj.searchParams.get("persona") || undefined;

    if (!(await systemAllows("ai.liveVoice", authorization))) {
      clientWs.send(
        JSON.stringify({ type: "error", error: "The live voice coach is switched off." }),
      );
      clientWs.close();
      return;
    }
    if (!(await planAllows("ai.koda", authorization))) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          code: "plan_required",
          error: "Ask Koda is part of a paid plan. Upgrade to turn it back on.",
        }),
      );
      clientWs.close();
      return;
    }

    const ai = getGeminiClient(await systemApiKey(authorization));

    if (!ai) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          error: "GEMINI_API_KEY is not configured on the server. Please set it in Settings > Secrets.",
        })
      );
      clientWs.close();
      return;
    }

    let session: any = null;

    try {
      // Parse query params for topic/level/voice
      const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const topic = urlObj.searchParams.get("topic") || "Counting and Mathematics";
      const level = urlObj.searchParams.get("level") || "1";
      const contextInfo = urlObj.searchParams.get("context") || "";
      const question = urlObj.searchParams.get("question") || "";

      // The character, and the voice that comes with it. A client may still ask
      // for a particular voice — a child picking one mid-session is part of the
      // coach — but the *default* is the character's own, so choosing Ms Vega
      // gets Ms Vega's voice without anybody wiring the two together.
      const character = await resolveCharacter(API_URL, personaId, authorization);
      const voiceName = urlObj.searchParams.get("voice") || character.voice;

      const systemInstruction = kodaSystemPrompt(character, {
        mode: "voice",
        topic,
        level,
        question: question || contextInfo || undefined,
        where: contextInfo || undefined,
      });

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName as any },
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Check for audio chunk from model
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "audio",
                  audio: audioData,
                  mimeType: "audio/pcm;rate=24000",
                })
              );
            }

            // Check for model text transcription
            const modelParts = message.serverContent?.modelTurn?.parts;
            if (modelParts) {
              for (const part of modelParts) {
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: "modelText",
                      text: part.text,
                    })
                  );
                }
              }
            }

            // Check for user input transcription if available
            const inputParts = (message as any).clientContent?.turns?.[0]?.parts;
            if (inputParts) {
              for (const part of inputParts) {
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: "userText",
                      text: part.text,
                    })
                  );
                }
              }
            }

            // Interruption handling (student spoke over model)
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // Turn complete
            if (message.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live Session Error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  error: err?.message || "Live voice session encountered an issue.",
                })
              );
            }
          },
          onclose: () => {
            console.log("Gemini Live Session closed");
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "closed" }));
            }
          },
        },
      });

      // Send initial ready signal to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: "ready", voice: voiceName }));
      }

      // Handle client audio / text messages
      clientWs.on("message", (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());

          if (parsed.type === "audio" && parsed.audio) {
            session.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } else if (parsed.type === "text" && parsed.text) {
            session.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [{ text: parsed.text }],
                },
              ],
              turnComplete: true,
            });
          } else if (parsed.type === "updateContext" && parsed.context) {
            session.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [{ text: `[System Update: The student is now on this math question/screen: ${parsed.context}. Ask a warm, encouraging Socratic question to guide them!]` }],
                },
              ],
              turnComplete: true,
            });
          }
        } catch (e) {
          console.error("Error processing client live message:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected from /api/live");
        if (session) {
          try {
            session.close();
          } catch (e) {
            // ignore close error
          }
        }
      });
    } catch (err: any) {
      console.error("Failed to establish Gemini Live connection:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: "error",
            error: err?.message || "Failed to start Gemini Live voice session.",
          })
        );
        clientWs.close();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    /*
     * HMR rides this server rather than opening its own port.
     *
     * In middleware mode Vite still starts a separate WebSocket server, by
     * default on 24678 — a port nothing maps in Docker, so the browser reported
     * `WebSocket closed without opened` and hot reload silently stopped working
     * while the app itself looked fine.
     *
     * Sharing the HTTP server means one port, and it keeps working behind any
     * proxy or tunnel that forwards it. Safe alongside the voice socket above:
     * that handler claims `/api/live` and ignores every other upgrade, which is
     * exactly the room Vite needs.
     */
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          const name = path.basename(filePath);
          // The service worker and the manifest must never be served stale: a
          // cached sw.js is the classic way a PWA pins itself to an old build
          // and stops taking updates. Everything else in dist is content-hashed
          // and safe to cache hard.
          if (name === "sw.js" || name.endsWith(".webmanifest") || name === "index.html") {
            res.setHeader("Cache-Control", "no-cache");
            // Vite names built assets `index-lYd6e-q5.js` — the hash is
            // base64url after a dash, not a dotted hex segment, so it needs
            // matching on that shape or every asset silently revalidates.
          } else if (/-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(name)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );

    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Synthesis Tutor Server with Gemini Live running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
