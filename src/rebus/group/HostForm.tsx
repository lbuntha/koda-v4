/** Open a room: a topic, how many puzzles, how hard, and who to be. Needs a signed-in Koda user. */

import React, { useState } from "react";
import { DoorOpen } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UITabs } from "../../components/ui";
import { CATEGORIES } from "../categories";
import type { RebusSettings } from "../settings";
import { roomErrorKey } from "./errors";
import { GroupAPI } from "./groupApi";
import { NicknamePicker } from "./NicknamePicker";
import type { Seat } from "./types";

export interface HostFormProps {
  userToken: string;
  settings: RebusSettings;
  /** Puzzles available per topic on this device, to hide topics with none. */
  counts?: Readonly<Record<string, number>>;
  onOpened(seat: Seat): void;
}

const LEVELS = ["easy", "medium", "hard"] as const;

export const HostForm: React.FC<HostFormProps> = ({ userToken, settings, counts, onOpened }) => {
  const { t } = useT();
  const topics = [...CATEGORIES.map((c) => c.id as string), "mixed"].filter((id) => id === "mixed" || !counts || (counts[id] ?? 0) > 0);
  const [category, setCategory] = useState(topics[0] ?? "mixed");
  const [count, setCount] = useState(settings.questionChoices[0] ?? 5);
  const [difficulty, setDifficulty] = useState<0 | 1 | 2 | 3>(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    setBusy(true);
    setError("");
    try {
      onOpened(await GroupAPI.open({ category, count, difficulty: difficulty === 0 ? null : difficulty, name, avatar }, userToken));
    } catch (e) {
      setError(t(roomErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.chooseTopic")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t("rebus.chooseTopic")}>
          {topics.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
              className={themeSystem.card("interactive", `min-h-11 px-3 py-2 text-left text-sm font-black text-ink ${category === id ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`)}
            >
              {id === "mixed" ? t("rebus.mixed") : t(`rebus.categories.${id}`)}
            </button>
          ))}
        </div>
      </section>
      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.questions")}</h3>
        <UITabs label={t("rebus.questions")} items={settings.questionChoices.map((n) => ({ id: String(n), label: String(n) }))} value={String(count)} onChange={(id) => setCount(Number(id))} />
      </section>
      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.filterLevel")}</h3>
        <UITabs
          label={t("rebus.filterLevel")}
          items={[{ id: "0", label: t("rebus.anyLevel") }, ...LEVELS.map((key, i) => ({ id: String(i + 1), label: t(`rebus.level.${key}`) }))]}
          value={String(difficulty)}
          onChange={(id) => setDifficulty(Number(id) as 0 | 1 | 2 | 3)}
        />
      </section>
      <NicknamePicker name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      <UIButton size="lg" fullWidth icon={<DoorOpen />} isLoading={busy} disabled={busy || !name || !avatar} onClick={() => void open()}>
        {t("rebus.group.openRoom")}
      </UIButton>
    </div>
  );
};
