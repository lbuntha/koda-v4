import React from "react";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { KodaFace } from "./KodaFace";
import { useTheme } from "../context/ThemeContext";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import { UIPageHeader, UIToggle } from "./ui";
import { PersonaPicker } from "./account/PersonaPicker";
import { ChildSettingsAPI } from "../lib/childSettings";
import { usePersona, usePersonaRoster } from "../lib/usePersona";
import { PlanCard } from "./account/PlanCard";
import { DevicesPage } from "./account/DevicesPage";
import { NotificationsSettings } from "./account/NotificationsSettings";
import { usePermissions, useSession } from "../lib/sync";
import { NavShortcuts } from "./NavShortcuts";
import type { TabId } from "./navTabs";

interface SettingsPageProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  embedded?: boolean;
  /*
   * The way on, for a phone.
   *
   * The tab bar there carries four destinations and the rail carries all of
   * them, so on a narrow screen Settings is where Profile and the management
   * pages are reached from — see `NavShortcuts`. Optional: a caller that
   * embeds this page inside another one has its own navigation and passes
   * nothing, and the section simply does not appear.
   */
  activeTab?: TabId;
  onSelectTab?: (tab: TabId) => void;
}

/**
 * One row of a settings group.
 *
 * Flat: an icon, a label, and the control. It used to be a bordered card with
 * its own tinted background *inside* the section card, which on a phone meant
 * two borders and two fills around every switch before you reached the switch.
 * The group draws one border; the rows are separated by a hairline.
 */
const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  /** A single short line, and only when the control does not already say it. */
  note?: string;
  control: React.ReactNode;
}> = ({ icon, title, note, control }) => {
  const l = themeSystem.list;
  return (
    <div className={l.row}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={l.rowIcon}>{icon}</span>
        <div className="min-w-0">
          <h4 className={l.rowTitle}>{title}</h4>
          {note && <p className={l.rowNote}>{note}</p>}
        </div>
      </div>
      {control}
    </div>
  );
};

/** A titled group of rows. The heading sits above the card, not inside it. */
const SettingGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = "",
}) => (
  <section className={className}>
    <div className={themeSystem.list.groupLabel}>{label}</div>
    <div className={themeSystem.list.group}>{children}</div>
  </section>
);

/**
 * A family's own settings — what the app looks and sounds like, and what their
 * plan covers.
 *
 * Everything here belongs to the person using Koda. What *runs* Koda — the XP
 * rates, the badges, the plans, the deployment switchboard — moved to its own
 * Admin page: those are one operator's decisions for everybody, and putting
 * them behind the same door a parent opens to mute the sound effects made the
 * page look like a control panel for a product they had bought rather than
 * settings for the app they were using.
 *
 * Everything here is safe for any adult in the family to change: the worst a
 * mistake does is a dark screen or a silent one. The two things that were *not*
 * safe left this page — scoring, which re-prices stars a child already earned,
 * and the API key, which spends money — and each has its own page and its own
 * right. Skill configuration lives in the Skill Manager; learner-facing
 * personalisation lives with the learner.
 *
 * Appearance and audio belong to the family and follow it to every signed-in
 * device, as one `preferences` document.
 */
