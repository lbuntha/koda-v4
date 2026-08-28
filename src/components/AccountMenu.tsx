import React from "react";
import { Check, LogOut, Moon, Smile, Sun, UserRound } from "lucide-react";
import { playSound } from "../utils/audio";
import { useTheme } from "../context/ThemeContext";
import {
  type NavProfileConfig,
  UIAvatar,
  UIMenu,
  UIMenuItem,
  UIMenuLabel,
  UIMenuSeparator,
  UIModal,
  UISidebarProfile,
} from "./ui";
import { themeSystem } from "../lib/themeSystem";
import { ApiError, SessionAPI, type Session, useSession } from "../lib/sync";
import { diceBearAvatar } from "../lib/avatar";
import { AvatarPickerModal } from "./account/AvatarPickerModal";
import { PinPrompt } from "./account/PinPrompt";

/** Two letters from the active account's name, so the avatar stays recognisable. */
const initialsFor = (value?: string): string => {
  if (!value) return "?";
  const name = value.includes("@") ? value.split("@")[0] : value;
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
};

export const accountType = (account: Session): string => {
  if (account.role === "child" || account.learnerName) return "Child";
  if (account.role === "owner" || account.role === "parent") return "Parent";
  if (account.role === "student") return "Student";
  return account.platformRole && account.platformRole !== "none" ? account.platformRole : account.role;
};

/**
 * What an account is called, anywhere a person can see it.
 *
 * Never the email address — not even here, inside the menu. This is the panel a
 * six-year-old opens to find their own face among the family's, and a parent's
 * address printed at the top of it is the same address on the same shared
 * tablet that the toolbar was not allowed to show.
 *
 * The cost is worth naming: two adults on one device who have both left their
 * display name empty are both "Parent", told apart only by their avatars. A
 * display name fixes that; an address on a child's screen does not.
 */
export const accountName = (account: Session): string =>
  account.learnerName ?? account.displayName ?? accountType(account);

export const accountAvatar = (account: Session): string =>
  diceBearAvatar(account.avatarSeed ?? account.learnerId ?? account.userId ?? account.deviceId);

export const accountContext = (account: Session): string =>
  account.familyName ?? (account.platformRole && account.platformRole !== "none" ? "Platform account" : "");

/*
 * What a *shell* prints about the account — and never an email address.
 *
 * `accountName` above falls back to one, which is right inside the menu itself,
 * where a parent is choosing between their own logins. A shell is different: it
 * is on screen the whole time the device is in a child's hands, in a room with
 * other people in it, so a parent's address would sit there being read by
 * anyone who walks past a screen they have no reason to look away from.
 *
 * Two of them because the two shells have different room. The phone's toolbar
 * has one line under the page name; the rail's account row has a name and a
 * role beneath it.
 */

/**
 * The line under a name in the account menu.
 *
 * Skips the role when the name already *is* the role: "Parent" over
 * "Parent · Buntha" is a row saying the same word twice. A child keeps theirs,
 * because "Thana" and "Child" are different facts.
 */
export const accountMeta = (account: Session): string => {
  const type = accountType(account);
  const context = accountContext(account);
  const parts = accountName(account) === type ? [context] : [type, context];
  return parts.filter(Boolean).join(" · ");
};

/** One line, for the phone toolbar. A child's own name; an adult's standing. */
export const accountSubtitle = (account: Session): string => {
  if (account.learnerName) return account.learnerName;
  const context = accountContext(account);
  return context ? `${accountType(account)} · ${context}` : accountType(account);
};

/**
 * Two lines, for the rail's account row.
 *
 * A parent with no display name is "Parent", over the family they are here for
 * — which is what somebody glancing at the row actually wants to know, and is
 * true of every account rather than only the ones that filled a name in.
 */
export const accountLines = (account: Session): { name: string; role?: string } => {
  const name = accountName(account);
  const context = accountContext(account);
  // Never the same word twice: "Parent" over "Parent" is a row saying nothing.
  const role = context || (name === accountType(account) ? undefined : accountType(account));
  return { name, role };
};

export interface AccountMenuProps {
  /** The JSON placeholder, used only before anybody has signed in. */
  profile: NavProfileConfig;
  onOpenProfile: () => void;
  /**
   * Which shell is asking.
   *
   * `bar` is the phone's toolbar — a round portrait in the top-right corner.
   * `rail` is the sidebar footer — a full-width row with a name and a role,
   * which is what there is room for once the rail exists.
   */
  variant?: "bar" | "rail";
}

