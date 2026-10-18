/**
 * Who am I in this room? A nickname and a look, picked from fixed lists.
 *
 * A child never types a name here, which is the whole point: a room can hold a
 * guest with no account and still hold no personal information about them. Taken
 * nicknames are greyed out so nobody picks one and is then told no.
 */

import React from "react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { AVATARS, NICKNAMES, nicknameKey } from "./choices";
import { RoomAvatar } from "./RoomAvatar";

export interface NicknamePickerProps {
  name: string;
  avatar: string;
  onName(name: string): void;
  onAvatar(avatar: string): void;
  /** Nicknames already used in the room. */
  taken?: readonly string[];
}

/** A nickname as this viewer reads it. */
export const useNickname = () => {
  const { t } = useT();
  return (name: string): string => {
    const key = `rebus.nick.${nicknameKey(name)}`;
    const text = t(key);
    return text === key ? name : text;
  };
};

export const NicknamePicker: React.FC<NicknamePickerProps> = ({ name, avatar, onName, onAvatar, taken = [] }) => {
  const { t } = useT();
  const show = useNickname();
  return (
    <div className="flex flex-col gap-4">
      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.group.pickLook")}</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("rebus.group.pickLook")}>
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              aria-label={a}
              onClick={() => onAvatar(a)}
              className={`rounded-full p-1 pointer-coarse:p-1.5 ${avatar === a ? "ring-4 ring-indigo-300 dark:ring-indigo-700" : "opacity-80 hover:opacity-100"}`}
            >
              <RoomAvatar avatar={a} />
            </button>
          ))}
        </div>
      </section>
      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.group.pickName")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t("rebus.group.pickName")}>
          {NICKNAMES.map((n) => {
            const used = taken.includes(n);
            const chosen = name === n;
            return (
              <button
                key={n}
                type="button"
                disabled={used}
                aria-pressed={chosen}
                onClick={() => onName(n)}
                className={themeSystem.card(used ? "default" : "interactive", `min-h-11 px-3 py-2 text-left text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-40 ${chosen ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`)}
              >
                {show(n)}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
