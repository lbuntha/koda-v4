import React, { useEffect, useState } from "react";
import { KeyRound, MessageCircle, Mic, PenTool, Volume2 } from "lucide-react";

import { ApiError, accessToken, refreshSystem, request, usePermissions } from "../../lib/sync";
import { KODA_MASTER, KODA_SETTINGS, type KodaCapability } from "../../lib/koda";
import { themeSystem } from "../../lib/themeSystem";
import { KodaFace } from "../KodaFace";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UISectionHeader, UIToggle, UIToggleRow } from "../ui";
import { KodaCharacters } from "./KodaCharacters";
import { NoAccess } from "./NoAccess";

import { translate } from "../../lib/i18n";
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
    get title() { return translate("admin.kodaPage.voiceConversation"); },
    get blurb() { return translate("admin.kodaPage.theLiveSpokenCoachAChild"); },
    icon: <Mic className="h-4 w-4" />,
  },
  {
    capability: "chat",
    get title() { return translate("admin.kodaPage.writtenHelp"); },
    get blurb() { return translate("admin.kodaPage.aChildTypesAQuestionAnd"); },
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    capability: "speech",
    get title() { return translate("admin.kodaPage.spokenReplies"); },
    get blurb() { return translate("admin.kodaPage.readingWrittenAnswersAloudOffFalls"); },
    icon: <Volume2 className="h-4 w-4" />,
  },
  {
    capability: "whiteboard",
    get title() { return translate("admin.kodaPage.readingADrawing"); },
    get blurb() { return translate("admin.kodaPage.kodaLookingAtWhatAChild"); },
    icon: <PenTool className="h-4 w-4" />,
  },
];

const KodaSkeleton: React.FC = () => (
  <div className="space-y-4" aria-label={translate("admin.kodaPage.loadingAskKoda")} aria-busy="true">
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
export const KodaPage: React.FC<{ embedded?: boolean; onOpenKeys?: () => void }> = ({ embedded = false, onOpenKeys }) => {
  const { can } = usePermissions();
  const allowed = can("system:write");

  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
        title={translate("admin.kodaPage.askKoda")}
        permission="system:write"
        what={translate("admin.kodaPage.whetherKodaAnswersAtAllIs")}
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
          title={translate("admin.kodaPage.askKoda")}
          subtitle={translate("admin.kodaPage.whatKodaCanDoOnThis")}
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
                    <h3 className="font-mono text-base font-bold text-ink">{translate("admin.kodaPage.askKoda")}</h3>
                    <UIBadge variant={running ? "success" : "warning"}>
                      {running ? translate("admin.kodaPage.running") : translate("admin.kodaPage.offForEveryone")}
                    </UIBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {running
                      ? translate("admin.kodaPage.livecountOfLengthKindsOfHelp", { liveCount: liveCount, length: CAPABILITIES.length })
                      : translate("admin.kodaPage.everyKindOfHelpBelowIs")}
                  </p>
                </div>
              </div>
              <UIToggle
                checked={running}
                disabled={busy === KODA_MASTER}
                onChange={() => void write(KODA_MASTER, !running)}
                label={translate("admin.kodaPage.askKoda")}
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
              title={translate("admin.kodaPage.whatKodaCanDo")}
              subtitle={translate("admin.kodaPage.eachIsASeparateBillSo")}
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
                        <UIBadge variant="neutral">{translate("admin.kodaPage.off")}</UIBadge>
                      ) : !running ? (
                        <UIBadge variant="warning">{translate("admin.kodaPage.heldOff")}</UIBadge>
                      ) : null
                    }
                  />
                );
              })}
            </div>
            {!running && (
              <p className="text-xs text-muted">
                {translate("admin.kodaPage.theseAreHeldOffByThe")}
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
              className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-3`)}
            >
              <UISectionHeader
                title={translate("admin.kodaPage.whatKodaCallsWith")}
                subtitle={translate("admin.kodaPage.askKodaAnswersWithTheGemini")}
                icon={<KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-mono text-sm font-bold text-ink">{translate("admin.kodaPage.gemini")}</h4>
                  {geminiKey.isSet ? (
                    <UIBadge variant="success">{translate("admin.kodaPage.savedHint", { hint: geminiKey.hint ?? "" })}</UIBadge>
                  ) : (
                    <UIBadge variant="warning">{translate("admin.kodaPage.notSavedUsesGeminiApiKey")}</UIBadge>
                  )}
                </div>
                {onOpenKeys && (
                  <UIButton variant="secondary" size="sm" icon={<KeyRound />} onClick={onOpenKeys}>
                    {translate("admin.kodaPage.manageApiKeys")}
                  </UIButton>
                )}
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
};
