import React, { useEffect, useState } from "react";
import { KeyRound, MessageCircle, Mic, PenTool, ShieldCheck, Volume2 } from "lucide-react";

import { ApiError, accessToken, refreshSystem, request, usePermissions } from "../../lib/sync";
import { KODA_MASTER, KODA_SETTINGS, type KodaCapability } from "../../lib/koda";
import { themeSystem } from "../../lib/themeSystem";
import { KodaFace } from "../KodaFace";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UISectionHeader, UIToggle, UIToggleRow } from "../ui";
import { KodaCharacters } from "./KodaCharacters";
import { NoAccess } from "./NoAccess";

/** One row of `/system/settings`, as the operator's screens see it. */
interface Setting {
  id: string;
  group: string;
  label: string;
  description: string;
  type: "bool" | "text" | "secret";
  value: boolean | string | null;
  isSet: boolean;
  hint: string | null;
  updatedAt: string | null;
}

/**
 * How each capability is introduced, in the order a person meets them.
 *
 * The wording lives here rather than on the server rows because this page is
 * the only place it is read, and an operator deciding whether to pay for the
 * live voice coach needs a sentence about *cost and audience*, not the
 * one-liner the API uses to describe the switch.
 */
const CAPABILITIES: {
  capability: KodaCapability;
  title: string;
  blurb: string;
  icon: React.ReactNode;
}[] = [
  {
    capability: "voice",
    title: "Voice conversation",
    blurb:
      "The live spoken coach — a child talks, Koda answers out loud. What a tap on Ask Koda opens, and the most expensive call in the app.",
    icon: <Mic className="h-4 w-4" />,
  },
  {
    capability: "chat",
    title: "Written help",
    blurb:
      "A child types a question and Koda answers in writing. The cheapest way to run Koda, and what a tap opens where the voice coach is off.",
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    capability: "speech",
    title: "Spoken replies",
    blurb: "Reading written answers aloud. Off falls back to the device's own voice, which costs nothing.",
    icon: <Volume2 className="h-4 w-4" />,
  },
  {
    capability: "whiteboard",
    title: "Reading a drawing",
    blurb: "Koda looking at what a child drew on the scratchpad and responding to it.",
    icon: <PenTool className="h-4 w-4" />,
  },
];

const KodaSkeleton: React.FC = () => (
  <div className="space-y-4" aria-label="Loading Ask Koda" aria-busy="true">
    {[0, 1].map((card) => (
      <section
        key={card}
        className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
      >
        <div className="h-5 w-40 animate-pulse rounded-lg bg-surface-muted" />
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      </section>
    ))}
  </div>
);

/**
 * Ask Koda — the assistant's own page.
 *
 * Koda's switches used to be four rows in the middle of the deployment
 * switchboard, between open signup and maintenance mode, with the key that
 * makes them work three tabs away. That is the wrong shape for the one feature
 * this product sells: turning Koda on is a job, not a checkbox, and an operator
 * doing it should not have to know which page holds which half.
 *
 * So everything about the assistant is here, in the order the job is done:
 *
 * 1. **Is Koda running at all** — one master switch, which no capability below
 *    can outvote (`with_master_applied` on the server enforces it for every
 *    client at once, so the app cannot draw a button the server would refuse).
 * 2. **What it can do** — writing, talking, speaking replies, reading a
 *    drawing, each switched separately because each is a different bill.
 * 3. **Who it is** — the character roster a parent then chooses from per child.
 * 4. **What it calls with** — the Gemini key, which is what makes the rest real.
 * 5. **Who gets it** — the plan gate, stated rather than switched, because that
 *    is sold per family on the Billing tab and not decided here.
 */
