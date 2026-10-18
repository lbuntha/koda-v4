/**
 * What a friend sees on opening an invitation link without being signed in.
 *
 * It stands in front of the sign-in gate, like a reset link does: this person
 * is here for a game, not an account, so the first thing they get is a way in
 * as a guest. Someone who does have an account can sign in instead, and the
 * link brings them back to the same room.
 */

import React from "react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { DEFAULT_SETTINGS } from "../settings";
import { GroupHome } from "./GroupHome";

export interface GuestRoomScreenProps {
  code: string;
  /** Leave as a guest to sign in; the code stays so the room is waiting afterwards. */
  onSignIn(): void;
}

export const GuestRoomScreen: React.FC<GuestRoomScreenProps> = ({ code, onSignIn }) => {
  const { t } = useT();
  return (
    <main className="min-h-screen bg-page px-4 py-6">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.group.guestBanner")}</p>
        <GroupHome userToken={null} settings={DEFAULT_SETTINGS} initialCode={code} onExit={onSignIn} onSignIn={onSignIn} />
      </div>
    </main>
  );
};