/**
 * The account menu, wherever it is opened from.
 *
 * Owns the light/dark switch, switching between the accounts this device knows,
 * and the one place in the app where signing out is a single gesture. One
 * component for both shells rather than one each: this is the menu that can
 * sign a family out of a tablet, and two copies of it is two places for that to
 * go subtly wrong.
 *
 * The face always shows the account currently using this device, so a
 * parent-to-child switch is visible immediately rather than leaving a parent's
 * email above an open child portal.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({
  profile,
  onOpenProfile,
  variant = "bar",
}) => {
  const { theme, setTheme } = useTheme();
  const session = useSession();
  const accounts = SessionAPI.accounts();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  // The account a child asked for and has not answered for yet.
  const [pinFor, setPinFor] = React.useState<{ deviceId: string; name: string } | null>(null);
  // A switch that cannot be completed has to say so. Silently doing nothing
  // reads as a broken menu, and the old behaviour — landing on the sign-in
  // screen — read as being signed out of the account you were already using.
  const [switchError, setSwitchError] = React.useState<string | null>(null);

  const l = themeSystem.list;

  // Signed in, the trigger *is* the active account: the JSON profile was a
  // placeholder from before there was one, and a name nobody typed is worse
  // than no name.
  const shown: NavProfileConfig = session
    ? {
        ...accountLines(session),
        initials: initialsFor(session.learnerName ?? session.email),
        avatarUrl: accountAvatar(session),
      }
    : profile;

  /*
   * What the menu does, apart from how it looks.
   *
   * Held here because the two presentations below are genuinely different
   * shapes — a dropdown of rows, and a sheet of large cards — but they must
   * never become two different behaviours. Only the drawing is duplicated.
   */
  const close = () => setSheetOpen(false);

  const switchTo = (deviceId: string, name: string) => {
    playSound("pop");
    close();
    setSwitchError(null);
    void SessionAPI.switchAccount(deviceId).catch((error) => {
      // Not a failure — the switch is waiting on four digits.
      if ((error as ApiError).code === "pin_required") {
        setPinFor({ deviceId, name });
        return;
      }
      setSwitchError((error as ApiError).message);
    });
  };

  const choose = (action: () => void) => () => {
    playSound("pop");
    close();
    action();
  };

  const others = accounts.filter((account) => account.deviceId !== session?.deviceId);

  return (
    <>
      {variant === "rail" ? (
        <UIMenu
          side="top"
          align="start"
          className="w-[calc(100%-0.25rem)]"
          trigger={({ toggle, isOpen }) => (
            <UISidebarProfile
              profile={shown}
              hasMenu
              isMenuOpen={isOpen}
              onClick={() => {
                playSound("pop");
                toggle();
              }}
            />
          )}
        >
          {({ close: closeMenu }) => (
            <>
              {session && (
                <>
                  <UIMenuLabel>Current account</UIMenuLabel>
                  <UIMenuItem
                    icon={
                      <UIAvatar
                        name={accountName(session)}
                        src={accountAvatar(session)}
                        size="xs"
                        decorative
                      />
                    }
                    isActive
                    disabled
                  >
                    <span className="block">{accountName(session)}</span>
                    <span className="block text-xs opacity-60">
                      {accountMeta(session)} · Active
                    </span>
                  </UIMenuItem>
                </>
              )}

              {others.length > 0 && (
                <>
                  <UIMenuLabel>Switch account</UIMenuLabel>
                  {others.map((account) => (
                    <UIMenuItem
                      key={account.deviceId}
                      icon={
                        <UIAvatar
                          name={accountName(account)}
                          src={accountAvatar(account)}
                          size="xs"
                          decorative
                        />
                      }
                      onSelect={() => {
                        closeMenu();
                        switchTo(account.deviceId, accountName(account));
                      }}
                    >
                      <span className="block">{accountName(account)}</span>
                      <span className="block text-xs opacity-60">{accountMeta(account)}</span>
                    </UIMenuItem>
                  ))}
                </>
              )}

              <UIMenuSeparator />

              {session && (
                <>
                  <UIMenuItem
                    icon={<UserRound />}
                    onSelect={() => {
                      closeMenu();
                      choose(onOpenProfile)();
                    }}
                  >
                    View profile
                  </UIMenuItem>
                  <UIMenuItem
                    icon={<Smile />}
                    onSelect={() => {
                      closeMenu();
                      choose(() => setAvatarOpen(true))();
                    }}
                  >
                    Change avatar
                  </UIMenuItem>
                </>
              )}

              <UIMenuLabel>Appearance</UIMenuLabel>
              <UIMenuItem
                icon={<Sun />}
                isActive={theme === "light"}
                onSelect={() => {
                  closeMenu();
                  choose(() => setTheme("light"))();
                }}
              >
                Light
              </UIMenuItem>
              <UIMenuItem
                icon={<Moon />}
                isActive={theme === "dark"}
                onSelect={() => {
                  closeMenu();
                  choose(() => setTheme("dark"))();
                }}
              >
                Dark
              </UIMenuItem>

              <UIMenuSeparator />

              {/* The app is behind the gate, so this menu only ever belongs to
                  somebody signed in — "sign in" here would be an offer with
                  nothing behind it. */}
              <UIMenuLabel>
                {session ? `Signed in as ${accountName(session)}` : "Signed in"}
              </UIMenuLabel>
              <UIMenuItem
                icon={<LogOut />}
                tone="danger"
                onSelect={() => {
                  closeMenu();
                  choose(() => void SessionAPI.signOut())();
                }}
              >
                Sign out
              </UIMenuItem>
            </>
          )}
        </UIMenu>
      ) : (
        <>
          <button
            className={themeSystem.appShell.avatarButton}
            onClick={() => {
              playSound("pop");
              setSheetOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-label={`Account: ${shown.name}`}
            title={shown.name}
          >
            <UIAvatar
              name={shown.initials ?? shown.name}
              src={shown.avatarUrl}
              size="fill"
              decorative
            />
          </button>

          {/*
            * The same menu as the rail's, as a sheet a child can use.
            *
            * A dropdown of 14px rows is the wrong control for the one flow here
            * that is only ever performed by a six-year-old — picking their own
            * face out of the family's list. So on a phone the faces are 48px,
            * the names are the largest text in the panel, and the panel arrives
            * from the edge the thumb is already on.
            */}
          <UIModal
            isOpen={sheetOpen}
            onClose={close}
            title="Account"
            maxWidth="max-w-md"
          >
            <div className="space-y-5">
              {session && (
                <div>
                  <div className={l.groupLabel}>You are signed in as</div>
                  <div className={l.group}>
                    <div className={l.account(true)}>
                      <span className={l.accountAvatar}>
                        <UIAvatar
                          name={accountName(session)}
                          src={accountAvatar(session)}
                          size="fill"
                          decorative
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block ${l.accountName}`}>{accountName(session)}</span>
                        <span className={`block ${l.accountMeta}`}>{accountMeta(session)}</span>
                      </span>
                      <Check className="w-5 h-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                    </div>
                  </div>
                </div>
              )}

              {others.length > 0 && (
                <div>
                  <div className={l.groupLabel}>Switch to</div>
                  <div className={l.group}>
                    {others.map((account) => (
                      <button
                        key={account.deviceId}
                        className={l.account(false)}
                        onClick={() => switchTo(account.deviceId, accountName(account))}
                      >
                        <span className={l.accountAvatar}>
                          <UIAvatar
                            name={accountName(account)}
                            src={accountAvatar(account)}
                            size="fill"
                            decorative
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block ${l.accountName}`}>{accountName(account)}</span>
                          <span className={`block ${l.accountMeta}`}>{accountMeta(account)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className={l.groupLabel}>Appearance</div>
                <div className={`${l.group} divide-y-0`}>
                  <div className={l.segmentRow}>
                    <button
                      className={l.segment(theme === "light")}
                      onClick={() => {
                        playSound("pop");
                        setTheme("light");
                      }}
                      aria-pressed={theme === "light"}
                    >
                      <Sun />
                      Light
                    </button>
                    <button
                      className={l.segment(theme === "dark")}
                      onClick={() => {
                        playSound("pop");
                        setTheme("dark");
                      }}
                      aria-pressed={theme === "dark"}
                    >
                      <Moon />
                      Dark
                    </button>
                  </div>
                </div>
              </div>

              {session && (
                <div className={l.group}>
                  <button className={l.rowTap} onClick={choose(onOpenProfile)}>
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={l.rowIcon}>
                        <UserRound />
                      </span>
                      <span className={l.rowTitle}>View profile</span>
                    </span>
                  </button>
                  <button className={l.rowTap} onClick={choose(() => setAvatarOpen(true))}>
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={l.rowIcon}>
                        <Smile />
                      </span>
                      <span className={l.rowTitle}>Change avatar</span>
                    </span>
                  </button>
                  <button
                    className={l.rowTap}
                    onClick={choose(() => void SessionAPI.signOut())}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={l.rowIcon}>
                        <LogOut />
                      </span>
                      <span className={l.rowDanger}>Sign out</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </UIModal>
        </>
      )}

      {switchError && (
        <p
          role="alert"
          className="mt-2 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {switchError}
        </p>
      )}
      <PinPrompt
        isOpen={Boolean(pinFor)}
        accountName={pinFor?.name}
        onClose={() => setPinFor(null)}
        onSubmit={async (pin) => {
          await SessionAPI.switchAccount(pinFor!.deviceId, pin);
          setPinFor(null);
        }}
      />
      <AvatarPickerModal
        isOpen={avatarOpen}
        currentSeed={session?.avatarSeed}
        onClose={() => setAvatarOpen(false)}
        onSave={async (seed) => {
          await SessionAPI.updateAvatar(seed);
        }}
      />
    </>
  );
};
