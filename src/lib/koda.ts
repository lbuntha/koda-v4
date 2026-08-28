/**
 * One answer to "may this person use Koda right now", for the whole app.
 *
 * Three different people can say no, for three different reasons, and every
 * surface that offers Koda has to ask all three in the same order or the app
 * contradicts itself — one screen hides a button the next screen offers and
 * then refuses. So the order lives here and nowhere else:
 *
 * 1. **The deployment.** The operator's switchboard, from the Ask Koda page.
 *    Off is not an upgrade away and not a preference — the feature does not run
 *    here. Nothing is offered, because there is nothing to offer.
 * 2. **The plan.** `ai.koda` on the family's subscription. Off is answerable:
 *    the button stays, and the tap explains what would turn it on.
 * 3. **The parent.** `aiHelpEnabled` for the child on this device. Off is also
 *    answerable, but by a different person and with a different sentence.
 *
 * Staff hold the plan feature by virtue of running the deployment, so an
 * operator testing the app is stopped only by (1) — see `entitlements.py`.
 *
 * None of this enforces anything. Every path behind it is refused by the server
 * whatever this says — `systemAllows`/`planAllows` in `server.ts`. What this
 * decides is what a person is *shown* and *told*, which a 402 is bad at.
 */

import { Billing, AI_FEATURE } from "./billing";
import { ChildSettingsAPI } from "./childSettings";
import { requireKodaHelp } from "./featureGate";
import { System } from "./sync";

/**
 * The four things Koda does, as the app talks about them.
 *
 * Short names rather than setting ids at every call site: a component asks for
 * "voice", and which switch that is stays this file's business.
 */
export type KodaCapability = "chat" | "speech" | "voice" | "whiteboard";

/** The two a child can start a conversation in. See `preferredKodaMode`. */
export type KodaAskMode = Extract<KodaCapability, "chat" | "voice">;

/** Capability -> the deployment switch behind it (`system_defaults.py`). */
export const KODA_SETTINGS: Record<KodaCapability, string> = {
  chat: "ai.chat",
  speech: "ai.speech",
  voice: "ai.liveVoice",
  whiteboard: "ai.whiteboard",
};

/** The master switch. Off means none of the four, whatever they say. */
export const KODA_MASTER = "ai.enabled";

/** Who said no, when somebody did. */
export type KodaBlockedBy = "deployment" | "plan" | "parent" | null;

export interface KodaAccess {
  /** Whether this capability is usable, all three answers taken together. */
  allowed: boolean;
  /** Who stopped it — `null` when nobody did. */
  blockedBy: KodaBlockedBy;
  /**
   * Whether to draw the control at all.
   *
   * The plan and the parent are worth a disabled button and a sentence: both
   * are somebody's decision and both can change. The deployment is not — a
   * feature that does not run here should leave no trace, or every family
   * spends the week asking for a button that cannot exist.
   */
  offered: boolean;
}

/** Whether the deployment runs this capability at all. Master included. */
const deploymentAllows = (capability: KodaCapability): boolean =>
  System.allows(KODA_MASTER) && System.allows(KODA_SETTINGS[capability]);

/**
 * The full verdict for one capability.
 *
 * Cheap and synchronous — three cached reads — so a component may call it in
 * render as freely as it calls `useState`.
 */
export function kodaAccess(capability: KodaCapability): KodaAccess {
  if (!deploymentAllows(capability)) {
    return { allowed: false, blockedBy: "deployment", offered: false };
  }
  if (!Billing.has(AI_FEATURE)) {
    return { allowed: false, blockedBy: "plan", offered: true };
  }
  if (!ChildSettingsAPI.current().aiHelpEnabled) {
    return { allowed: false, blockedBy: "parent", offered: true };
  }
  return { allowed: true, blockedBy: null, offered: true };
}

/** The short question, for a caller that only wants yes or no. */
export const kodaAllows = (capability: KodaCapability): boolean =>
  kodaAccess(capability).allowed;

/**
 * Which way of asking a single tap opens, or `null` for "do not offer Koda".
 *
 * **Voice, wherever this deployment runs it.** Koda is a coach a child talks
 * to; typing is the fallback for a deployment that does not run the voice coach
 * — or for a child who would rather write, which is one tap further in from
 * either panel. Deciding it here rather than at each button is what keeps the
 * floating button, the round's top bar, and anything added later opening the
 * same thing: a tap that means one thing on the home screen and another
 * mid-question is a tap nobody learns.
 *
 * Only the deployment's answer is consulted. The plan and the parent decide
 * whether the panel *opens*, never which one was going to.
 */
export function preferredKodaMode(): KodaAskMode | null {
  if (deploymentAllows("voice")) return "voice";
  if (deploymentAllows("chat")) return "chat";
  return null;
}

/**
 * Run `action` if Koda may do this, or explain why not.
 *
 * The one line a button needs:
 *
 *     onClick={() => askKoda("voice", () => setVoiceOpen(true))}
 *
 * A plan or a parent saying no raises the app's single `UpgradePrompt`, mounted
 * once by `App`. A deployment saying no says nothing, because a control that
 * should not have been drawn has nothing to explain.
 */
export function askKoda(capability: KodaCapability, action: () => void): boolean {
  if (!deploymentAllows(capability)) return false;
  return requireKodaHelp(action);
}
