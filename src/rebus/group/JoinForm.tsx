/** Join a room: its code, then who to be. */

import React, { useState } from "react";
import { LogIn } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIInput } from "../../components/ui";
import { roomErrorKey } from "./errors";
import { GroupAPI } from "./groupApi";
import { NicknamePicker } from "./NicknamePicker";
import { CODE_PATTERN, cleanCode } from "./roomLink";
import type { Seat } from "./types";
import { NO_SUGGESTIONS } from "../noSuggestions";

export interface JoinFormProps {
  /** A code from the invitation link. */
  initialCode?: string | null;
  /** The signed-in Koda user's token, linking the seat to them. Missing for a guest. */
  userToken: string | null;
  onJoined(seat: Seat): void;
}

export const JoinForm: React.FC<JoinFormProps> = ({ initialCode, userToken, onJoined }) => {
  const { t } = useT();
  const [code, setCode] = useState(cleanCode(initialCode ?? ""));
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taken, setTaken] = useState<string[]>([]);

  const ready = CODE_PATTERN.test(code) && name !== "" && avatar !== "";

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      onJoined(await GroupAPI.join(code, { name, avatar }, userToken));
    } catch (e) {
      const key = roomErrorKey(e);
      setError(t(key));
      if (key === "rebus.group.err.name_taken") {
        setTaken((list) => [...list, name]);
        setName("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className={themeSystem.typography("h4")}>{t("rebus.group.codeLabel")}</span>
        <UIInput
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          inputMode="text"
          {...NO_SUGGESTIONS}
          autoCapitalize="characters"
          maxLength={11}
          placeholder="ABC123"
          className="text-center text-2xl font-black tracking-[0.3em]"
        />
      </label>
      <NicknamePicker name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} taken={taken} />
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      <UIButton size="lg" fullWidth icon={<LogIn />} isLoading={busy} disabled={!ready || busy} onClick={() => void join()}>
        {t("rebus.group.joinNow")}
      </UIButton>
    </div>
  );
};
