import React from "react";
import { BookOpen, PenTool } from "lucide-react";
import { playSound } from "../utils/audio";
import {
  UISidebar,
  UISidebarNav,
  resolveSidebarIcon,
  useUISidebar,
} from "./ui";
import { themeSystem } from "../lib/themeSystem";
import { useKoda } from "../lib/useKoda";
import { AccountMenu } from "./AccountMenu";
import { navDefaults, useNavItems } from "./navRecord";
import type { TabId } from "./navTabs";

const config = navDefaults;

export interface SidebarNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenWhiteboard: () => void;
  onOpenLexicon: () => void;
}

/**
 * The three things Koda can do from anywhere: the scratchpad and the lexicon.
 *
 * They live in the footer rather than the nav list because neither is a page —
 * each opens a modal over whatever the learner is already doing, which is the
 * whole point of them on the Learn page mid-lesson. On a phone the same two
 * live in the tab bar's overflow sheet.
 */
const SidebarTools: React.FC<{
  onOpenWhiteboard: () => void;
  onOpenLexicon: () => void;
}> = ({ onOpenWhiteboard, onOpenLexicon }) => {
  const { isCollapsed, showLabels } = useUISidebar();
  // One gate for every Koda surface — see `lib/koda.ts`. `offered` is the
  // deployment's answer, `ask` composes it with the plan and the parent, so
  // this button hides and explains for the same reasons the Ask Koda one does.
  const koda = useKoda();
  const s = themeSystem.sidebar;

  const open = (action: () => void) => () => {
    playSound("pop");
    action();
  };

  return (
    <div className="space-y-2">
      <div className={s.toolRow(isCollapsed)}>
        {koda.access("whiteboard").offered && (
          <button
            onClick={open(() => koda.ask("whiteboard", onOpenWhiteboard))}
            className={s.toolSecondary(isCollapsed)}
            title="Scratchpad"
            aria-label="Scratchpad"
          >
            <span className={s.toolIcon}>
              <PenTool />
            </span>
            {showLabels && <span className={s.toolLabel}>Scratchpad</span>}
          </button>
        )}

        {/* No feature flag: the lexicon is bundled text, not a model call. */}
        <button
          onClick={open(onOpenLexicon)}
          className={s.toolSecondary(isCollapsed)}
          title="Math words"
          aria-label="Math words"
        >
          <span className={s.toolIcon}>
            <BookOpen />
          </span>
          {showLabels && <span className={s.toolLabel}>Words</span>}
        </button>
      </div>
    </div>
  );
};

/**
 * Koda's navigation on a tablet or a laptop.
 *
 * Every destination the account may reach, listed in full — which is the thing
 * a rail can do that a five-slot tab bar cannot, and the reason both shells
 * exist rather than one. `useNavItems` is what they share: the record, the
 * permission filter and the live counts are decided once, so a parent cannot
 * see one set of destinations on the iPad and another on their phone.
 *
 * Rendered only from `rail:` up — see `themeSystem.sidebar.aside`. Below that
 * width `AppNav` takes over completely; this is not a drawer waiting to be
 * opened, it is simply not there.
 */
export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenWhiteboard,
  onOpenLexicon,
}) => {
  const items = useNavItems();

  const BrandIcon = resolveSidebarIcon(config.brand.icon);
  const logo = config.brand.logoUrl;

  return (
    <UISidebar
      brand={{
        title: config.brand.title,
        subtitle: config.brand.subtitle,
        iconBare: Boolean(logo),
        icon: logo ? (
          <img src={logo} alt="" className="w-9 h-9 rounded-xl shrink-0" />
        ) : (
          <BrandIcon className="w-5 h-5 text-white" />
        ),
      }}
      onInteract={() => playSound("pop")}
      footer={
        <>
          <SidebarTools
            onOpenWhiteboard={onOpenWhiteboard}
            onOpenLexicon={onOpenLexicon}
          />

          {config.profile && (
            <AccountMenu
              variant="rail"
              profile={config.profile}
              onOpenProfile={() => onSelectTab("profile")}
            />
          )}
        </>
      }
    >
      <UISidebarNav
        sections={[{ id: "main", items }]}
        activeId={activeTab}
        onSelect={(id) => {
          playSound("pop");
          onSelectTab(id as TabId);
        }}
      />
    </UISidebar>
  );
};