export const KodaPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { can } = usePermissions();
  const allowed = can("system:write");

  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await accessToken();
        const body = await request<{ settings: Setting[] }>("/system/settings", { token });
        if (!cancelled) setSettings(body.settings);
      } catch (e) {
        if (!cancelled) setError((e as ApiError).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <NoAccess
        title="Ask Koda"
        permission="system:write"
        what="Whether Koda answers at all is set for every family on this deployment, not by one of them."
      />
    );
  }

  const write = async (settingId: string, value: boolean | string) => {
    setBusy(settingId);
    setError(null);
    try {
      const token = await accessToken();
      const updated = await request<Setting>(`/system/settings/${settingId}`, {
        method: "PATCH",
        token,
        body: { value },
      });
      setSettings((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      setKeyDraft("");
      // This device obeys the ceiling too — adopt it now rather than leaving a
      // stale copy until the next load, so the FAB disappears as you watch.
      void refreshSystem();
      playSound("pop");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const rowFor = (settingId: string): Setting | undefined =>
    settings?.find((s) => s.id === settingId);
  const isOn = (settingId: string): boolean => rowFor(settingId)?.value === true;

  const master = rowFor(KODA_MASTER);
  const running = master?.value === true;
  const geminiKey = rowFor("ai.geminiApiKey");
  const liveCount = CAPABILITIES.filter(({ capability }) => isOn(KODA_SETTINGS[capability])).length;

  return (
    <div
      className={
        embedded
          ? "space-y-6"
          : "mx-auto max-w-3xl space-y-6"
      }
    >
      {!embedded && (
        <UISectionHeader
          title="Ask Koda"
          subtitle="What Koda can do on this deployment, who it is, and the key it answers with."
          /* The character, because this page is about Koda itself. Sparkles is
             the glyph half the industry uses for "AI"; the child using this
             product knows Koda by its face. */
          icon={<KodaFace size={26} />}
        />
      )}

      {error && <p className={themeSystem.flash("warning")}>{error}</p>}

      {!settings ? (
        <KodaSkeleton />
      ) : (
        <>
          {/* 1. The one switch an operator comes here for. Given a card of its
              own and stated as a sentence, because it is the difference between
              a product that has an AI coach and one that does not. */}
          <section
            className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                {/* The character, and no tile behind it: `KodaMascot` is a
                    cut-out head drawn to sit on nothing, and the tinted square
                    was packaging that made it a glyph again. */}
                <KodaFace size={40} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-base font-bold text-ink">Ask Koda</h3>
                    <UIBadge variant={running ? "success" : "warning"}>
                      {running ? "Running" : "Off for everyone"}
                    </UIBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {running
                      ? `${liveCount} of ${CAPABILITIES.length} kinds of help switched on. A family may still turn Koda off for themselves.`
                      : "Every kind of help below is off while this is, whatever those switches say and whatever a family has paid for."}
                  </p>
                </div>
              </div>
              <UIToggle
                checked={running}
                disabled={busy === KODA_MASTER}
                onChange={() => void write(KODA_MASTER, !running)}
                label="Ask Koda"
                tone="emerald"
              />
            </div>
          </section>

          {/* 2. What it may do. Greyed together when the master is off, rather
              than hidden: an operator has to be able to see what will come back
              on before they switch Koda on again. */}
          <section
            className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
          >
            <UISectionHeader
              title="What Koda can do"
              subtitle="Each is a separate bill, so each is a separate switch"
              /* Koda for the group heading. The four rows underneath keep their
                 own icons: a mic, a speech bubble, a speaker and a pen tell the
                 capabilities apart, and four identical Koda heads would say
                 only that all four are Koda — which the heading already says. */
              icon={<KodaFace size={26} />}
            />
            <div className="space-y-3">
              {CAPABILITIES.map(({ capability, title, blurb, icon }) => {
                const settingId = KODA_SETTINGS[capability];
                const row = rowFor(settingId);
                if (!row) return null;
                return (
                  <UIToggleRow
                    key={settingId}
                    title={title}
                    description={blurb}
                    icon={icon}
                    checked={row.value === true}
                    disabled={!running || busy === settingId}
                    onChange={() => void write(settingId, row.value !== true)}
                    tone="emerald"
                    aside={
                      row.value !== true ? (
                        <UIBadge variant="neutral">Off</UIBadge>
                      ) : !running ? (
                        <UIBadge variant="warning">Held off</UIBadge>
                      ) : null
                    }
                  />
                );
              })}
            </div>
            {!running && (
              <p className="text-xs text-muted">
                These are held off by the master switch above. Nothing here has been changed —
                switching Koda back on restores exactly what was on before.
              </p>
            )}
          </section>

          {/* 3. Who Koda is. The switches above decide whether the assistant
              runs; this decides who a child meets when it does. */}
          <KodaCharacters />

          {/* 4. The credential. On this page rather than only in the key vault
              because switching Koda on without one leaves a coach that cannot
              answer, and finding that out is a support ticket. */}
          {geminiKey && (
            <section
              className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
            >
              <UISectionHeader
                title="What Koda calls with"
                subtitle="The key Koda answers with. The same value as Admin → API keys."
                icon={<KeyRound className="h-5 w-5 text-amber-500" />}
              />
              <div className="space-y-3 rounded-2xl border border-line bg-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-mono text-sm font-bold text-ink">{geminiKey.label}</h4>
                  {geminiKey.isSet ? (
                    <UIBadge variant="success">Set ····{geminiKey.hint}</UIBadge>
                  ) : (
                    <UIBadge variant="warning">Not set</UIBadge>
                  )}
                </div>
                {/* Only the case that needs saying. When the key is set the
                    badge above already says so and the section says what it is
                    for; a paragraph repeating both is noise on a settings page.
                    When it is missing, that is a fault an operator must act on. */}
                {!geminiKey.isSet && (
                  <p className="text-xs text-muted">
                    Without one Koda falls back to this server's{" "}
                    <code className="font-mono">GEMINI_API_KEY</code>, then to canned
                    encouragement.
                  </p>
                )}
                <p className="flex items-start gap-1.5 text-xs text-muted">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Stored on the server and never sent back. Save an empty field to remove it.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    placeholder="AIzaSy..."
                    aria-label={geminiKey.label}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  <UIButton
                    variant="secondary"
                    size="sm"
                    isLoading={busy === geminiKey.id}
                    onClick={() => void write(geminiKey.id, keyDraft)}
                  >
                    Save
                  </UIButton>
                </div>
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
};