export const SettingsPage: React.FC<SettingsPageProps> = ({
  soundEnabled,
  onToggleSound,
  voiceEnabled,
  onToggleVoice,
  embedded = false,
  activeTab,
  onSelectTab,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { can } = usePermissions();
  const session = useSession();
  /*
   * Whether the person looking at this page is the learner it would be about.
   *
   * Both halves matter. `learnerId` says there is a record to write;
   * `learner:update` says this account may write it — the same check the API
   * makes, so this never draws a control whose save would be refused.
   */
  const ownLearnerId = session?.learnerId && can("learner:update") ? session.learnerId : null;
  const teachers = usePersonaRoster();
  // Read through the same store the picker's own subscription repaints on, so
  // choosing a teacher updates this page without a reload.
  const mySettings = usePersona();
  const isDark = theme === "dark";
  // Shown to whoever runs the family, not to a child: a seven-year-old has no
  // use for a renewal date, and "not included" reads as a scolding.
  const showsPlan = can("learner:create");
  /*
   * The device list, which used to be a sidebar row of its own.
   *
   * It belongs here: it is read when something goes wrong — a lost tablet, a
   * device somebody should no longer have — rather than navigated to, and a
   * permanent row for it cost more attention than it earned. Same right the
   * page itself checks, so this never draws a heading over a "no access" card.
   */
  const showsDevices = can("device:list");
  /*
   * Notifications are an adult's setting, and the permission prompt behind them
   * is raised nowhere else in the app. A learner-scoped session never sees the
   * switch — and never could use it, because the endpoint refuses a child's
   * token whatever this page draws.
   */
  const showsNotifications = !session?.learnerId;

  const handleToggleSound = () => {
    // Toggle first so switching sound back on is confirmed by the pop itself.
    onToggleSound();
    playSound("pop");
  };

  const handleToggleVoice = () => {
    playSound("pop");
    onToggleVoice();
  };

  return (
    /* No page padding of its own: the shell already pads and centres the page,
       and adding `spacing.page` here was doubling it — 32px of gutter on each
       side of a 390px phone. */
    <div className={embedded ? "space-y-6" : "max-w-2xl mx-auto space-y-6"}>
      {/* Same duplication the skill library had: on a phone the toolbar above
          this already says "Settings". */}
      {!embedded && (
        <UIPageHeader title="Settings" subtitle="Shared across your family’s devices." />
      )}

      <SettingGroup label="Appearance">
        <SettingRow
          /* `text-ink`, not amber and not indigo: the icon reads as the row's
             own mark rather than as a third accent colour in a card that has
             only a title and a switch. Ink flips with the theme, so it stays
             black on white and white on the dark canvas — a literal black
             would disappear the moment the switch it sits beside is on. */
          icon={isDark ? <Moon className="text-ink" /> : <Sun className="text-ink" />}
          title="Dark mode"
          control={
            <UIToggle
              checked={isDark}
              onChange={() => {
                playSound("pop");
                toggleTheme();
              }}
              label="Dark mode"
            />
          }
        />
      </SettingGroup>

      <SettingGroup label="Sound">
        <SettingRow
          icon={
            soundEnabled ? (
              <Volume2 className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <VolumeX />
            )
          }
          title="Sound effects"
          /* Names its scope. This is the master switch — each skill also has its
             own chimes toggle under Skills, and a parent who reads only this one
             has no way to know the narrower control exists. */
          note="Each skill can also be silenced on its own"
          control={
            <UIToggle
              checked={soundEnabled}
              onChange={handleToggleSound}
              label="Sound effects"
              tone="emerald"
            />
          }
        />
        <SettingRow
          /* Koda, not a microphone. The row switches whether Koda *speaks*, and
             a mic is the input side of sound — it was pointing at the wrong
             half of the thing it controls. Greyed out when the switch is off,
             so the row still reads as inactive at a glance. */
          icon={<KodaFace size={22} className={voiceEnabled ? "" : "opacity-40 saturate-0"} />}
          title="Koda’s voice"
          control={
            <UIToggle checked={voiceEnabled} onChange={handleToggleVoice} label="Voice speech" />
          }
        />
      </SettingGroup>

      {/*
        * The teacher, for a learner who signs in as themselves.
        *
        * A student *is* their own learner, so this writes the same record a
        * parent edits on the Children page — one source of truth, not a second
        * per-account setting that would then disagree with it. Gated on
        * `learner:update`, which is exactly the right the server checks when
        * this saves: a child on a parent-managed tablet does not hold it, so
        * their teacher stays the parent's choice.
        *
        * Only the teacher is here. The daily cap and the starting point are on
        * the parent's page and stay there — a cap a learner can lift is not a
        * cap, while a character is a preference and safe to hand over.
        */}
      {ownLearnerId && teachers.length > 1 && (
        <SettingGroup label="Who teaches you">
          <div className="p-3">
            <PersonaPicker
              value={mySettings.personaId}
              onChange={(personaId) =>
                ownLearnerId && ChildSettingsAPI.set(ownLearnerId, { personaId })
              }
              ariaLabel="Who teaches you"
            />
          </div>
        </SettingGroup>
      )}

      {showsNotifications && <NotificationsSettings />}

      {showsPlan && <PlanCard />}

      {showsDevices && <DevicesPage embedded />}

      {/* Last on the page on purpose: it is a way *out* of Settings, and a list
          of doors above the switches somebody opened Settings to reach would
          make this page look like a menu. */}
      {activeTab && onSelectTab && (
        <NavShortcuts
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />
      )}
    </div>
  );
};
